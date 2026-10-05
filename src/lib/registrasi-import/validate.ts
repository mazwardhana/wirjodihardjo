import {
  EXCLUDED_BRANCH_SLUG,
  normalizeGender,
  normalizeStatus,
} from "@/lib/registrasi";
import type {
  ParsedRegistrasi,
  RegistrasiImportRow,
  RegistrasiValidationError,
  RegistrasiValidationResult,
} from "./types";

/** Batas minimal database yang dibutuhkan validasi: daftar cabang aktif. */
export type RegistrasiBranchDb = {
  branch: {
    findMany(
      args: unknown,
    ): Promise<{ id: string; name: string; branchNumber: number; slug: string }[]>;
  };
};

const SHEET = "Registrasi" as const;
const NAMA_PANGGILAN_MAX = 100;
const NAMA_LENGKAP_MAX = 200;

type ResolvedBranch = { id: string; name: string; branchNumber: number };

function resolveBranch(raw: string, branches: ResolvedBranch[]): ResolvedBranch | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const number = Number(trimmed);
    const byNumber = branches.find((branch) => branch.branchNumber === number);
    if (byNumber) return byNumber;
  }
  const lower = trimmed.toLowerCase();
  return branches.find((branch) => branch.name.trim().toLowerCase() === lower) ?? null;
}

/**
 * Parse nilai kolom "hadir" dari berkas. Nilai tak dikenal tidak membuat baris
 * gagal; hanya dicatat sebagai peringatan dan dianggap tidak hadir.
 */
function parseHadir(raw: string, warnings: string[]): boolean {
  const key = (raw ?? "").trim().toLowerCase();
  if (key === "ya" || key === "y" || key === "1" || key === "true" || key === "hadir" || key === "yes") {
    return true;
  }
  if (key === "" || key === "tidak" || key === "t" || key === "0" || key === "false" || key === "no") {
    return false;
  }
  warnings.push(`Nilai hadir '${raw.trim()}' tidak dikenali, dianggap tidak.`);
  return false;
}

/**
 * Validasi baris impor registrasi dari Excel/CSV.
 *
 * Berbeda dengan form publik, gender/status yang kosong atau tidak dikenal
 * adalah error (bukan diam-diam menjadi OTHER), dan kolom "hadir" yang aneh
 * hanya memunculkan peringatan. Cabang yang dikecualikan (mis. Suwito) tidak
 * pernah ikut dimuat sehingga baris yang merujuknya dianggap tidak ditemukan.
 */
export async function validateRegistrasiImport(
  db: RegistrasiBranchDb,
  data: ParsedRegistrasi,
): Promise<RegistrasiValidationResult> {
  const errors: RegistrasiValidationError[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data.rows) || data.rows.length === 0) {
    errors.push({
      sheet: SHEET,
      row: 0,
      field: "nama_lengkap",
      message: "File impor kosong: tidak ada baris data.",
    });
    return { valid: false, errors, warnings, data: { rows: [] } };
  }

  const branches = (await db.branch.findMany({
    where: { isActive: true, slug: { not: EXCLUDED_BRANCH_SLUG } },
    select: { id: true, name: true, branchNumber: true, slug: true },
  })) as ResolvedBranch[];

  const rows: RegistrasiImportRow[] = data.rows.map((row, index) => {
    const rowNo = row._row ?? index + 2;
    const rawBranch = (row.cabangKe ?? "").trim();
    const namaPanggilan = (row.namaPanggilan ?? "").trim();
    const namaLengkap = (row.namaLengkap ?? "").trim();

    let branch: ResolvedBranch | null = null;
    branch = resolveBranch(rawBranch, branches);
    if (!branch) {
      errors.push({
        sheet: SHEET,
        row: rowNo,
        field: "kode cabang keluarga",
        message: `Keluarga Cabang '${rawBranch}' tidak ditemukan`,
      });
    }

    if (!namaPanggilan) {
      errors.push({ sheet: SHEET, row: rowNo, field: "nama_panggilan", message: "Nama panggilan wajib diisi." });
    } else if (namaPanggilan.length > NAMA_PANGGILAN_MAX) {
      errors.push({
        sheet: SHEET,
        row: rowNo,
        field: "nama_panggilan",
        message: `Nama panggilan maksimal ${NAMA_PANGGILAN_MAX} karakter.`,
      });
    }

    if (!namaLengkap) {
      errors.push({ sheet: SHEET, row: rowNo, field: "nama_lengkap", message: "Nama lengkap wajib diisi." });
    } else if (namaLengkap.length > NAMA_LENGKAP_MAX) {
      errors.push({
        sheet: SHEET,
        row: rowNo,
        field: "nama_lengkap",
        message: `Nama lengkap maksimal ${NAMA_LENGKAP_MAX} karakter.`,
      });
    }

    const genderResolved = normalizeGender(row.gender ?? "");
    if (!genderResolved) {
      errors.push({ sheet: SHEET, row: rowNo, field: "gender", message: "Pilih L atau P." });
    }

    const status = normalizeStatus(row.status ?? "");
    if (!status) {
      errors.push({ sheet: SHEET, row: rowNo, field: "status", message: "Pilih status hidup atau wafat." });
    }

    const hadir = parseHadir(row.hadir ?? "", warnings);
    const isDeceased = status === "DECEASED";

    return {
      ...row,
      _row: rowNo,
      cabangKe: rawBranch,
      namaPanggilan,
      namaLengkap,
      branchId: branch?.id,
      branchNumber: branch?.branchNumber,
      branchName: branch?.name,
      genderResolved: genderResolved ?? undefined,
      isDeceased,
      willAttend: !isDeceased && hadir,
    };
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings: Array.from(new Set(warnings)),
    data: { rows },
  };
}
