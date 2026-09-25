import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { AdminAlbumDetailClient } from "./AdminAlbumDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminAlbumDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const album = await prisma.album.findUnique({
    where: { slug },
    include: {
      media: {
        orderBy: { createdAt: "desc" },
        include: {
          uploader: { select: { person: { select: { fullName: true } } } },
        },
      },
      createdBy: { select: { person: { select: { fullName: true } } } },
      publishedBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  if (!album) notFound();

  return (
    <div className="p-8">
      <AdminAlbumDetailClient
        album={{
          id: album.id,
          title: album.title,
          slug: album.slug,
          description: album.description ?? "",
          eventDate: album.eventDate ? album.eventDate.toISOString().split("T")[0] : "",
          coverImageUrl: album.coverImageUrl,
          isPublished: album.isPublished,
          createdAt: album.createdAt.toISOString(),
          createdByName: album.createdBy?.person?.fullName ?? null,
          publishedByName: album.publishedBy?.person?.fullName ?? null,
          publishedAt: album.publishedAt?.toISOString() ?? null,
        }}
        media={album.media.map((m) => ({
          id: m.id,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl,
          caption: m.caption,
          status: m.status as "PENDING" | "APPROVED" | "REJECTED",
          rejectionReason: m.rejectionReason,
          createdAt: m.createdAt.toISOString(),
          uploader: m.uploader?.person
            ? { fullName: m.uploader.person.fullName }
            : null,
        }))}
      />
    </div>
  );
}