import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
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

  let scope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch {
    redirect("/dashboard");
  }

  const album = await prisma.album.findUnique({
    where: { slug },
    include: {
      media: {
        orderBy: { createdAt: "desc" },
        include: {
          uploader: {
            select: {
              person: { select: { fullName: true, branchId: true } },
            },
          },
        },
      },
      createdBy: { select: { person: { select: { fullName: true } } } },
      publishedBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  if (!album) notFound();

  // Filter media by branch scope
  const scopedMedia =
    scope.role === "SUPER_ADMIN"
      ? album.media
      : album.media.filter(
          (m) => m.uploader?.person?.branchId === scope.branchId,
        );

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
        media={scopedMedia.map((m) => ({
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