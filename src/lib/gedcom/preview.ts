import type { GedcomParseResult, GedcomPlan, GedcomPreviewRow } from "./types";

/**
 * Susun pratinjau tampilan untuk impor GEDCOM: satu baris per orang.
 *
 * Urutan mengikuti daftar orang hasil parse; kolom status diisi dari rencana
 * (baru/dilewati). Hanya `limit` baris pertama yang dikembalikan.
 */
export function buildGedcomPreview(
  data: GedcomParseResult,
  plan: GedcomPlan,
  limit = 100,
): GedcomPreviewRow[] {
  const persons = Array.isArray(data?.persons) ? data.persons : [];
  const planByGedcomId = new Map(plan.persons.map((entry) => [entry.gedcomId, entry]));

  return persons.slice(0, limit).map((person) => {
    const planned = planByGedcomId.get(person.gedcomId);
    return {
      gedcomId: person.gedcomId,
      fullName: person.fullName,
      gender: person.gender,
      birthDateRaw: person.birthDateRaw,
      birthDate: person.birthDate,
      birthPlace: person.birthPlace,
      deathDate: person.deathDate,
      isDeceased: person.isDeceased,
      status: planned?.willCreate ? "baru" : "dilewati",
      reason: planned?.reason,
    };
  });
}