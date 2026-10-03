import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";

// Album dibaca langsung dari basis data saat diminta.
export const dynamic = "force-dynamic";

function yearOf(date: Date | null): string | null {
  return date ? String(date.getFullYear()) : null;
}

export default async function GaleriPage() {
  const albums = await prisma.album.findMany({
    where: { isPublished: true },
    include: {
      _count: { select: { media: { where: { status: "APPROVED" } } } },
      media: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
  });

  const totalPhotos = albums.reduce((sum, album) => sum + album._count.media, 0);
  const [lead, ...rest] = albums;
  const leadCover = lead?.coverImageUrl ?? lead?.media[0]?.url ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="border-b border-wood/20 pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="font-display text-4xl font-semibold text-forest sm:text-5xl">
            Galeri Keluarga
          </h1>
          {albums.length > 0 && (
            <p className="text-sm text-muted">
              {albums.length} album
              <span aria-hidden="true" className="px-2 text-wood/40">
                /
              </span>
              {totalPhotos} foto
            </p>
          )}
        </div>
        <p className="mt-4 max-w-2xl text-muted">
          Dokumentasi acara dan kenangan keluarga, disusun per album. Setiap
          album merangkum satu momen yang dirawat bersama.
        </p>
      </header>

      {albums.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada album"
            description="Album foto keluarga akan tampil di sini setelah admin menambahkannya."
          />
        </div>
      ) : (
        <>
          {/* Album utama: satu momen dibuka lebar seperti halaman majalah. */}
          <Reveal as="article" className="mt-10">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
              <Link
                href={`/galeri/${lead.slug}`}
                className="group relative block overflow-hidden rounded-sm bg-parchment lg:col-span-7"
                aria-label={`Buka album ${lead.title}`}
              >
                <div className="aspect-[4/3] w-full">
                  {leadCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leadCover}
                      alt={`Sampul album ${lead.title}`}
                      className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted">
                      Tanpa sampul
                    </div>
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/10"
                />
              </Link>

              <div className="lg:col-span-5">
                <h2 className="font-display text-3xl font-semibold text-balance text-forest sm:text-4xl">
                  {lead.title}
                </h2>
                <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  {lead.eventDate && <span>{formatDate(lead.eventDate)}</span>}
                  {lead.eventDate && <span aria-hidden="true" className="text-wood/40">•</span>}
                  <span>{lead._count.media} foto</span>
                </p>
                {lead.description && (
                  <p className="mt-4 max-w-prose text-muted">{lead.description}</p>
                )}
                <Link
                  href={`/galeri/${lead.slug}`}
                  className="group mt-6 inline-flex min-h-11 items-center gap-2 border-b-2 border-gold pb-1 text-sm font-semibold text-forest transition-colors hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
                >
                  Buka album
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </div>
            </div>
          </Reveal>

          {rest.length > 0 && (
            <section className="mt-16" aria-label="Album lainnya">
              <div className="flex items-baseline justify-between gap-4 border-b border-wood/20 pb-3">
                <h2 className="font-display text-2xl font-semibold text-forest">
                  Album lainnya
                </h2>
              </div>
              <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((album) => {
                  const cover = album.coverImageUrl ?? album.media[0]?.url ?? null;
                  const year = yearOf(album.eventDate);
                  return (
                    <li key={album.id}>
                      <Link href={`/galeri/${album.slug}`} className="group block">
                        <div className="overflow-hidden rounded-sm bg-parchment">
                          <div className="aspect-[4/3] w-full">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cover}
                                alt={`Sampul album ${album.title}`}
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-muted">
                                Tanpa sampul
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex items-baseline justify-between gap-4">
                          <h3 className="font-display text-xl font-semibold text-forest group-hover:text-forest-soft">
                            {album.title}
                          </h3>
                          {year && (
                            <span className="shrink-0 font-display text-sm text-gold-deep">
                              {year}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {album._count.media} foto
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
