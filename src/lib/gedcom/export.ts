import type { GedcomGender } from "./types";

/**
 * Serialisasi data orang + relasinya menjadi GEDCOM 5.5.1.
 *
 * Fungsi ini murni (tanpa database) supaya bisa diuji tanpa Prisma, mengikuti
 * pola `serializePeopleCsv`. Keluaran memakai xref stabil `@I<n>@` untuk
 * orang dan `@F<n>@` untuk keluarga, berurutan sesuai urutan argumen.
 */

export type GedcomExportPerson = {
  id: string;
  externalRef?: string | null;
  fullName: string;
  nickname?: string | null;
  gender: GedcomGender;
  birthDate: Date | null;
  birthPlace?: string | null;
  deathDate: Date | null;
  deathPlace?: string | null;
  isDeceased: boolean;
  occupation?: string | null;
  notes?: string | null;
  parents: Array<{ parentId: string; parentGender: GedcomGender }>;
  children: Array<{ childId: string }>;
  partners: Array<{
    partnerId: string;
    status: "MARRIED" | "DIVORCED" | "WIDOWED" | "UNKNOWN";
    marriageDate: Date | null;
    divorceDate: Date | null;
  }>;
};

export type GedcomExportOptions = {
  sourceName?: string;
  submitterName?: string;
};

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatDate(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_ABBR[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/** Ganti CR/LF (dan tab) dengan spasi biar GEDCOM tetap satu baris. */
function flat(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/\r\n|\r|\n/g, " ").replace(/\t/g, " ").replace(/\s+/g, " ");
}

function splitName(fullName: string): { given: string; surname: string } {
  const text = flat(fullName).trim();
  const parts = text.split(/\s+/);
  if (parts.length === 1) return { given: text, surname: "" };
  return { given: parts[0], surname: parts.slice(1).join(" ") };
}

function escapeValue(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ");
}

/** Tambahkan catatan multi-baris dengan kontinuasi `2 CONT`. */
function appendNote(lines: string[], tag: string, value: string, indent = "1"): void {
  const paragraphs = value.split(/\r\n|\r|\n/);
  lines.push(`${indent} ${tag} ${escapeValue(paragraphs[0] ?? "").trim()}`);
  for (const paragraph of paragraphs.slice(1)) {
    lines.push(`${indent} CONT ${escapeValue(paragraph).trim()}`);
  }
}

export function serializeGedcom(
  persons: GedcomExportPerson[],
  opts: GedcomExportOptions = {},
): string {
  const lines: string[] = [];

  lines.push("0 HEAD");
  lines.push("1 SOUR WIRJODIHARDJO");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");
  lines.push("1 SUBM @SUBM@");
  lines.push("0 @SUBM@ SUBM");
  lines.push(`1 NAME ${opts.submitterName ? flat(opts.submitterName) : "Wirjodihardjo"}`);

  const xrefById = new Map<string, string>();
  persons.forEach((person, index) => {
    xrefById.set(person.id, `@I${index + 1}@`);
  });

  for (const person of persons) {
    const xref = xrefById.get(person.id)!;
    lines.push(`0 ${xref} INDI`);

    const { given, surname } = splitName(person.fullName);
    const nameValue = surname ? `${given} /${surname}/` : given;
    lines.push(`1 NAME ${nameValue}`);
    if (given) lines.push(`2 GIVN ${given}`);
    if (surname) lines.push(`2 SURN ${surname}`);
    if (person.nickname) lines.push(`2 NICK ${flat(person.nickname)}`);

    const sex = person.gender === "MALE" ? "M" : person.gender === "FEMALE" ? "F" : "U";
    lines.push(`1 SEX ${sex}`);

    const birthDate = formatDate(person.birthDate);
    if (birthDate || person.birthPlace) {
      lines.push("1 BIRT");
      if (birthDate) lines.push(`2 DATE ${birthDate}`);
      if (person.birthPlace) lines.push(`2 PLAC ${flat(person.birthPlace)}`);
    }

    const deathDate = formatDate(person.deathDate);
    if (person.isDeceased || deathDate || person.deathPlace) {
      lines.push("1 DEAT");
      if (deathDate) lines.push(`2 DATE ${deathDate}`);
      if (person.deathPlace) lines.push(`2 PLAC ${flat(person.deathPlace)}`);
    }

    if (person.occupation) lines.push(`1 OCCU ${flat(person.occupation)}`);
    if (person.notes) appendNote(lines, "NOTE", person.notes);
  }

  const pairKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);
  const families = new Map<string, { husband?: string; wife?: string; marriageDate: Date | null; divorceDate: Date | null; status: GedcomExportPerson["partners"][number]["status"] }>();

  for (const person of persons) {
    for (const partner of person.partners) {
      const key = pairKey(person.id, partner.partnerId);
      const husbandRef = xrefById.get(person.id);
      const wifeRef = xrefById.get(partner.partnerId);

      const genderA = person.gender;
      // Gender B diambil dari data person lawan bila tersedia.
      const genderB = persons.find((p) => p.id === partner.partnerId)?.gender;

      let husbandId: string;
      let wifeId: string;
      if (genderA === "MALE" && genderB === "FEMALE") {
        husbandId = person.id;
        wifeId = partner.partnerId;
      } else if (genderA === "FEMALE" && genderB === "MALE") {
        husbandId = partner.partnerId;
        wifeId = person.id;
      } else if (genderA === "MALE" || genderA === "OTHER") {
        husbandId = person.id;
        wifeId = partner.partnerId;
      } else {
        husbandId = partner.partnerId;
        wifeId = person.id;
      }

      const existing = families.get(key);
      if (existing) {
        // Jika ada dua sisi yang mengisi, isi sisi yang kosong.
        if (!existing.husband && husbandRef) existing.husband = xrefById.get(husbandId);
        if (!existing.wife && wifeRef) existing.wife = xrefById.get(wifeId);
        if (!existing.marriageDate) existing.marriageDate = partner.marriageDate;
        if (!existing.divorceDate) existing.divorceDate = partner.divorceDate;
        if (existing.status === "UNKNOWN") existing.status = partner.status;
        continue;
      }

      families.set(key, {
        husband: xrefById.get(husbandId),
        wife: xrefById.get(wifeId),
        marriageDate: partner.marriageDate,
        divorceDate: partner.divorceDate,
        status: partner.status,
      });
    }
  }

  let familyIndex = 0;
  for (const [key, family] of families) {
    familyIndex += 1;
    const [aId, bId] = key.split("::");
    lines.push(`0 @F${familyIndex}@ FAM`);
    if (family.husband) lines.push(`1 HUSB ${family.husband}`);
    if (family.wife) lines.push(`1 WIFE ${family.wife}`);

    // Anak: gabungkan dari kedua orang tua, buang duplikat, pertahankan urutan.
    const childIds: string[] = [];
    const seenChild = new Set<string>();
    const addChildren = (personId: string) => {
      const person = persons.find((p) => p.id === personId);
      for (const child of person?.children ?? []) {
        if (!seenChild.has(child.childId)) {
          seenChild.add(child.childId);
          childIds.push(child.childId);
        }
      }
    };
    addChildren(aId);
    addChildren(bId);
    for (const childId of childIds) {
      const childXref = xrefById.get(childId);
      if (childXref) lines.push(`1 CHIL ${childXref}`);
    }

    if (family.status !== "DIVORCED" || family.marriageDate) {
      lines.push("1 MARR");
      const marriageDate = formatDate(family.marriageDate);
      if (marriageDate) lines.push(`2 DATE ${marriageDate}`);
    }
    if (family.status === "DIVORCED" && family.divorceDate) {
      lines.push("1 DIV");
      const divorceDate = formatDate(family.divorceDate);
      if (divorceDate) lines.push(`2 DATE ${divorceDate}`);
    }
  }

  lines.push("0 TRLR");

  return lines.join("\n") + "\n";
}