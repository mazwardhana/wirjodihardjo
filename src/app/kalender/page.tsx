import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { occurrenceForYear, localDateKey } from "@/lib/calendar";
import { KalenderClient } from "@/components/kalender/KalenderClient";

export const dynamic = "force-dynamic";

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
  const month = sp.month ? parseInt(sp.month, 10) - 1 : now.getMonth();

  const events = await prisma.familyEvent.findMany({
    where: { isPublished: true },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      startsAt: true,
      endsAt: true,
      locationName: true,
      repeatYearly: true,
      slug: true,
    },
  });

  const myRsvps = await prisma.familyEventRsvp.findMany({
    where: { userId: session.user.id, eventId: { in: events.map((e) => e.id) } },
    select: { eventId: true, status: true },
  });
  const rsvpMap = new Map(myRsvps.map((r) => [r.eventId, r.status]));

  // EventSummary (props client) memakai string ISO, bukan objek Date.
  const eventsWithRsvp = events.map((e) => ({
    ...e,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    rsvp: rsvpMap.get(e.id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="font-display text-sm font-medium tracking-wide text-gold-deep">Keluarga</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
        Kalender Keluarga
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Milad, haul, reuni, dan acara keluarga lainnya dalam satu kalender. Anda dapat
        menandai kehadiran dan menerima pengingat otomatis.
      </p>

      <div className="mt-8">
        <KalenderClient initialYear={year} initialMonth={month} initialEvents={eventsWithRsvp} />
      </div>
    </div>
  );
}