import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAMILY_EVENT_TYPE_LABEL } from "@/lib/calendar";
import { EventCreateModal } from "@/components/admin/EventModals";
import { RSVP_STATUS_LABEL } from "@/lib/rsvp";
import { EventRowActions } from "@/components/admin/EventRowActions";
import type { FamilyEventType } from "@prisma/client";

const typeStyle: Record<FamilyEventType, string> = {
  MILAD: "bg-gold/15 text-gold-deep",
  HAUL: "bg-wood/15 text-wood",
  REUNI: "bg-forest/10 text-forest",
  HALAL_BIHALAL: "bg-emerald-100 text-emerald-800",
  LAINNYA: "bg-ink/10 text-ink",
};

type RsvpRow = {
  status: keyof typeof RSVP_STATUS_LABEL;
  user: { person: { fullName: string } | null } | null;
};

function rsvpTotal(rsvps: RsvpRow[]): number {
  return rsvps.length;
}

/** Rekap RSVP per status (GOING/MAYBE/NOT_GOING) beserta nama peserta. */
function RsvpRekap({ rsvps }: { rsvps: RsvpRow[] }) {
  if (rsvps.length === 0) {
    return <p className="mt-2 text-xs text-muted">Belum ada RSVP.</p>;
  }
  const perStatus = (["GOING", "MAYBE", "NOT_GOING"] as const).map((status) => {
    const rows = rsvps.filter((r) => r.status === status);
    return { status, count: rows.length, names: rows.map((r) => r.user?.person?.fullName).filter(Boolean) as string[] };
  });
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-wood/15 pt-3 text-xs sm:grid-cols-3">
      {perStatus.map(({ status, count, names }) => (
        <div key={status}>
          <dt className="font-medium text-forest">
            {RSVP_STATUS_LABEL[status]}: <span className="tabular-nums">{count}</span>
          </dt>
          <dd className="mt-0.5 text-muted">
            {names.length > 0 ? names.join(", ") : "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminKalenderPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const events = await prisma.familyEvent.findMany({
    orderBy: { startsAt: "desc" },
    include: {
      rsvps: {
        orderBy: { createdAt: "desc" },
        select: { status: true, user: { select: { person: { select: { fullName: true } } } } },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">Kalender Keluarga</h1>
          <p className="mt-1 text-sm text-muted">
            Kelola milad, haul, reuni, dan acara keluarga. Terbitkan agar member melihatnya.
          </p>
        </div>
        <EventCreateModal />
      </div>

      {events.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Belum ada event"
            description="Tambahkan event keluarga pertama: milad, haul, reuni, atau halal bihalal."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-wood/20 bg-cream p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${typeStyle[event.type]}`}>
                      {FAMILY_EVENT_TYPE_LABEL[event.type]}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        event.isPublished ? "bg-forest/10 text-forest" : "bg-muted/10 text-muted"
                      }`}
                    >
                      {event.isPublished ? "Terbit" : "Draft"}
                    </span>
                    {event.repeatYearly && (
                      <span className="rounded bg-gold/10 px-2 py-0.5 text-xs text-gold-deep">
                        Berulang tahunan
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-semibold text-forest">{event.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(event.startsAt)}
                    {event.locationName ? ` · ${event.locationName}` : ""}
                    {` · ${rsvpTotal(event.rsvps)} RSVP`}
                  </p>
                  <RsvpRekap rsvps={event.rsvps} />
                </div>
                <EventRowActions
                  event={{
                    id: event.id,
                    title: event.title,
                    type: event.type,
                    startsAt: event.startsAt.toISOString(),
                    endsAt: event.endsAt ? event.endsAt.toISOString() : null,
                    locationName: event.locationName,
                    description: event.description,
                    repeatYearly: event.repeatYearly,
                    isPublished: event.isPublished,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}