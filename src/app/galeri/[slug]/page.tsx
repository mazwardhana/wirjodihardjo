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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">
        {album.title}
      </h1>
      {album.eventDate && (
        <p className="mt-1 text-sm text-wood">{formatDate(album.eventDate)}</p>
      )}
      <Link
        href="/galeri"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-gold-deep underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Kembali ke Galeri
      </Link>
      {album.description && (
        <p className="mt-3 max-w-2xl text-muted">{album.description}</p>
      )}

      {album.media.length === 0 ? (
        <div className="mt-6">
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