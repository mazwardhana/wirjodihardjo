// Logika murni untuk garis waktu hidup per orang. Sengaja tanpa Prisma agar
// bisa dipakai bersama oleh route API dan server component, serta mudah diuji.

export type TimelineKind =
  | "BIRTH"
  | "DEATH"
  | "EDUCATION"
  | "MARRIAGE"
  | "CUSTOM"
  | "OCCUPATION";

export type DatePrecision = "DAY" | "MONTH" | "YEAR";

export type TimelineEvent = {
  key: string; // stabil: "birth" | "death" | `event:${id}` | `edu:${id}`
  kind: TimelineKind;
  title: string;
  description: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  date: Date | null;
  datePrecision: DatePrecision;
  year: number | null;
  source: "person" | "life-event" | "education";
};

export type TimelinePoint = {
  name: string;
  latitude: number;
  longitude: number;
  kind: TimelineKind;
  year: number | null;
};

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const KINDS: TimelineKind[] = ["BIRTH", "DEATH", "EDUCATION", "MARRIAGE", "CUSTOM", "OCCUPATION"];

function toKind(kind: string): TimelineKind {
  return (KINDS as string[]).includes(kind) ? (kind as TimelineKind) : "CUSTOM";
}

// Precision di DB boleh null atau di luar enum; jangan mengarang hari/bulan
// yang tidak ada datanya, jadi fallback mengikuti kelengkapan tanggal.
function toPrecision(value: string | null | undefined, date: Date | null): DatePrecision {
  if (value === "DAY" || value === "MONTH" || value === "YEAR") return value;
  return date ? "DAY" : "YEAR";
}

function toYear(date: Date | null): number | null {
  return date ? date.getFullYear() : null;
}

export function formatTimelineDate(date: Date | null, precision: DatePrecision): string | null {
  if (!date) return null;
  if (precision === "YEAR") return String(date.getFullYear());
  const month = MONTHS_ID[date.getMonth()];
  if (precision === "MONTH") return `${month} ${date.getFullYear()}`;
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

// Titik peta diturunkan dari event supaya filter privasi cukup menyaring
// event sekali, lalu peta otomatis mengikuti event yang lolos.
export function buildTimelinePoints(events: TimelineEvent[]): TimelinePoint[] {
  const seen = new Set<string>();
  const points: TimelinePoint[] = [];
  for (const event of events) {
    if (event.latitude === null || event.longitude === null) continue;
    const key = `${event.latitude.toFixed(3)},${event.longitude.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({
      name: event.locationName ?? event.title,
      latitude: event.latitude,
      longitude: event.longitude,
      kind: event.kind,
      year: event.year,
    });
  }
  return points;
}

export function buildLifeTimeline(input: {
  person: {
    id: string;
    birthDate: Date | null;
    birthPlace: string | null;
    deathDate: Date | null;
    deathPlace: string | null;
    isDeceased: boolean;
  };
  lifeEvents: Array<{
    id: string;
    kind: string;
    title: string;
    description: string | null;
    locationName: string | null;
    latitude: number | null;
    longitude: number | null;
    date: Date | null;
    datePrecision: string | null;
  }>;
  education: Array<{
    id: string;
    institution: string;
    degree: string | null;
    fieldOfStudy: string | null;
    startYear: number | null;
    endYear: number | null;
  }>;
}): { events: TimelineEvent[]; points: TimelinePoint[] } {
  const { person } = input;
  const events: TimelineEvent[] = [];

  // Normalisasi undefined menjadi null: pemanggil boleh meneruskan objek
  // parsial, dan undefined tidak boleh dianggap "ada data".
  const birthDate = person.birthDate ?? null;
  const birthPlace = person.birthPlace ?? null;
  const deathDate = person.deathDate ?? null;
  const deathPlace = person.deathPlace ?? null;

  // Event virtual LAHIR/WAFAT dibangun dari data inti Person. Tanggal pasti
  // dianggap presisi DAY; kalau hanya tempat yang tahu, YEAR tanpa mengarang.
  const hasBirth = birthDate !== null || birthPlace !== null;
  if (hasBirth) {
    events.push({
      key: "birth",
      kind: "BIRTH",
      title: "Lahir",
      description: null,
      locationName: birthPlace,
      latitude: null,
      longitude: null,
      date: birthDate,
      datePrecision: birthDate ? "DAY" : "YEAR",
      year: toYear(birthDate),
      source: "person",
    });
  }

  const hasDeath = person.isDeceased || deathDate !== null || deathPlace !== null;
  if (hasDeath) {
    events.push({
      key: "death",
      kind: "DEATH",
      title: "Wafat",
      description: null,
      locationName: deathPlace,
      latitude: null,
      longitude: null,
      date: deathDate,
      datePrecision: deathDate ? "DAY" : "YEAR",
      year: toYear(deathDate),
      source: "person",
    });
  }

  for (const life of input.lifeEvents) {
    // Dedupe: life-event BIRTH/DEATH redundan dengan event virtual. Bila
    // virtualnya tidak ada (data lahir/wafat kosong), pakai apa adanya.
    if (life.kind === "BIRTH" && hasBirth) continue;
    if (life.kind === "DEATH" && hasDeath) continue;
    events.push({
      key: `event:${life.id}`,
      kind: toKind(life.kind),
      title: life.title,
      description: life.description,
      locationName: life.locationName,
      latitude: life.latitude,
      longitude: life.longitude,
      date: life.date,
      datePrecision: toPrecision(life.datePrecision, life.date),
      year: toYear(life.date),
      source: "life-event",
    });
  }

  for (const edu of input.education) {
    // Hanya tahun yang diketahui, jadi tanggal dipatok 1 Januari dengan
    // presisi YEAR agar tidak seolah-olah hari/bulannya diketahui.
    const date = edu.startYear !== null ? new Date(edu.startYear, 0, 1) : null;
    events.push({
      key: `edu:${edu.id}`,
      kind: "EDUCATION",
      title: edu.degree ? `${edu.institution} (${edu.degree})` : edu.institution,
      description: edu.fieldOfStudy,
      locationName: null,
      latitude: null,
      longitude: null,
      date,
      datePrecision: "YEAR",
      year: toYear(date),
      source: "education",
    });
  }

  // Bertanggal naik lebih dulu supaya garis waktu terbaca kronologis;
  // yang tanpa tanggal ditaruh di ekor agar tidak memotong alur.
  const dated = events
    .filter((e) => e.date !== null)
    .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
  const undated = events
    .filter((e) => e.date === null)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));

  const sorted = [...dated, ...undated];
  return { events: sorted, points: buildTimelinePoints(sorted) };
}
