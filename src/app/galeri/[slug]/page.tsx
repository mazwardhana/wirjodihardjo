import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GalleryLightbox } from "@/components/galeri/GalleryLightbox";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const album = await prisma.album.findUnique({
    where: { slug },
    select: { title: true },
  });
  return { title: album?.title ?? "Album tidak ditemukan" };
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const album = await prisma.album.findUnique({
    where: { slug },
    include: {
      media: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!album || !album.isPublished) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <Link
        href="/galeri"
        className="group inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
      >
        <span
          aria-hidden="true"
          className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-x-1"
        >
          ←
        </span>
        Galeri Keluarga
      </Link>

      <header className="mt-4 border-b border-wood/20 pb-8">
        <h1 className="font-display text-4xl font-semibold text-balance text-forest sm:text-5xl">
          {album.title}
        </h1>
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {album.eventDate && <span>{formatDate(album.eventDate)}</span>}
          {album.eventDate && <span aria-hidden="true" className="text-wood/40">•</span>}
          <span>{album.media.length} foto</span>
        </p>
        {album.description && (
          <p className="mt-4 max-w-2xl text-muted">{album.description}</p>
        )}
      </header>

      {album.media.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Album ini belum memiliki foto yang disetujui"
            description="Foto akan muncul di sini setelah admin menyetujui penggunaan media."
            action={
              <Link
                href="/galeri"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                Lihat album lain
              </Link>
            }
          />
        </div>
      ) : (
        <GalleryLightbox
          items={album.media.map((m) => ({
            id: m.id,
            url: m.url,
            caption: m.caption,
          }))}
        />
      )}
    </div>
  );
}
