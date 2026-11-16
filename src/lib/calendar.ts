import type { FamilyEventType } from "@prisma/client";

/**
 * Label ramah untuk tipe event keluarga.
 */
export const FAMILY_EVENT_TYPE_LABEL: Record<FamilyEventType, string> = {
  MILAD: "Milad",
  HAUL: "Haul",
  REUNI: "Reuni",
  HALAL_BIHALAL: "Halal Bihalal",
  LAINNYA: "Lainnya",
};

export const FAMILY_EVENT_TYPES = Object.keys(FAMILY_EVENT_TYPE_LABEL) as FamilyEventType[];

export type FamilyEventTypeOption = {
  value: FamilyEventType;
  label: string;
};

export const FAMILY_EVENT_TYPE_OPTIONS: FamilyEventTypeOption[] = FAMILY_EVENT_TYPES.map(
  (value) => ({ value, label: FAMILY_EVENT_TYPE_LABEL[value] }),
);

/** Kunci tahun-bulan (0-based) dari sebuah tanggal lokal, mis. "2027-3". */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Tanggal "YYYY-MM-DD" lokal (tanpa konversi zona). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Tanggal perayaan berlaku untuk `event`.
 * - repeatYearly=false → `startsAt` apa adanya.
 * - repeatYearly=true → tanggal yang sama di tahun `year` (tanggal makna
 *   disimpan di startsAt; perayaan dihitung ulang tiap tahun).
 * Feb 29 dilandasi ke 28 Feb pada tahun non-kabisat.
 */
export function occurrenceForYear(
  startsAt: Date,
  repeatYearly: boolean,
  year: number,
): Date {
  if (!repeatYearly) return startsAt;
  const base = new Date(startsAt);
  const month = base.getMonth();
  const day = base.getDate();
  const candidate = new Date(year, month, day);
  // Kalau tanggal bergeser ke bulan berikutnya (29 Feb → 1 Mar), mundur.
  if (candidate.getMonth() !== month) {
    return new Date(year, month + 1, 0);
  }
  return candidate;
}

/**
 * Daftar sel grid kalender bulanan.
 * `firstDay` = hari pertama bulan (0=Minggu). Grid di mulai dari hari Senin,
 * jadi offset = (firstDay + 6) % 7.
 */
export type CalendarCell = {
  date: Date | null; // null untuk sel kosong di awal/akhir
  inMonth: boolean;
  key: string;
};

export function buildMonthCells(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (first.getDay() + 6) % 7; // 0=Senin → offset 0

  const cells: CalendarCell[] = [];
  for (let i = 0; i < mondayOffset; i++) {
    cells.push({ date: null, inMonth: false, key: `blank-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ date, inMonth: true, key: localDateKey(date) });
  }
  const totalCells = Math.ceil(cells.length / 7) * 7;
  for (let i = cells.length; i < totalCells; i++) {
    cells.push({ date: null, inMonth: false, key: `blank-end-${i}` });
  }
  return cells;
}

/**
 * Hitung tanggal perayaan event dalam window [from, to] (inklusif).
 * Untuk event tidak berulang: hanya bila startsAt berada di window.
 * Untuk repeatYearly: cek tahun-tahun yang berpotensi masuk window.
 */
export function occurrenceInWindow(
  startsAt: Date,
  repeatYearly: boolean,
  from: Date,
  to: Date,
): Date | null {
  const startKey = localDateKey(from);
  const endKey = localDateKey(to);

  if (!repeatYearly) {
    const k = localDateKey(startsAt);
    return k >= startKey && k <= endKey ? startsAt : null;
  }
  const startYear = from.getFullYear();
  const endYear = to.getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const occ = occurrenceForYear(startsAt, repeatYearly, y);
    const k = localDateKey(occ);
    if (k >= startKey && k <= endKey) return occ;
  }
  return null;
}

/** Tanggal perayaan berikutnya pada/ setelah `now` (untuk daftar agenda). */
export function nextOccurrenceOnOrAfter(
  startsAt: Date,
  repeatYearly: boolean,
  now: Date,
): Date {
  if (!repeatYearly) return startsAt;
  const nowKey = localDateKey(now);
  for (let y = now.getFullYear(); y <= now.getFullYear() + 2; y++) {
    const occ = occurrenceForYear(startsAt, repeatYearly, y);
    if (localDateKey(occ) >= nowKey) return occ;
  }
  return occurrenceForYear(startsAt, repeatYearly, now.getFullYear() + 1);
}