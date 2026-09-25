import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

// Album dibaca langsung dari basis data saat diminta.
export const dynamic = "force-dynamic";

export default async function GaleriPage() {
  const albums = await prisma.album.findMany({
    where: { isPublished: true },
    include: { _count: { select: { media: true } } },
    orderBy: { eventDate: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
        Kenangan
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
        Galeri Keluarga
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Dokumentasi acara dan kenangan keluarga, disusun per album.
      </p>

      {albums.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada album"
            description="Album foto keluarga akan tampil di sini setelah admin menambahkannya."
          />
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <li key={album.id}>
              <Link
                href={`/galeri/${album.slug}`}
                className="group block overflow-hidden rounded-lg border border-wood/20 bg-cream transition-colors hover:border-gold/60"
              >
                <div className="aspect-[4/3] bg-parchment">
                  {album.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={album.coverImageUrl}
                      alt={`Sampul album ${album.title}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted">
                      Tanpa sampul
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-display text-lg font-semibold text-forest">
                    {album.title}
                  </h2>
                  {album.eventDate && (
                    <p className="text-sm text-wood">
                      {formatDate(album.eventDate)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {album._count.media} foto
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}