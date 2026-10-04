import bcrypt from "bcryptjs";
import type { Gender } from "@prisma/client";
import { deriveUniqueUsername, deriveBaseUsername } from "@/lib/import/username";

/** Slug cabang yang tidak ditawarkan di form registrasi (tetap ada di situs). */
export const EXCLUDED_BRANCH_SLUG = "keluarga-suwito";

/** Password bawaan untuk akun hasil registrasi. Wajib diganti saat login pertama. */
export const DEFAULT_REGISTRATION_PASSWORD = "12345678";
export const REGISTRATION_BCRYPT_ROUNDS = 12;

/** Event reuni yang menjadi tujuan pendaftaran pada form registrasi. */
export const REUNI_2027_SLUG = "reuni-wirjodihardjo-2-0-blitar-2027";
export const REUNI_2027_TITLE = "Reuni Wirjodihardjo 2.0 - Blitar, 2027";
export const REUNI_2027_LOCATION = "Blitar";
export const REUNI_2027_DESCRIPTION =
  "Reuni Keluarga Besar Wirjodihardjo di Blitar. Tanggal dan waktu pelaksanaan menyusul, masih dalam pembahasan pengurus.";

export const MIN_ROWS = 1;
export const MAX_ROWS = 50;

export type RegistrationStatus = "ALIVE" | "DECEASED";

export type RegistrationRowInput = {
  namaPanggilan: string;
  namaLengkap: string;
  gender: string;
  status: string;
  hadir: boolean;
};

export type NormalizedRow = {
  index: number;
  namaPanggilan: string;
  namaLengkap: string;
  gender: Gender;
  isDeceased: boolean;
  hadir: boolean;
};

export type RegistrationRowError = {
  index: number;
  field: string;
  message: string;
};

export type RegistrationValidation = {
  valid: boolean;
  errors: RegistrationRowError[];
  rows: NormalizedRow[];
};

export type RegistrationResult = {
  batchId: string;
  rowCount: number;
  accountsMade: number;
  attendees: number;
};

export type RegistrationBranch = { id: string; name: string; branchNumber: number };

/** Minimal boundary yang dibutuhkan modul ini, agar mudah diuji dengan Prisma palsu. */
export type RegistrationDb = {
  branch: {
    findMany(args: unknown): Promise<RegistrationBranch[]>;
    findUnique(args: unknown): Promise<{ id: string; slug: string; isActive: boolean } | null>;
  };
  reunion: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  $transaction<T>(fn: (tx: RegistrationTx) => Promise<T>): Promise<T>;
};

export type RegistrationTx = {
  person: { create(args: unknown): Promise<{ id: string }> };
  user: {
    create(args: unknown): Promise<{ id: string }>;
    findMany(args: unknown): Promise<{ username: string }[]>;
  };
  reunionRegistration: { create(args: unknown): Promise<{ id: string }> };
  registrationBatch: { create(args: unknown): Promise<{ id: string }> };
};

function normalizeGender(value: string): Gender | null {
  const key = value.trim().toLowerCase();
  if (key === "l" || key === "male" || key === "laki-laki" || key === "pria") return "MALE";
  if (key === "p" || key === "female" || key === "perempuan" || key === "wanita") return "FEMALE";
  if (key === "other" || key === "lainnya") return "OTHER";
  return null;
}

function normalizeStatus(value: string): RegistrationStatus | null {
  const key = value.trim().toLowerCase();
  if (key === "alive" || key === "hidup") return "ALIVE";
  if (key === "deceased" || key === "wafat" || key === "meninggal") return "DECEASED";
  return null;
}

/**
 * Validasi input registrasi. Baris kosong (nama panggilan & nama lengkap
 * kosong) diabaikan; baris yang terisi sebagian dilaporkan sebagai error.
 */
