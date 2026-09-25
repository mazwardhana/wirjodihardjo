import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function DashboardReuniPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const registrations = await prisma.reunionRegistration.findMany({
    where: { userId: session.user.id },
    include: {
      reunion: { select: { title: true, slug: true, startAt: true, locationName: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Reuni Saya</h1>

      {registrations.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum mendaftar reuni"
            description="Lihat jadwal reuni dan daftarkan diri Anda."
            action={
              <Link href="/reuni" className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream">
                Lihat Jadwal Reuni
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {registrations.map((r) => (
            <li key={r.id} className="rounded-lg border border-wood/15 bg-cream p-4">
              <Link href={`/reuni/${r.reunion.slug}`} className="font-semibold text-forest hover:text-gold-deep">
                {r.reunion.title}
              </Link>
              <p className="text-sm text-muted">{formatDate(r.reunion.startAt)}</p>
              <p className="text-sm text-wood">Status: {r.status === "CONFIRMED" ? "Terdaftar" : r.status === "CANCELLED" ? "Dibatalkan" : "Waitlist"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}