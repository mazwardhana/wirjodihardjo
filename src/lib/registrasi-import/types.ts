import type { Gender } from "@prisma/client";
import type { NormalizedRow } from "@/lib/registrasi";

/**
 * Kontrak bersama untuk impor registrasi lewat Excel/CSV.
 *
 * Impor ini memakai alur yang sama dengan form registrasi publik: tiap baris
 * membuat Person + akun (password bawaan, username diturunkan dari nama
 * panggilan) dan, bila hadir & masih hidup, pendaftaran reuni. Bedanya,
 * di sini baris datang dari berkas, ada deteksi baris yang sudah ada (dilewati
 * dan dilaporkan), dan satu berkas boleh memuat beberapa cabang.
 */

export const REGISTRASI_IMPORT_TYPE = "REGISTRASI";

/** Sheet/label untuk pesan error, meniru pola impor anggota. */
export type RegistrasiSheet = "Registrasi";

export type RegistrasiImportRow = {
  _row?: number;
  /** Nilai mentah kolom "kode cabang keluarga": nomor cabang atau nama cabang. */
  cabangKe: string;
  namaPanggilan: string;
  namaLengkap: string;
  /** Mentah L/P (atau variasi) dari berkas. */
  gender: string;
  /** Mentah hidup/wafat (atau variasi) dari berkas. */
  status: string;
  /** Mentah ya/tidak (atau variasi) dari berkas. */
  hadir: string;
  /** Hasil resolusi cabang (diisi `validateRegistrasiImport`). */
  branchId?: string;
  branchNumber?: number;
  branchName?: string;
  /** Hasil normalisasi gender (diisi validasi). */
  genderResolved?: Gender;
  isDeceased?: boolean;
  /** Bila true, baris ini layak jadi peserta reuni (bukan wafat & hadir ya). */
  willAttend?: boolean;
};

export type ParsedRegistrasi = { rows: RegistrasiImportRow[] };

export type RegistrasiValidationError = {
  sheet: RegistrasiSheet;
  row: number;
  field: string;
  message: string;
};

export type RegistrasiValidationResult = {
  valid: boolean;
  errors: RegistrasiValidationError[];
  warnings: string[];
  data: ParsedRegistrasi;
};

/** Satu baris laporan kredensial hasil impor registrasi. */
export type RegistrasiCredential = {
  fullName: string;
  /** Username hasil commit; kosong bila baris dilewati. */
  username: string;
  /** Status tampilan: "dibuat" atau alasan dilewati. */
  status: string;
  branchNumber: number;
  branchName?: string;
  isDeceased: boolean;
  willAttend: boolean;
  /** Kunci baris (`branchId::nama-normalisasi`) untuk mencocokkan pratinjau ↔ commit. */
  rowKey?: string;
};

export type RegistrasiSkipRow = {
  fullName: string;
  branchNumber: number;
  reason: string;
};

export type RegistrasiCounts = {
  total: number;
  personsCreated: number;
  accountsCreated: number;
  attendeesPlanned: number;
  rowsSkipped: number;
};

/** Satu kelompok baris yang akan dibuat dalam satu transaksi per cabang. */
export type RegistrasiBranchGroup = {
  branchId: string;
  branchNumber: number;
  branchName?: string;
  rows: NormalizedRow[];
};

export type RegistrasiAnalyzeResult = {
  counts: RegistrasiCounts;
  /** Rencana baris (dibuat + dilewati) untuk ditampilkan di pratinjau. */
  credentials: RegistrasiCredential[];
  skipped: RegistrasiSkipRow[];
  /** Username rencana per rowKey; commit memakai nilai yang benar-benar dibuat. */
  plannedUsernames: Record<string, string>;
  groups: RegistrasiBranchGroup[];
  reunionId: string | null;
};

/** Payload yang disimpan di `ImportBatch.reportJson` (type REGISTRASI). */
export type RegistrasiImportBatchPayload = {
  filename: string;
  data: ParsedRegistrasi;
  errors: RegistrasiValidationError[];
  warnings: string[];
  credentials: RegistrasiCredential[];
  skipped: RegistrasiSkipRow[];
  counts: RegistrasiCounts;
  plannedUsernames?: Record<string, string>;
  reunionId?: string | null;
};
