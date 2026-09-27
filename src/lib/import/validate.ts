import type {
  ParsedData,
  ValidationError,
  ValidationResult,
  Gender,
} from "./types";
import { prisma } from "@/lib/prisma";

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];
const MIN_BRANCH = 1;
const MAX_BRANCH = 10;

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

  const refs = new Set<string>();

  // Collect unique branch numbers and refs for batch queries
  const branchNumbers = new Set<number>();
  const refsToCheck = new Set<string>();

  const anggota = data.anggota.map((row, index) => {
    const rowNo = row._row ?? index + 2;
    const cabangKe = row.cabangKe;
    const namaLengkap = row.namaLengkap?.trim() ?? "";
    const gender = normalizeGender(row.jenisKelamin as unknown as string);

    // Branch number validation (1-10).
    if (!cabangKe || !Number.isInteger(cabangKe) || cabangKe < MIN_BRANCH || cabangKe > MAX_BRANCH) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "cabang_ke",
        message: `Cabang ke harus angka antara ${MIN_BRANCH} sampai ${MAX_BRANCH}.`,
      });
    } else {
      branchNumbers.add(cabangKe);
    }

    if (!namaLengkap) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "nama_lengkap",
        message: "Nama lengkap wajib diisi.",
      });
    }

    if (!gender) {
      errors.push({
        sheet: "Data",
        row: rowNo,
        field: "jenis_kelamin",
        message: "Jenis kelamin harus L/P atau MALE/FEMALE/OTHER.",
      });
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

    // Optional externalRef: validate uniqueness and charset if provided.
    if (row.ref?.trim()) {
      const ref = row.ref.trim();
      if (!/^[A-Za-z0-9_-]+$/.test(ref)) {
        errors.push({
          sheet: "Data",
          row: rowNo,
          field: "ref",
          message: "Ref hanya boleh huruf, angka, tanda hubung, dan garis bawah.",
        });
      } else if (refs.has(ref)) {
        errors.push({
          sheet: "Data",
          row: rowNo,
          field: "ref",
          message: `Ref "${ref}" duplikat.`,
        });
      } else {
        refs.add(ref);
        refsToCheck.add(ref);
      }
    }

    return {
      ...row,
      _row: rowNo,
      cabangKe,
      namaLengkap,
      jenisKelamin: gender ?? (row.jenisKelamin as Gender),
      namaPanggilan: row.namaPanggilan?.trim() || undefined,
      tempatLahir: row.tempatLahir?.trim() || undefined,
      tanggalLahir: tanggalLahir === "invalid" ? row.tanggalLahir : (tanggalLahir ?? undefined),
      kotaDomisili: row.kotaDomisili?.trim() || undefined,
      nomorTelepon: row.nomorTelepon?.trim() || undefined,
      catatan: row.catatan?.trim() || undefined,
      ref: row.ref?.trim() || undefined,
    };
  });

  // H1: Check branch existence at validation time (preview), not commit time
  if (branchNumbers.size > 0) {
    const branches = await prisma.branch.findMany({
      where: { branchNumber: { in: Array.from(branchNumbers) }, isActive: true },
      select: { branchNumber: true },
    });
    const foundBranches = new Set(branches.map(b => b.branchNumber));
    
    // Report missing branches per row
    for (const row of anggota) {
      if (row.cabangKe && !foundBranches.has(row.cabangKe)) {
        errors.push({
          sheet: "Data",
          row: row._row ?? 0,
          field: "cabang_ke",
          message: `Cabang ke-${row.cabangKe} tidak ditemukan atau tidak aktif.`,
        });
      }
    }
  }

  // M2: Check externalRef collision with database (P2002 prevention)
  if (refsToCheck.size > 0) {
    const existingPersons = await prisma.person.findMany({
      where: { externalRef: { in: Array.from(refsToCheck) } },
      select: { externalRef: true },
    });
    const existingRefs = new Set(existingPersons.map(p => p.externalRef));

    // Report ref collisions as row errors
    for (const row of anggota) {
      if (row.ref && existingRefs.has(row.ref)) {
        errors.push({
          sheet: "Data",
          row: row._row ?? 0,
          field: "ref",
          message: `Ref "${row.ref}" sudah digunakan di database.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: { anggota },
  };
}
