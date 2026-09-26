export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ParentRole = "FATHER" | "MOTHER" | "UNKNOWN";
export type PartnerStatus = "MARRIED" | "DIVORCED" | "WIDOWED" | "UNKNOWN";
export type UserRole = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

export type ImportRowAnggota = {
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
  jenisRelasi: "ORANG_TUA" | "PASANGAN";
  refAnak?: string;
  refOrangTua?: string;
  peranOrangTua?: ParentRole;
  adopsi?: string;
  tiri?: string;
  refPasangan1?: string;
  refPasangan2?: string;
  statusPasangan?: PartnerStatus;
};

export type ImportRowAkun = {
  ref: string;
  email: string;
  peran: UserRole;
};

export type ValidationError = {
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

export type ImportReport = {
  filename: string;
  status: "VALIDATED" | "COMMITTED" | "PARTIAL" | "FAILED";
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: ValidationError[];
  warnings: string[];
  counts: {
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
