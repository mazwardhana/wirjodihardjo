"use client";

import { FiBookOpen, FiBriefcase, FiFeather, FiHeart, FiMapPin, FiUser } from "react-icons/fi";
import type { IconType } from "react-icons";
import type { DatePrecision, TimelineKind } from "@/lib/timeline";

// Tanggal sudah string ISO dari server; tipe date dibuat serializable supaya
// komponen ini aman dipakai di client component tanpa menyentuh Prisma.
export type TimelineEventView = Omit<import("@/lib/timeline").TimelineEvent, "date"> & {
  date: string | null;
};

const ICONS: Record<TimelineKind, IconType> = {
  BIRTH: FiUser,
  DEATH: FiFeather,
  EDUCATION: FiBookOpen,
  MARRIAGE: FiHeart,
  OCCUPATION: FiBriefcase,
  CUSTOM: FiMapPin,
};

// Format dari potongan ISO, bukan new Date(), supaya hari tidak bergeser
// oleh zona waktu penonton (toISOString selalu UTC).
function dateParts(iso: string, precision: DatePrecision): { label: string; dateTime: string } {
  const year = iso.slice(0, 4);
  const monthName = MONTHS_ID[Number(iso.slice(5, 7)) - 1] ?? "";
  if (precision === "YEAR") return { label: year, dateTime: year };
  if (precision === "MONTH") return { label: `${monthName} ${year}`, dateTime: iso.slice(0, 7) };
  return { label: `${Number(iso.slice(8, 10))} ${monthName} ${year}`, dateTime: iso.slice(0, 10) };
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Garis waktu vertikal peristiwa hidup. Tanggal di kolom kiri berlebar tetap
 * agar kartu kanan sejajar rapi lintas baris.
 */
export function TimelinePanel({ events }: { events: TimelineEventView[] }) {
  return (
    <section className="rounded-lg border border-wood/15 bg-cream p-4 sm:p-6">
      <h2 className="font-display text-lg font-semibold text-forest">Jejak Hidup</h2>
      <p className="mt-1 text-sm text-muted">Peristiwa yang membentuk perjalanan hidupnya.</p>

      {events.length === 0 ? (
        <div className="mt-4 rounded-md border border-wood/20 px-6 py-10 text-center">
          <p className="text-sm text-muted">Belum ada peristiwa hidup yang tercatat.</p>
        </div>
      ) : (
        <ol role="list" className="mt-4">
          {events.map((event, index) => {
            const Icon = ICONS[event.kind];
            const parts = event.date ? dateParts(event.date, event.datePrecision) : null;
            const isLast = index === events.length - 1;
            return (
              <li key={event.key} className="flex gap-3">
                <div className="w-20 shrink-0 pt-4 text-right text-sm tabular-nums text-muted">
                  {parts ? <time dateTime={parts.dateTime}>{parts.label}</time> : <span>Tanpa tanggal</span>}
                </div>
                <div className="relative flex w-4 shrink-0 justify-center">
                  {!isLast && <div className="absolute inset-y-0 border-l border-wood/30" aria-hidden="true" />}
                  <div className="relative z-10 mt-4 size-2.5 shrink-0 self-start rounded-full bg-gold" aria-hidden="true" />
                </div>
                <article className="mb-4 min-w-0 grow rounded-md border border-wood/20 bg-cream/60 p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-wood" aria-hidden="true" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-ink">{event.title}</h3>
                      {event.description && <p className="mt-1 text-sm text-muted">{event.description}</p>}
                      {event.locationName && <p className="mt-1 text-sm text-muted">{event.locationName}</p>}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
