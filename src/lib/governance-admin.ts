export const DEFAULT_STRUCTURE_NAME = "Kepengurusan Keluarga Besar Wirjodihardjo";
export const DEFAULT_STRUCTURE_DESCRIPTION =
  "Susunan kepengurusan keluarga besar Wirjodihardjo, dari dewan pertimbangan hingga bidang-bidang.";

export type DefaultPosition = {
  name: string;
  description: string;
  level: number;
};

/** Susunan jabatan bawaan, sejajar dengan kerangka placeholder di halaman publik. */
export const DEFAULT_POSITIONS: DefaultPosition[] = [
  {
    name: "Dewan Pertimbangan",
    description: "Diisi para sesepuh keluarga sebagai penasihat dan penjaga nilai.",
    level: 0,
  },
  { name: "Ketua", description: "Memimpin dan mengoordinasikan kepengurusan.", level: 1 },
  { name: "Sekretaris", description: "Mengelola administrasi dan kesekretariatan.", level: 2 },
  { name: "Bendahara", description: "Mengelola keuangan dan pembukuan keluarga.", level: 3 },
  {
    name: "Bidang Teknologi",
    description: "Mengelola sistem, data, dan sarana digital keluarga.",
    level: 4,
  },
  {
    name: "Bidang Dokumentasi dan Publikasi",
    description: "Mendokumentasikan acara dan mengelola publikasi keluarga.",
    level: 4,
  },
  {
    name: "Bidang Kreatif dan Kepemudaan",
    description: "Menggerakkan kegiatan kreatif dan keterlibatan generasi muda.",
    level: 4,
  },
];
