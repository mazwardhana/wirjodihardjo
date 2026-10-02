import type { OrgChartData, OrgLevel } from "./OrgChart";

export const PENGURUS_PLACEHOLDER_NAME = "Kepengurusan Keluarga Besar Wirjodihardjo";
export const PENGURUS_PLACEHOLDER_DESCRIPTION =
  "Susunan pengurus sedang dilengkapi. Setiap jabatan di bawah ini akan diisi oleh anggota keluarga.";

/**
 * Kerangka jabatan kepengurusan yang ditampilkan sebelum admin mengisi nama.
 * Level disusun dari atas ke bawah: dewan pertimbangan, ketua, sekretaris,
 * bendahara, lalu bidang-bidang, dengan dewan perwakilan cabang di bagian bawah.
 */
const PLACEHOLDER_LEVELS: Array<{
  level: number;
  positions: Array<{ name: string; description?: string }>;
}> = [
  {
    level: 0,
    positions: [
      {
        name: "Dewan Pertimbangan",
        description: "Diisi para sesepuh keluarga sebagai penasihat dan penjaga nilai.",
      },
    ],
  },
  { level: 1, positions: [{ name: "Ketua" }] },
  { level: 2, positions: [{ name: "Sekretaris" }] },
  { level: 3, positions: [{ name: "Bendahara" }] },
  {
    level: 4,
    positions: [
      { name: "Bidang Teknologi" },
      { name: "Bidang Dokumentasi dan Publikasi" },
      { name: "Bidang Kreatif dan Kepemudaan" },
    ],
  },
];

type BranchInput = { id: string; name: string; branchNumber: number };

/**
 * Susun data bagan kepengurusan. `branches` mengisi bagian dewan perwakilan
 * cabang; setiap cabang punya dua slot perwakilan yang masih kosong.
 */
export function buildPengurusPlaceholderData(branches: BranchInput[]): OrgChartData {
  const levels: OrgLevel[] = PLACEHOLDER_LEVELS.map(({ level, positions }) => ({
    level,
    positions: positions.map((position) => ({
      id: `placeholder-${position.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: position.name,
      description: position.description ?? null,
      assignments: [],
    })),
  }));

  return {
    structure: {
      name: PENGURUS_PLACEHOLDER_NAME,
      description: PENGURUS_PLACEHOLDER_DESCRIPTION,
    },
    levels,
    branches: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      branchNumber: branch.branchNumber,
      slot1: null,
      slot2: null,
    })),
  };
}
