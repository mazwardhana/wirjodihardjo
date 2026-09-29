import type { SubmissionStatus, SubmissionType } from "@prisma/client";

/**
 * Satu sumber kebenaran label pengajuan untuk area member.
 * Enum di schema.prisma: PENDING | APPROVED | REJECTED | CANCELLED
 * (tidak ada CHANGES_REQUESTED). Semuanya dilabel di bawah ini sehingga
 * enum mentah tidak pernah sampai ke UI.
 */
export const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  ADD_CHILD: "Tambah Anak",
  ADD_SPOUSE: "Tambah Pasangan",
  ADD_PERSON: "Tambah Anggota",
  EDIT_PERSON: "Edit Anggota",
  EDIT_RELATION: "Edit Relasi",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  PENDING: "Tertunda",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

export const STATUS_BADGE_CLASSES: Record<SubmissionStatus, string> = {
  PENDING: "bg-gold/20 text-gold-deep",
  APPROVED: "bg-forest/10 text-forest",
  REJECTED: "bg-wood/10 text-wood",
  CANCELLED: "bg-muted/10 text-muted",
};

/** Label status apa pun; nilai tak terduga diubah jadi kata bacaan, bukan enum. */
export function submissionStatusLabel(
  status: SubmissionStatus | (string & {}),
): string {
  const known = (SUBMISSION_STATUS_LABELS as Record<string, string>)[status];
  return known ?? humanizeEnum(status);
}

/** Label tipe pengajuan apa pun. */
export function submissionTypeLabel(
  type: SubmissionType | (string & {}),
): string {
  const known = (SUBMISSION_TYPE_LABELS as Record<string, string>)[type];
  return known ?? humanizeEnum(type);
}

/** Kelas badge status; fallback netral bila status tak dikenali. */
export function statusBadgeClass(status: string): string {
  const known = (STATUS_BADGE_CLASSES as Record<string, string>)[status];
  return known ?? "bg-muted/10 text-muted";
}

function humanizeEnum(value: string): string {
  // "CHANGES_REQUESTED" menjadi "Changes Requested".
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
