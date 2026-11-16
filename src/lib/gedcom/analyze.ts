import { normalizeFullName } from "@/lib/import/validate";
import type {
  GedcomParseResult,
  GedcomPlan,
  GedcomPlanPerson,
  GedcomValidationError,
  GedcomValidationResult,
} from "./types";

/**
 * Rencanakan impor GEDCOM terhadap data yang sudah ada di database.
 *
 * Dedup memakai dua kunci per orang (referensi eksternal + nama, dan
 * nama + tanggal lahir) supaya orang yang sama tetap terdeteksi walau
 * berkas GEDCOM baru memakai penomoran xref berbeda. Sama seperti pola
 * registrasi, Person terarsip (deletedAt) tidak menghalangi impor ulang.
 */

/** Batas minimal database yang dibutuhkan analisis. */
export type GedcomAnalyzeDb = {
  person: {
    findMany(
      args: unknown,
    ): Promise<{ id: string; externalRef: string | null; fullName: string; birthDate: Date | null }[]>;
  };
};

/** Kunci dedup 1: referensi eksternal GEDCOM + nama ternormalisasi. */
function refKey(gedcomId: string, fullName: string): string {
  return `${gedcomId.toLowerCase()}::${normalizeFullName(fullName)}`;
}

/** Nilai tanggal untuk kunci dedup: ISO bila berhasil parse, teks mentah bila gagal. */
function dateKeyPart(person: { birthDate: Date | null; birthDateRaw?: string }): string {
  if (person.birthDate && !Number.isNaN(person.birthDate.getTime())) {
    return person.birthDate.toISOString().slice(0, 10);
  }
  return (person.birthDateRaw ?? "").trim().toLowerCase();
}

/** Kunci dedup 2: nama ternormalisasi + tanggal lahir. */
function nameKey(fullName: string, datePart: string): string {
  return `${normalizeFullName(fullName)}::${datePart}`;
}

export async function analyzeGedcom(
  db: GedcomAnalyzeDb,
  data: GedcomParseResult,
  validateResult?: GedcomValidationResult,
): Promise<GedcomPlan> {
  const persons = Array.isArray(data?.persons) ? data.persons : [];
  const families = Array.isArray(data?.families) ? data.families : [];

  const gedcomIds = Array.from(new Set(persons.map((person) => person.gedcomId)));
  const fullNames = Array.from(new Set(persons.map((person) => person.fullName.trim())));

  const existing = fullNames.length
    ? await db.person.findMany({
        // Person terarsip tidak menghalangi impor ulang: baris akan dibuat
        // kembali sebagai anggota aktif, catatan lama tetap tersimpan.
        where: { deletedAt: null, OR: [{ externalRef: { in: gedcomIds } }, { fullName: { in: fullNames } }] },
        select: { id: true, externalRef: true, fullName: true, birthDate: true },
      })
    : [];

  const existingKeys = new Set<string>();
  for (const person of existing) {
    if (person.externalRef) {
      existingKeys.add(refKey(person.externalRef, person.fullName));
    }
    const datePart = person.birthDate && !Number.isNaN(person.birthDate.getTime())
      ? person.birthDate.toISOString().slice(0, 10)
      : "";
    existingKeys.add(nameKey(person.fullName, datePart));
  }

  const seen = new Set<string>();
  const seenGedcomIds = new Set<string>();
  const planPersons: GedcomPlanPerson[] = [];
  let personsCreated = 0;
  let personsSkipped = 0;

  for (const person of persons) {
    if (seenGedcomIds.has(person.gedcomId)) {
      personsSkipped++;
      planPersons.push({
        gedcomId: person.gedcomId,
        fullName: person.fullName,
        gender: person.gender,
        willCreate: false,
        reason: `duplikat ${person.gedcomId} di file`,
      });
      continue;
    }
    seenGedcomIds.add(person.gedcomId);

    const key = refKey(person.gedcomId, person.fullName);
    const datePart = dateKeyPart(person);
    const duplicate =
      existingKeys.has(key) || (datePart && existingKeys.has(nameKey(person.fullName, datePart))) || seen.has(key);
    seen.add(key);
    if (datePart) seen.add(nameKey(person.fullName, datePart));

    if (duplicate) {
      personsSkipped++;
      planPersons.push({
        gedcomId: person.gedcomId,
        fullName: person.fullName,
        gender: person.gender,
        willCreate: false,
        duplicateOf: key,
        reason: "sudah ada, dilewati",
      });
      continue;
    }

    personsCreated++;
    planPersons.push({
      gedcomId: person.gedcomId,
      fullName: person.fullName,
      gender: person.gender,
      willCreate: true,
    });
  }

  // Hitung edge yang direncanakan: hanya edge dengan minimal satu ujung orang
  // yang akan dibuat. Commit tetap memeriksa ulang dan melewatkan yang sudah
  // ada, jadi angka ini adalah perkiraan rencana, bukan janji.
  const willCreateIds = new Set(
    planPersons.filter((entry) => entry.willCreate).map((entry) => entry.gedcomId),
  );
  const inFile = new Set(persons.map((person) => person.gedcomId));

  const childEdges = new Set<string>();
  const partnerEdges = new Set<string>();
  for (const family of families) {
    const parents = [family.husband, family.wife].filter((ref): ref is string => {
      return typeof ref === "string" && inFile.has(ref);
    });
    const children = family.children.filter((child) => inFile.has(child));

    for (const parent of parents) {
      for (const child of children) {
        if (parent === child) continue;
        if (!willCreateIds.has(parent) && !willCreateIds.has(child)) continue;
        childEdges.add(`${parent}::${child}`);
      }
    }

    if (family.husband && family.wife && family.husband !== family.wife) {
      if (willCreateIds.has(family.husband) || willCreateIds.has(family.wife)) {
        const [a, b] = [family.husband, family.wife].sort();
        partnerEdges.add(`${a}::${b}`);
      }
    }
  }

  return {
    personsCreated,
    personsSkipped,
    childEdgesCreated: childEdges.size,
    partnerEdgesCreated: partnerEdges.size,
    errors: validateResult?.errors ?? ([] as GedcomValidationError[]),
    warnings: validateResult?.warnings ?? [],
    persons: planPersons,
  };
}