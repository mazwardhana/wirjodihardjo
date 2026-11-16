import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { occurrenceForYear, localDateKey, nextOccurrenceOnOrAfter } from "@/lib/calendar";

// GET: event published untuk kalender bulanan / daftar agenda.
// Query: year, month (1..12), agenda=1 untuk daftar mendatang.
export async function GET(request: Request) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const agenda = searchParams.get("agenda") === "1";
  const now = new Date();

  const events = await prisma.familyEvent.findMany({
    where: { isPublished: true },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      description: true,
      startsAt: true,
      endsAt: true,
      locationName: true,
      repeatYearly: true,
      slug: true,
      isPublished: true,
    },
  });

  if (agenda) {
    // Agenda mendatang: urutkan berdasarkan perayaan berikutnya.
    const agendaList = events
      .map((e) => ({ ...e, occurrence: nextOccurrenceOnOrAfter(e.startsAt, e.repeatYearly, now) }))
      .filter((e) => e.occurrence >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())
      .slice(0, 20);

    // Sertakan RSVP milik user bila login.
    const userId = session?.user?.id;
    let rsvps: Record<string, string> = {};
    if (userId && agendaList.length > 0) {
      const myRsvps = await prisma.familyEventRsvp.findMany({
        where: { userId, eventId: { in: agendaList.map((e) => e.id) } },
        select: { eventId: true, status: true },
      });
      rsvps = Object.fromEntries(myRsvps.map((r) => [r.eventId, r.status]));
    }
    return NextResponse.json(agendaList.map((e) => ({ ...e, rsvp: rsvps[e.id] ?? null })));
  }

  // Filter bulan bila diberikan.
  let monthEvents = events;
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  if (yearParam && monthParam) {
    const y = parseInt(yearParam, 10);
    const m = parseInt(monthParam, 10) - 1;
    const from = localDateKey(new Date(y, m, 1));
    const to = localDateKey(new Date(y, m + 1, 0));
    monthEvents = events.filter((e) => {
      if (e.repeatYearly) {
        const occ = occurrenceForYear(e.startsAt, true, y);
        const k = localDateKey(occ);
        return k >= from && k <= to;
      }
      const k = localDateKey(e.startsAt);
      return k >= from && k <= to;
    });
  }

  const userId = session?.user?.id;
  let rsvps: Record<string, string> = {};
  if (userId && monthEvents.length > 0) {
    const myRsvps = await prisma.familyEventRsvp.findMany({
      where: { userId, eventId: { in: monthEvents.map((e) => e.id) } },
      select: { eventId: true, status: true },
    });
    rsvps = Object.fromEntries(myRsvps.map((r) => [r.eventId, r.status]));
  }

  return NextResponse.json(monthEvents.map((e) => ({ ...e, rsvp: rsvps[e.id] ?? null })));
}