export function validateRegistration(rows: RegistrationRowInput[]): RegistrationValidation {
  const errors: RegistrationRowError[] = [];
  const normalized: NormalizedRow[] = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, errors: [{ index: 0, field: "rows", message: "Isi minimal satu baris anggota." }], rows: [] };
  }
  if (rows.length > MAX_ROWS) {
    return {
      valid: false,
      errors: [{ index: 0, field: "rows", message: `Maksimal ${MAX_ROWS} baris per kiriman.` }],
      rows: [],
    };
  }

  rows.forEach((row, index) => {
    const namaPanggilan = (row.namaPanggilan ?? "").trim();
    const namaLengkap = (row.namaLengkap ?? "").trim();
    const emptyRow = !namaPanggilan && !namaLengkap;
    if (emptyRow) return;

    if (!namaPanggilan) {
      errors.push({ index, field: "namaPanggilan", message: "Nama panggilan wajib diisi." });
    } else if (namaPanggilan.length > 100) {
      errors.push({ index, field: "namaPanggilan", message: "Nama panggilan maksimal 100 karakter." });
    }

    if (!namaLengkap) {
      errors.push({ index, field: "namaLengkap", message: "Nama lengkap wajib diisi." });
    } else if (namaLengkap.length > 200) {
      errors.push({ index, field: "namaLengkap", message: "Nama lengkap maksimal 200 karakter." });
    }

    const gender = normalizeGender(row.gender ?? "");
    if (!gender) {
      errors.push({ index, field: "gender", message: "Pilih L atau P." });
    }

    const status = normalizeStatus(row.status ?? "");
    if (!status) {
      errors.push({ index, field: "status", message: "Pilih status hidup atau wafat." });
    }

    if (namaPanggilan && namaLengkap && gender && status) {
      normalized.push({
        index,
        namaPanggilan,
        namaLengkap,
        gender,
        isDeceased: status === "DECEASED",
        hadir: Boolean(row.hadir),
      });
    }
  });

  if (normalized.length === 0 && errors.length === 0) {
    errors.push({ index: 0, field: "rows", message: "Isi minimal satu baris anggota." });
  }

  return { valid: errors.length === 0 && normalized.length > 0, errors, rows: normalized };
}

/** Daftar keluarga besar untuk search-select form (kecuali cabang yang dikecualikan). */
export async function getRegistrationBranches(db: RegistrationDb): Promise<RegistrationBranch[]> {
  const branches = await db.branch.findMany({
    where: { isActive: true, slug: { not: EXCLUDED_BRANCH_SLUG } },
    orderBy: { branchNumber: "asc" },
    select: { id: true, name: true, branchNumber: true },
  });
  return branches;
}

async function loadTakenUsernames(tx: RegistrationTx, bases: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(bases));
  if (unique.length === 0) return new Set();
  const users = await tx.user.findMany({
    where: { OR: unique.map((base) => ({ username: { startsWith: base } })) },
    select: { username: true },
  });
  return new Set(users.map((u) => u.username));
}

/**
 * Buat data anggota + akun untuk setiap baris, lalu catat batch. Semua baris
 * termasuk yang wafat tetap dibuatkan akun (sesuai keputusan pengurus), tetapi
 * hanya yang hadir dan masih hidup yang dicatat sebagai peserta reuni.
 *
 * Tanpa dedup: nama yang sama tetap dibuat (bisa jadi orang berbeda); admin
 * dapat menyunting atau menghapusnya kemudian.
 */
export async function createRegistrations(
  db: RegistrationDb,
  input: { branchId: string; rows: NormalizedRow[]; reunionId: string | null; submitterIp?: string | null },
): Promise<RegistrationResult> {
  const { branchId, rows, reunionId, submitterIp } = input;

  const branch = await db.branch.findUnique({ where: { id: branchId } });
  if (!branch || !branch.isActive || branch.slug === EXCLUDED_BRANCH_SLUG) {
    throw new Error("BRANCH_INVALID");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_REGISTRATION_PASSWORD, REGISTRATION_BCRYPT_ROUNDS);

  return db.$transaction(async (tx) => {
    const bases = rows.map((row) => deriveBaseUsername(row.namaPanggilan, row.namaLengkap));
    const taken = await loadTakenUsernames(tx, bases);

    let accountsMade = 0;
    let attendees = 0;

    for (const row of rows) {
      const person = await tx.person.create({
        data: {
          fullName: row.namaLengkap,
          namaPanggilan: row.namaPanggilan,
          nickname: row.namaPanggilan,
          gender: row.gender,
          isDeceased: row.isDeceased,
          branchId,
        },
      });

      const username = deriveUniqueUsername(row.namaPanggilan, row.namaLengkap, taken);
      taken.add(username);

      const user = await tx.user.create({
        data: {
          username,
          email: null,
          passwordHash,
          role: "MEMBER",
          isActive: true,
          isVerified: true,
          mustChangeCredentials: true,
          personId: person.id,
        },
      });
      accountsMade++;

      if (reunionId && row.hadir && !row.isDeceased) {
        await tx.reunionRegistration.create({
          data: { reunionId, userId: user.id, guestCount: 1, status: "CONFIRMED" },
        });
        attendees++;
      }
    }

    const batch = await tx.registrationBatch.create({
      data: {
        branchId,
        rowCount: rows.length,
        accountsMade,
        attendees,
        submitterIp: submitterIp ?? null,
      },
    });

    return { batchId: batch.id, rowCount: rows.length, accountsMade, attendees };
  });
}
