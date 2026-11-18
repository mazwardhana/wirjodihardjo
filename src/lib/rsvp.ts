import type { RsvpStatus } from "@prisma/client";

/** Label Indonesia untuk status RSVP acara keluarga. */
export const RSVP_STATUS_LABEL: Record<RsvpStatus, string> = {
  GOING: "Hadir",
  MAYBE: "Mungkin",
  NOT_GOING: "Tidak Hadir",
};

/** Urutan tampil status RSVP (untuk rekap per status). */
export const RSVP_STATUS_ORDER: RsvpStatus[] = ["GOING", "MAYBE", "NOT_GOING"];
