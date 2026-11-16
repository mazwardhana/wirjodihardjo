"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/ui/States";
import { CalendarGrid, AgendaList, RsvpBar, useCalendarMonth, type EventSummary, type RsvpStatus } from "./KalenderComponents";

export function KalenderClient({
  initialYear,
  initialMonth,
  initialEvents,
}: {
  initialYear: number;
  initialMonth: number;
  initialEvents: EventSummary[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { year, month, prev, next } = useCalendarMonth(initialYear, initialMonth);

  const [events, setEvents] = useState<EventSummary[]>(initialEvents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  // Sinkronkan query ?year=&month= agar URL dapat di-bookmark & di-refresh.
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("year", String(year));
    p.set("month", String(month + 1));
    router.replace(`/kalender?${p.toString()}`, { scroll: false });
  }, [year, month, router, searchParams]);

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kalender?year=${y}&month=${m + 1}`);
      if (res.ok) {
        const data = (await res.json()) as EventSummary[];
        setEvents(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  const handleRsvp = useCallback(async (id: string, status: RsvpStatus) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/kalender/${id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      setEvents((prevEvents) => prevEvents.map((e) => (e.id === id ? { ...e, rsvp: status } : e)));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            className="min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            aria-label="Bulan sebelumnya"
          >
            ←
          </button>
          <h2 className="font-display text-xl font-semibold text-forest">
            {new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, month, 1))}
          </h2>
          <button
            type="button"
            onClick={next}
            className="min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            aria-label="Bulan berikutnya"
          >
            →
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Memuat kalender" />
      ) : (
        <CalendarGrid monthEvents={events} year={year} month={month} onSelect={(e) => setSelectedId(e.id)} selectedId={selectedId} />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-label="Agenda mendatang">
          <h3 className="font-display text-lg font-semibold text-forest">Agenda Bulan Ini</h3>
          <div className="mt-3">
            <AgendaList events={events} onSelect={(e) => setSelectedId(e.id)} selectedId={selectedId} />
          </div>
        </section>
        <aside className="lg:col-span-2" aria-label="Kehadiran">
          <h3 className="font-display text-lg font-semibold text-forest">Kehadiran</h3>
          <div className="mt-3">
            <RsvpBar event={selected} onRsvp={handleRsvp} busy={busy} />
          </div>
        </aside>
      </div>
    </div>
  );
}