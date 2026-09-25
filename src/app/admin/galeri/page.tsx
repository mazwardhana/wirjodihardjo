import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, branchAdminOf: { select: { id: true } } },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }
  return user;
}

export default async function AdminGaleriPage() {
  await requireAdmin();

  const media = await prisma.galleryMedia.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { album: { select: { title: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Moderasi Galeri</h1>
      <p className="mt-2 text-muted">{media.length} media menunggu persetujuan</p>

      {media.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Tidak ada media menunggu" description="Semua unggahan sudah dimoderasi." />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((m) => (
            <li key={m.id} className="rounded-lg border border-wood/15 bg-cream p-3">
              {(m.thumbnailUrl || m.url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnailUrl || m.url} alt={m.caption ?? "Media"} className="h-40 w-full rounded object-cover" />
              )}
              <p className="mt-2 text-sm font-medium text-forest">{m.caption ?? "Tanpa keterangan"}</p>
              <p className="text-xs text-muted">Album: {m.album.title}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}