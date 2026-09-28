export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ParentRole = "FATHER" | "MOTHER" | "UNKNOWN";
export type PartnerStatus = "MARRIED" | "DIVORCED" | "WIDOWED" | "UNKNOWN";
export type UserRole = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";
export type RelationKind = "ORANG_TUA" | "PASANGAN";

/**
 * Satu baris data anggota dari template impor 10 kolom.
 *
 * Kolom: kode cabang keluarga*, nickname*, password*, nama lengkap*, gender,
 * tempat kelahiran, tanggal lahir, nomor telepon, alamat domisili, kota domisili.
 */
export type ImportRowAnggota = {
  _row?: number;
  /** Nilai mentah kolom "kode cabang keluarga": nomor cabang (1-10) atau nama cabang. */
  cabangKe: string;
  /** Kolom "nama lengkap" (wajib). */
  namaLengkap: string;
  /** Kolom "nickname" (wajib); dipakai untuk menurunkan username. */
  namaPanggilan?: string;
  /** Kolom "gender"; kosong → OTHER + warning. */
  jenisKelamin: Gender;
  /** Kolom "tempat kelahiran" → Person.birthPlace. */
  tempatLahir?: string;
  /** Kolom "tanggal lahir" (YYYY-MM-DD atau DD/MM/YYYY) → Person.birthDate. */
  tanggalLahir?: string;
  /** Kolom "nomor telepon" → PersonPrivate.phone. */
  nomorTelepon?: string;
  /** Kolom "alamat domisili" → PersonPrivate.addressLine. */
  alamatDomisili?: string;
  /** Kolom "kota domisili" → PersonPrivate.city. */
  kotaDomisili?: string;
  /**
   * Password plaintext dari berkas. Hanya ada di memori selama request unggah;
   * tidak pernah disimpan ke database maupun dikirim di response.
   */
  password?: string;
  /** Hash bcrypt password. Disimpan di payload batch agar commit tidak perlu plaintext. */
  passwordHash?: string;
  /** Hasil resolusi cabang saat validasi (diisi `validateImportData`). */
  branchId?: string;
  /** Nomor cabang hasil resolusi (diisi `validateImportData`). */
  branchNumber?: number;
};

export type ImportRowRelasi = {
  _row?: number;
  jenisRelasi: RelationKind;
  refOrang: string;
  refTarget: string;
  peranOrangTua?: ParentRole;
  adopsi?: string;
  tiri?: string;
  tanggalMenikah?: string;
  statusPasangan?: PartnerStatus;
};

export type ImportRowAkun = {
  _row?: number;
  ref: string;
  email: string;
  peran: UserRole;
};

export type ValidationError = {
  sheet: "Anggota" | "Relasi" | "Akun" | "Data";
  row: number;
  field: string;
  message: string;
};

export type ParsedData = {
  anggota: ImportRowAnggota[];
  relasi?: ImportRowRelasi[];
  akun?: ImportRowAkun[];
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  data: ParsedData;
};

export type ImportCounts = {
  anggota: number;
  relasi: number;
  akun: number;
  personsCreated: number;
  personsUpdated: number;
  accountsCreated: number;
  accountsUpdated: number;
  childEdgesCreated: number;
  partnerEdgesCreated: number;
  privateUpserts: number;
  rowsSkipped: number;
};

/** Satu baris laporan kredensial: username dan status pembuatan akun. */
export type ImportCredential = {
  fullName: string;
  /** Username hasil turunan nickname; kosong bila baris dilewati. */
  username: string;
  role: UserRole;
  isNew: boolean;
  status: string;
};

/** Baris yang dilewati karena sudah ada di database. */
export type ImportSkipRow = {
  fullName: string;
  branchNumber: number;
  reason: string;
};

export type ImportReport = {
  filename: string;
  status: "VALIDATED" | "COMMITTED" | "PARTIAL" | "FAILED";
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: ValidationError[];
  warnings: string[];
  counts: ImportCounts;
  credentials: ImportCredential[];
  skipped: ImportSkipRow[];
  preview?: ParsedData;
};

/** Payload yang disimpan di `ImportBatch.reportJson` agar commit tidak perlu upload ulang. */
export type ImportBatchPayload = {
  filename: string;
  data: ParsedData;
  errors: ValidationError[];
  warnings: string[];
  credentials: ImportCredential[];
  skipped: ImportSkipRow[];
  counts: ImportCounts;
};

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10MB
