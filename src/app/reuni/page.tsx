import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";

// Jadwal reuni dibaca langsung dari basis data saat diminta.
export const dynamic = "force-dynamic";

export default async function ReuniPage() {
  const session = await auth();

  const reunions = await prisma.reunion.findMany({
    where: { status: "PUBLISHED" },
    include: {
      _count: { select: { registrations: true } },
    },
    orderBy: { startAt: "asc" },
  });

  const upcoming = reunions.filter((r) => new Date(r.startAt) > new Date());
  const past = reunions.filter((r) => new Date(r.startAt) <= new Date());

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
        Silaturahmi
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
        Reuni Keluarga
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Jadwal pertemuan keluarga yang akan datang dan arsip reuni sebelumnya.
        Pendaftaran tersedia untuk anggota yang sudah login.
      </p>

      {reunions.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada reuni dijadwalkan"
            description="Pantau terus halaman ini untuk informasi reuni mendatang."
          />
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section aria-label="Reuni mendatang" className="mt-10">
              <h2 className="font-display text-xl font-semibold text-forest">
                Akan Datang
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {upcoming.map((reunion) => (
                  <Link
                    key={reunion.id}
                    href={`/reuni/${reunion.slug}`}
                    className="rounded-lg border border-wood/20 bg-cream p-5 transition-colors hover:border-gold/60"
                  >
                    <h3 className="font-display text-lg font-semibold text-forest">
                      {reunion.title}
                    </h3>
                    <p className="mt-1 text-sm text-wood">
                      {formatDate(reunion.startAt)}
                      {reunion.endAt && ` - ${formatDate(reunion.endAt)}`}
                    </p>
                    {reunion.locationName && (
                      <p className="text-sm text-muted">{reunion.locationName}</p>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      {reunion._count.registrations} peserta terdaftar
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section aria-label="Arsip reuni" className="mt-14">
              <h2 className="font-display text-xl font-semibold text-forest">
                Reuni Sebelumnya
              </h2>
              <ul className="mt-4 space-y-3">
                {past.map((reunion) => (
                  <li key={reunion.id}>
                    <Link
                      href={`/reuni/${reunion.slug}`}
                      className="flex items-center justify-between rounded-lg border border-wood/15 bg-parchment/40 p-4 transition-colors hover:border-wood/30"
                    >
                      <div>
                        <p className="font-semibold text-forest">
                          {reunion.title}
                        </p>
                        <p className="text-sm text-muted">
                          {formatDate(reunion.startAt)}
                        </p>
                      </div>
                      <span className="text-xs text-muted">Arsip</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}