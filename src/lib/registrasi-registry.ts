import type { Gender } from "@prisma/client";

/**
 * Daftar anggota buku besar untuk ditampilkan publik.
 *
 * Berbeda dengan `statistik.ts` (yang hanya menghitung), modul ini benar-benar
 * menampilkan nama: cabang, nama panggilan, nama lengkap, jenis kelamin.
 * Karena itu batas query-nya sengaja longgar — hanya `deletedAt: null` —
 * supaya halaman tidak diam-diam menyembunyikan anggota.
 */

export type RegistryGender = Gender;

export type PublicMemberRow = {
  id: string;
  fullName: string;
  namaPanggilan: string | null;
  gender: RegistryGender;
  branchName: string | null;
  branchNumber: number | null;
  /** true bila baris ini dibuat lewat form registrasi / impor registrasi. */
  fromRegistration: boolean;
};

export type RegistryBranch = { id: string; name: string; branchNumber: number };

export type PublicMembersResult = {
  rows: PublicMemberRow[];
  total: number;
  page: number;
  pageSize: number;
  branches: RegistryBranch[];
};

export type PublicMembersQuery = {
  branchId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export const REGISTRY_PAGE_SIZE = 20;

/** Batas minimal db yang dibutuhkan modul ini — memudahkan pengujian. */
export type RegistryDb = {
  person: {
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<
      Array<{
        id: string;
        fullName: string;
        namaPanggilan: string | null;
        gender: RegistryGender;
        registrationBatchId: string | null;
        branch: { name: string; branchNumber: number } | null;
      }>
    >;
  };
  branch: {
    findMany(args: unknown): Promise<RegistryBranch[]>;
  };
};

/** Penyempitan Prisma client ke kontrak `RegistryDb` (type-only, seperti statistik). */
export function asRegistryDb<T extends RegistryDb = RegistryDb>(client: unknown): T {
  return client as T;
}

/**
 * Daftar anggota buku besar, tersaring keluarga cabang dan kata kunci nama.
 *
 * Urutan: nomor cabang dulu, lalu nama lengkap — pembaca mencari "anggota
 * keluarga ini", bukan urutan waktu. `page` dibatasi agar query tidak pernah
 * menarik seluruh buku besar.
 */
export async function getPublicMembers(
  db: RegistryDb,
  query: PublicMembersQuery = {},
): Promise<PublicMembersResult> {
  const branchId = query.branchId?.trim() || undefined;
  const q = query.q?.trim() || undefined;
  const pageSize = clampPageSize(query.pageSize);
  const page = Math.max(1, Math.floor(query.page ?? 1) || 1);

  const where: Record<string, unknown> = { deletedAt: null };
  if (branchId) where.branchId = branchId;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { namaPanggilan: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows, branches] = await Promise.all([
    db.person.count({ where }),
    db.person.findMany({
      where,
      orderBy: [{ branch: { branchNumber: "asc" } }, { fullName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        namaPanggilan: true,
        gender: true,
        registrationBatchId: true,
        branch: { select: { name: true, branchNumber: true } },
      },
    }),
    db.branch.findMany({
      where: { isActive: true },
      orderBy: { branchNumber: "asc" },
      select: { id: true, name: true, branchNumber: true },
    }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      namaPanggilan: row.namaPanggilan,
      gender: row.gender,
      branchName: row.branch?.name ?? null,
      branchNumber: row.branch?.branchNumber ?? null,
      fromRegistration: row.registrationBatchId !== null,
    })),
    total,
    page,
    pageSize,
    branches,
  };
}

/**
 * Jumlah seluruh anggota buku besar yang belum dihapus.
 *
 * Dipakai kartu pintu masuk di halaman registrasi: kartu itu hanya menyebut
 * banyaknya anggota, tanpa menarik satu baris nama pun.
 */
export async function countPublicMembers(db: RegistryDb): Promise<number> {
  return db.person.count({ where: { deletedAt: null } });
}

function clampPageSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return REGISTRY_PAGE_SIZE;
  return Math.min(100, Math.max(1, Math.floor(value)));
}

/** Label jenis kelamin untuk ditampilkan (bukan nilai enum mentah). */
export function genderLabel(gender: RegistryGender): string {
  if (gender === "MALE") return "Laki-laki";
  if (gender === "FEMALE") return "Perempuan";
  return "Lainnya";
}

/** Singkat jenis kelamin untuk kolom tabel sempit. */
export function genderShort(gender: RegistryGender): string {
  if (gender === "MALE") return "L";
  if (gender === "FEMALE") return "P";
  return "—";
}
