"use client";

import { useMemo, useState } from "react";
import { buildMonthCells, FAMILY_EVENT_TYPE_LABEL, localDateKey } from "@/lib/calendar";
import type { FamilyEventType } from "@prisma/client";

export type EventSummary = {
  id: string;
  title: string;
  type: FamilyEventType;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  repeatYearly: boolean;
  slug: string;
  rsvp: "GOING" | "MAYBE" | "NOT_GOING" | null;
};

export type RsvpStatus = "GOING" | "MAYBE" | "NOT_GOING";

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export const TYPE_STYLE: Record<FamilyEventType, string> = {
  MILAD: "bg-gold/15 text-gold-deep",
  HAUL: "bg-wood/15 text-wood",
  REUNI: "bg-forest/10 text-forest",
  HALAL_BIHALAL: "bg-emerald-100 text-emerald-800",
  LAINNYA: "bg-ink/10 text-ink",
};

function eventOnDate(e: EventSummary, date: Date): boolean {
  if (e.repeatYearly) {
    const starts = new Date(e.startsAt);
    return starts.getDate() === date.getDate() && starts.getMonth() === date.getMonth();
  }
  const d = new Date(e.startsAt);
  return localDateKey(d) === localDateKey(date);
}

export function CalendarGrid({
  monthEvents,
  year,
  month,
  onSelect,
  selectedId,
}: {
  monthEvents: EventSummary[];
  year: number;
  month: number;
  onSelect: (e: EventSummary) => void;
  selectedId: string | null;
}) {
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  return (
    <div className="overflow-hidden rounded-lg border border-wood/20 bg-cream">
      <div className="grid grid-cols-7 border-b border-wood/20 bg-parchment/60">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-1 py-2 text-center text-xs font-semibold text-muted sm:text-sm">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="min-h-16 border-b border-r border-wood/10 sm:min-h-20" />;
          }
          const date = cell.date;
          const dayEvents = monthEvents.filter((e) => eventOnDate(e, date));
          const isToday = localDateKey(date) === localDateKey(new Date());
          return (
            <div
              key={cell.key}
              className={`min-h-16 border-b border-r border-wood/10 p-1 sm:min-h-20 sm:p-1.5 ${
                isToday ? "bg-gold/5" : ""
              }`}
            >
              <div
                className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-forest text-cream" : "text-forest"
                }`}
              >
                {date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelect(e)}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest sm:text-xs ${
                      TYPE_STYLE[e.type]
                    } ${selectedId === e.id ? "ring-2 ring-forest/40" : ""}`}
                    title={e.title}
                  >
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] text-muted">+{dayEvents.length - 2} lagi</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AgendaList({
  events,
  onSelect,
  selectedId,
}: {
  events: EventSummary[];
  onSelect: (e: EventSummary) => void;
  selectedId: string | null;
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-4 py-6 text-center text-sm text-muted">
        Belum ada agenda pada bulan ini.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onSelect(e)}
            className={`flex w-full items-start gap-3 rounded-lg border bg-cream p-3 text-left transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
              selectedId === e.id ? "border-forest/60" : "border-wood/20"
            }`}
          >
            <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${TYPE_STYLE[e.type]}`}>
              {FAMILY_EVENT_TYPE_LABEL[e.type]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-forest">{e.title}</span>
              <span className="block text-xs text-muted">
                {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(e.startsAt))}
                {e.locationName ? ` · ${e.locationName}` : ""}
              </span>
              {e.rsvp && (
                <span className="mt-0.5 block text-xs font-medium text-gold-deep">
                  RSVP: {e.rsvp === "GOING" ? "Hadir" : e.rsvp === "MAYBE" ? "Mungkin" : "Tidak hadir"}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function RsvpBar({
  event,
  onRsvp,
  busy,
}: {
  event: EventSummary | null;
  onRsvp: (id: string, status: RsvpStatus) => void;
  busy: boolean;
}) {
  if (!event) {
    return (
      <div className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 p-4 text-center text-sm text-muted">
        Pilih event untuk mengatur kehadiran.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-wood/20 bg-cream p-4">
      <p className="text-sm font-semibold text-forest">{event.title}</p>
      <p className="mt-1 text-xs text-muted">
        {new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date(event.startsAt))}
        {event.locationName ? ` · ${event.locationName}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["GOING", "Hadir"],
            ["MAYBE", "Mungkin"],
            ["NOT_GOING", "Tidak Hadir"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={busy}
            onClick={() => onRsvp(event.id, value)}
            className={`min-h-11 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
              event.rsvp === value ? "bg-forest text-cream" : "border border-wood/30 text-forest hover:bg-forest/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function useCalendarMonth(initialYear: number, initialMonth: number) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  function prev() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }
  return { year, month, prev, next, setYear, setMonth };
}