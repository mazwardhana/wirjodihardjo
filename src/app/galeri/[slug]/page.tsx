import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GalleryLightbox } from "@/components/galeri/GalleryLightbox";
import { formatDate } from "@/lib/utils";

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
      {album.description && (
        <p className="mt-3 max-w-2xl text-muted">{album.description}</p>
      )}

      {album.media.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-6 py-14 text-center text-muted">
          Album ini belum memiliki foto yang disetujui.
        </p>
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