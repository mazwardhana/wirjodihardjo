/**
 * Penamaan generasi dalam adat Jawa, dua arah.
 * - Ke bawah (keturunan): level dihitung dari subjek, 0 = pasangan pendiri,
 *   1 = anak, 2 = putu, dan seterusnya sampai level 18.
 * - Ke atas (leluhur): level dihitung dari subjek, 1 = orang tua,
 *   2 = kakek/nenek, 3 = buyut, dan seterusnya.
 * Sumber istilah: budaya.jogjaprov.go.id, detikJateng, ANTARA.
 *
 * Di luar level yang terdaftar, sistem memakai fallback "Generasi ke-N".
 */
export const GENERATION_LABELS: { level: number; jawa: string; indonesia: string | null }[] = [
  { level: 0, jawa: "Leluhur / Pendiri", indonesia: "Pendiri Keluarga" },
  { level: 1, jawa: "Anak", indonesia: "Anak" },
  { level: 2, jawa: "Putu / Wayah", indonesia: "Cucu" },
  { level: 3, jawa: "Buyut", indonesia: "Cicit" },
  { level: 4, jawa: "Canggah", indonesia: "Piut" },
  { level: 5, jawa: "Wareng", indonesia: "Anggas" },
  { level: 6, jawa: "Udheg-udheg", indonesia: null },
  { level: 7, jawa: "Gantung siwur", indonesia: null },
  { level: 8, jawa: "Gropak senthe", indonesia: null },
  { level: 9, jawa: "Debog bosok", indonesia: null },
  { level: 10, jawa: "Galih asem", indonesia: null },
  { level: 11, jawa: "Gropak waton", indonesia: null },
  { level: 12, jawa: "Cendheng", indonesia: null },
  { level: 13, jawa: "Giyeng", indonesia: null },
  { level: 14, jawa: "Cumpleng", indonesia: null },
  { level: 15, jawa: "Ampleng", indonesia: null },
  { level: 16, jawa: "Menyaman", indonesia: null },
  { level: 17, jawa: "Menya-menya", indonesia: null },
  { level: 18, jawa: "Trah tumerah", indonesia: null },
];

export function getGenerationLabel(level: number | null | undefined): string {
  if (level === null || level === undefined) return "Generasi belum diketahui";
  const found = GENERATION_LABELS.find((l) => l.level === level);
  if (found) return found.jawa;
  return `Generasi ke-${level}`;
}

/**
 * Label rantai ke atas (leluhur) untuk satu tingkat dari subjek.
 * Level 1 orang tua, level 2 kakek/nenek, level 3 ke atas memakai kolom `jawa`.
 * Tanpa gender memakai bentuk umum.
 */
export function getAncestorLabel(level: number, gender?: string | null): string {
  if (level <= 0) return `Generasi ke-${level}`;
  if (level === 1) {
    if (gender === "MALE") return "Ayah";
    if (gender === "FEMALE") return "Ibu";
    return "Orang Tua";
  }
  if (level === 2) {
    if (gender === "MALE") return "Kakek";
    if (gender === "FEMALE") return "Nenek";
    return "Kakek/Nenek";
  }
  return GENERATION_LABELS.find((l) => l.level === level)?.jawa ?? `Generasi ke-${level}`;
}

/** Label rantai ke bawah (keturunan). Identik dengan `getGenerationLabel`. */
export function getDescendantLabel(level: number): string {
  return getGenerationLabel(level);
}