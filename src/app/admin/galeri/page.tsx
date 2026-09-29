import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { AdminAlbumActions } from "./AdminAlbumActions";
import { FilterBar } from "@/components/admin/FilterBar";
import { AlbumCreateModal } from "./AlbumCreateModal";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminGaleriPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[]; tab?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const q = first(sp.q).trim();
  const status = first(sp.status).trim();
  const statusFilter = status === "published" || status === "draft" ? status : "";

  const where: Prisma.AlbumWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (statusFilter === "published") where.isPublished = true;
  else if (statusFilter === "draft") where.isPublished = false;
  if (first(sp.tab) === "pending") where.media = { some: { status: "PENDING" } };

  const [albums, pendingCount, total] = await Promise.all([
    prisma.album.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { media: true } },
        createdBy: { select: { person: { select: { fullName: true } } } },
        publishedBy: { select: { person: { select: { fullName: true } } } },
      },
    }),
    prisma.galleryMedia.count({
      where: { status: "PENDING" },
    }),
    prisma.album.count(),
  ]);
  const filtering = q !== "" || statusFilter !== "";

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">Galeri</h1>
          <p className="mt-1 text-sm text-muted">
            Kelola album dan moderasi unggahan media. {total} album tercatat
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
          <AlbumCreateModal />
        </div>
      </div>

      <div className="mt-6">
        <FilterBar
          config={{
            search: {
              placeholder: "Cari judul atau deskripsi album...",
              param: "q",
            },
            filters: [
              {
                param: "status",
                label: "Status",
                options: [
                  { value: "published", label: "Terbit" },
                  { value: "draft", label: "Draf" },
                ],
              },
              {
                param: "tab",
                label: "Moderasi",
                options: [{ value: "pending", label: "Media menunggu" }],
              },
            ],
          }}
        />
      </div>

      {albums.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-wood/25 bg-cream px-4 py-12 text-center">
          <p className="text-sm text-muted">
            {filtering
              ? "Tidak ada album yang cocok dengan filter."
              : "Belum ada album. Buat album pertama untuk mengelola foto keluarga."}
          </p>
          <div className="mt-6">
            {filtering ? (
              <Link
                href="/admin/galeri"
                className="inline-flex min-h-11 items-center rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                Reset filter
              </Link>
            ) : (
              <AlbumCreateModal />
            )}
          </div>
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