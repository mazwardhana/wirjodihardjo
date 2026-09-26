export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ParentRole = "FATHER" | "MOTHER" | "UNKNOWN";
export type PartnerStatus = "MARRIED" | "DIVORCED" | "WIDOWED" | "UNKNOWN";
export type UserRole = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";
export type RelationKind = "ORANG_TUA" | "PASANGAN";

export type ImportRowAnggota = {
  _row?: number;
  ref: string;
  namaLengkap: string;
  namaPanggilan?: string;
  jenisKelamin: Gender;
  tanggalLahir?: string;
  tempatLahir?: string;
  meninggal?: string;
  tanggalMeninggal?: string;
  bio?: string;
  cabang?: string;
  levelGenerasi?: string;
  telepon?: string;
  whatsapp?: string;
  email?: string;
  alamat?: string;
  kota?: string;
  provinsi?: string;
  kodePos?: string;
  statusPernikahan?: string;
  catatanKeluarga?: string;
};

export type ImportRowRelasi = {
  _row?: number;
  jenisRelasi: RelationKind;
  /** Ref anak (untuk ORANG_TUA) atau ref pasangan pertama (untuk PASANGAN). */
  refOrang: string;
  /** Ref orang tua (untuk ORANG_TUA) atau ref pasangan kedua (untuk PASANGAN). */
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
  sheet: "Anggota" | "Relasi" | "Akun";
  row: number;
  field: string;
  message: string;
};

export type ParsedData = {
  anggota: ImportRowAnggota[];
  relasi: ImportRowRelasi[];
  akun: ImportRowAkun[];
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
  defaultPassword: string;
  preview?: ParsedData;
};

export type ImportCredential = {
  ref: string;
  fullName: string;
  email: string;
  role: UserRole;
  isNew: boolean;
};

/** Payload yang disimpan di `ImportBatch.reportJson` agar commit tidak perlu upload ulang. */
export type ImportBatchPayload = {
  filename: string;
  data: ParsedData;
  errors: ValidationError[];
  warnings: string[];
  credentials: ImportCredential[];
  counts: ImportCounts;
};

export const DEFAULT_IMPORT_PASSWORD = "WD26";
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10MB
