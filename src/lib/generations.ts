/**
 * Penamaan generasi dalam adat Jawa (turunan mudhun).
 * Sumber istilah: budaya.jogjaprov.go.id, detikJateng, ANTARA.
 *
 * Level 0 = pasangan pendiri. Level 1 = anak, dan seterusnya.
 * Di luar level 18, sistem memakai fallback "Generasi ke-N".
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