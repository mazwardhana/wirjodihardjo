import { MAX_IMPORT_BYTES } from "@/lib/import/types";

/**
 * Kontrak bersama untuk impor/ekspor GEDCOM 5.5.1.
 *
 * Alur impor mengikuti pola impor registrasi (parser → validasi → rencana →
 * pratinjau → commit) tetapi tanpa membuat akun User, karena data silsilah
 * GEDCOM hanya membawa data orang, bukan kredensial. Commit berjalan lewat
 * batas `ImportBatch` yang sama agar ada jejak audit.
 */

/** Jenis batch pada `ImportBatch.type` untuk format GEDCOM. */
export const GEDCOM_IMPORT_TYPE = "GEDCOM";

/** Batas ukuran berkas GEDCOM: samakan dengan batas impor umum (10MB). */
export const MAX_GEDCOM_BYTES = MAX_IMPORT_BYTES;

export type GedcomGender = "MALE" | "FEMALE" | "OTHER";

/** Satu catatan INDI hasil parse. */
export type GedcomPerson = {
  gedcomId: string;
  fullName: string;
  givenName?: string;
  surname?: string;
  nickname?: string;
  gender: GedcomGender;
  birthDateRaw?: string;
  birthDate: Date | null;
  birthPlace?: string;
  deathDateRaw?: string;
  deathDate: Date | null;
  deathPlace?: string;
  isDeceased: boolean;
  occupation?: string;
  notes?: string;
};

/** Satu catatan FAM hasil parse; referensi berupa gedcomId string. */
export type GedcomFamily = {
  gedcomId: string;
  husband?: string;
  wife?: string;
  children: string[];
  marriageDateRaw?: string;
  marriageDate: Date | null;
  divorceDateRaw?: string;
  divorceDate: Date | null;
  status: "MARRIED" | "DIVORCED" | "WIDOWED" | "UNKNOWN";
  notes?: string;
};

export type GedcomParseResult = {
  persons: GedcomPerson[];
  families: GedcomFamily[];
  charSet: string;
  sourceName?: string;
  /** Peringatan dari parser (mis. SEX tidak dikenal, lewat ke validasi). */
  warnings?: string[];
};

/** Baris rencana impor: data orang + metadata baris/branch. */
export type GedcomImportRow = GedcomPerson & {
  _line?: number;
  branchId?: string;
};

export type GedcomValidationError = {
  record: string;
  line?: number;
  field: string;
  message: string;
};

export type GedcomValidationResult = {
  valid: boolean;
  errors: GedcomValidationError[];
  warnings: string[];
  data: GedcomParseResult;
};

/** Satu baris rencana per orang untuk pratinjau. */
export type GedcomPlanPerson = {
  gedcomId: string;
  fullName: string;
  gender: GedcomGender;
  willCreate: boolean;
  duplicateOf?: string;
  reason?: string;
};

export type GedcomPlan = {
  personsCreated: number;
  personsSkipped: number;
  childEdgesCreated: number;
  partnerEdgesCreated: number;
  errors: GedcomValidationError[];
  warnings: string[];
  persons: GedcomPlanPerson[];
};

/** Payload yang disimpan di `ImportBatch.reportJson` (type GEDCOM). */
export type GedcomBatchPayload = {
  filename: string;
  charSet: string;
  data: GedcomParseResult;
  errors: GedcomValidationError[];
  warnings: string[];
  counts: {
    total: number;
    personsCreated: number;
    personsSkipped: number;
    childEdgesCreated: number;
    partnerEdgesCreated: number;
  };

  /** Snapshot rencana per orang (sebelum commit) — dipakai ringkasan & audit. */
  planPersons?: GedcomPlanPerson[];
  /** ID Person yang benar-benar dibuat saat commit (dipakai rollback). */
  createdPersonIds?: string[];
  /** ID PersonChild yang dibuat saat commit (dipakai rollback). */
  createdChildEdgeIds?: string[];
  /** ID PersonPartner yang dibuat saat commit (dipakai rollback). */
  createdPartnerEdgeIds?: string[];
};

/** Satu baris pratinjau tampilan. */
export type GedcomPreviewRow = {
  gedcomId: string;
  fullName: string;
  gender: GedcomGender;
  birthDateRaw?: string;
  birthDate: Date | null;
  birthPlace?: string;
  deathDate: Date | null;
  isDeceased: boolean;
  status: "baru" | "dilewati";
  reason?: string;
};
