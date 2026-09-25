import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/utils";
import { AdminAlbumActions } from "./AdminAlbumActions";

export const dynamic = "force-dynamic";

export default async function AdminGaleriPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const albums = await prisma.album.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { media: true } },
      createdBy: { select: { person: { select: { fullName: true } } } },
      publishedBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  const pendingCount = await prisma.galleryMedia.count({
    where: { status: "PENDING" },
  });

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">Galeri</h1>
          <p className="mt-1 text-sm text-muted">
            Kelola album dan moderasi unggahan media.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Link
              href="/admin/galeri?tab=pending"
              className="rounded-full bg-gold/20 px-3 py-1 text-xs font-medium text-gold-deep transition-colors hover:bg-gold/30"
            >
              {pendingCount} menunggu
            </Link>
          )}
          <Link
            href="/admin/galeri/baru"
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep"
          >
            + Album Baru
          </Link>
        </div>
      </div>

      {albums.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada album"
            description="Buat album pertama untuk mengelola foto keluarga."
            action={
              <Link
                href="/admin/galeri/baru"
                className="inline-block rounded-md bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
              >
                Buat Album
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {albums.map((album) => (
            <li
              key={album.id}
              className="rounded-lg border border-wood/15 bg-cream p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-parchment">
                    {album.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={album.coverImageUrl}
                        alt={`Sampul ${album.title}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">
                        Tanpa sampul
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/galeri/${album.slug}`}
                      className="font-display text-lg font-semibold text-forest underline-offset-2 hover:underline"
                    >
                      {album.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {album._count.media} media
                      {album.eventDate && ` · ${formatDate(album.eventDate)}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          album.isPublished
                            ? "bg-forest/10 text-forest"
                            : "bg-gold/20 text-gold-deep"
                        }`}
                      >
                        {album.isPublished ? "Terbit" : "Draf"}
                      </span>
                      {album.createdBy?.person?.fullName && (
                        <span className="rounded-full bg-wood/10 px-2 py-0.5 text-[10px] text-wood">
                          Oleh {album.createdBy.person.fullName}
                        </span>
                      )}
                      {album.publishedBy?.person?.fullName && (
                        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] text-forest">
                          Diterbitkan {album.publishedBy.person.fullName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <AdminAlbumActions
                  albumId={album.id}
                  slug={album.slug}
                  title={album.title}
                  isPublished={album.isPublished}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}