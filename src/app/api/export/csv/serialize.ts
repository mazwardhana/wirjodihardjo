export type CsvPerson = {
  fullName: string;
  birthDate: Date | null;
  deathDate: Date | null;
  isDeceased: boolean;
  generationLevel: number | null;
  parents: Array<{ parent: { fullName: string } }>;
  children: Array<{ child: { fullName: string } }>;
  partnershipsA: Array<{ partnerB: { fullName: string } }>;
  partnershipsB: Array<{ partnerA: { fullName: string } }>;
};

export const CSV_HEADERS = ["nama", "umur", "hubungan", "usia", "kelas"] as const;

function ageAt(birth: Date | null, end: Date): number | null {
  if (!birth || Number.isNaN(birth.getTime())) return null;
  let age = end.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    end.getMonth() < birth.getMonth() ||
    (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function cell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Susun CSV silsilah dari baris Person beserta relasinya.
 * Dipisah dari route agar bisa diuji tanpa basis data produksi.
 */
export function serializePeopleCsv(people: CsvPerson[], now = new Date()): string {
  const rows = people.map((person) => {
    const age = ageAt(person.birthDate, person.isDeceased && person.deathDate ? person.deathDate : now);
    const relations = [
      ...person.parents.map(({ parent }) => `Orang tua: ${parent.fullName}`),
      ...person.children.map(({ child }) => `Anak: ${child.fullName}`),
      ...person.partnershipsA.map(({ partnerB }) => `Pasangan: ${partnerB.fullName}`),
      ...person.partnershipsB.map(({ partnerA }) => `Pasangan: ${partnerA.fullName}`),
    ];
    const usia = age === null ? "Tidak diketahui" : `${age} tahun`;
    const kelas = person.generationLevel === null ? "Belum ditetapkan" : `Generasi ${person.generationLevel}`;
    return [person.fullName, age === null ? "" : age, relations.join("; ") || "Tidak tercatat", usia, kelas]
      .map(cell)
      .join(",");
  });
  return [CSV_HEADERS.join(","), ...rows].join("\r\n") + "\r\n";
}