import type {
  ParsedData,
  ValidationError,
  ValidationResult,
  Gender,
} from "./types";
import { prisma } from "@/lib/prisma";

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 50;
const PASSWORD_MIN = 8;

const GENDER_ALIASES: Record<string, Gender> = {
  l: "MALE",
  "laki-laki": "MALE",
  lakilaki: "MALE",
  lelaki: "MALE",
  pria: "MALE",
  male: "MALE",
  m: "MALE",
  p: "FEMALE",
  perempuan: "FEMALE",
  wanita: "FEMALE",
  female: "FEMALE",
  f: "FEMALE",
  other: "OTHER",
  lainnya: "OTHER",
  lain: "OTHER",
};

function normalizeGender(value: string | undefined): Gender | null {
  if (!value?.trim()) return null;
  const key = value.trim().toLowerCase();
  const upper = value.trim().toUpperCase();
  if (GENDERS.includes(upper as Gender)) return upper as Gender;
  const alias = key.replace(/\s+/g, "-");
  return Object.prototype.hasOwnProperty.call(GENDER_ALIASES, alias) ? GENDER_ALIASES[alias] : null;
}

/** Nama lengkap ternormalisasi untuk deteksi idempotensi (branchId + nama). */
export function normalizeFullName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Tanggal kalender yang ketat: tidak ada rollover, tidak ada fallback longgar. */
export function parseStrictDate(value: string | undefined): string | null | "invalid" {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  let year: number, month: number, day: number;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    year = Number(dmy[3]);
    month = Number(dmy[2]);
    day = Number(dmy[1]);
  } else {
    return "invalid";
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1) return "invalid";
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "invalid";
  }
  return date.toISOString().slice(0, 10);
}

/** Convert parsed date string to Date object for DB storage. */
export function toDateObject(dateString: string): Date {
  return new Date(`${dateString}T00:00:00Z`);
}

type ResolvedBranch = { id: string; branchNumber: number; name: string };

async function loadActiveBranches(): Promise<ResolvedBranch[]> {
  return prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, branchNumber: true, name: true },
  });
}

function resolveBranch(raw: string, branches: ResolvedBranch[]): ResolvedBranch | null {
  if (/^\d+$/.test(raw)) {
    const number = Number(raw);
    const byNumber = branches.find((branch) => branch.branchNumber === number);
    if (byNumber) return byNumber;
  }
  const lower = raw.toLowerCase();
  return branches.find((branch) => branch.name.trim().toLowerCase() === lower) ?? null;
}

export async function validateImportData(data: ParsedData): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (data.anggota.length === 0) {
    errors.push({
      sheet: "Data",
      row: 0,
      field: "nama_lengkap",
      message: "File impor kosong: tidak ada baris data.",
    });
    return { valid: false, errors, warnings, data };
  }

  const branches = await loadActiveBranches();

  const anggota = data.anggota.map((row, index) => {
    const rowNo = row._row ?? index + 2;
    const rawBranch = row.cabangKe?.trim() ?? "";
    const namaLengkap = row.namaLengkap?.trim() ?? "";
    const nickname = row.namaPanggilan?.trim() ?? "";
    const password = row.password?.trim() ?? "";
    const passwordHash = row.passwordHash?.trim() ?? "";
    const rawGender = row.jenisKelamin as unknown as string | undefined;
    const gender = normalizeGender(rawGender);

    let branch: ResolvedBranch | null = null;
    if (!rawBranch) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "kode cabang keluarga",
        message: "Kode cabang keluarga wajib diisi.",
      });
    } else {
      branch = resolveBranch(rawBranch, branches);
      if (!branch) {
        errors.push({
          sheet: "Data",
          row: rowNo,
          field: "kode cabang keluarga",
          message: `Cabang '${rawBranch}' tidak ditemukan`,
        });
      }
    }

    if (!namaLengkap) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "nama_lengkap",
        message: "Nama lengkap wajib diisi.",
      });
    }

    if (!nickname) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "nickname",
        message: "Nickname wajib diisi.",
      });
    } else if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "nickname",
        message: `Nickname harus ${NICKNAME_MIN}-${NICKNAME_MAX} karakter.`,
      });
    }

    // Pada commit password sudah berbentuk hash sehingga panjangnya tidak bisa
    // dicek ulang; hash yang kosong berarti data batch tidak lengkap.
    if (!password && !passwordHash) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "password",
        message: `Password wajib diisi minimal ${PASSWORD_MIN} karakter.`,
      });
    } else if (password && password.length < PASSWORD_MIN) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "password",
        message: `Password minimal ${PASSWORD_MIN} karakter.`,
      });
    }

    if (rawGender?.trim() && !gender) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "gender",
        message: "Gender harus MALE/FEMALE/OTHER atau L/P/Laki-laki/Perempuan.",
      });
    } else if (!rawGender?.trim()) {
      warnings.push("Gender kosong, diisi OTHER");
    }

    const tanggalLahir = parseStrictDate(row.tanggalLahir);
    if (tanggalLahir === "invalid") {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "tanggal_lahir",
        message: "Format tanggal lahir tidak valid (YYYY-MM-DD atau DD/MM/YYYY).",
      });
    }

    return {
      ...row,
      _row: rowNo,
      cabangKe: rawBranch,
      namaLengkap,
      namaPanggilan: nickname || undefined,
      password: password || undefined,
      jenisKelamin: gender ?? "OTHER",
      tempatLahir: row.tempatLahir?.trim() || undefined,
      tanggalLahir: tanggalLahir === "invalid" ? row.tanggalLahir : (tanggalLahir ?? undefined),
      nomorTelepon: row.nomorTelepon?.trim() || undefined,
      alamatDomisili: row.alamatDomisili?.trim() || undefined,
      kotaDomisili: row.kotaDomisili?.trim() || undefined,
      branchId: branch?.id,
      branchNumber: branch?.branchNumber,
    };
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings: Array.from(new Set(warnings)),
    data: { anggota },
  };
}
