import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { AdminReuniActions } from "@/components/admin/AdminReuniActions";

const statusMeta: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draf", className: "bg-muted/10 text-muted" },
  PUBLISHED: { label: "Terbit", className: "bg-forest/10 text-forest" },
  CANCELLED: { label: "Dibatalkan", className: "bg-wood/10 text-wood" },
  COMPLETED: { label: "Selesai", className: "bg-gold/20 text-gold-deep" },
};

export default async function AdminReuniPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const reunions = await prisma.reunion.findMany({
    orderBy: { startAt: "desc" },
    include: {
      _count: { select: { registrations: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">
            Kelola Reuni
          </h1>
          <p className="mt-1 text-sm text-muted">
            Buat jadwal reuni, atur status tayang, dan pantau pendaftar.
          </p>
        </div>
        <Link
          href="/admin/reuni/baru"
          className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep"
        >
          Reuni Baru
        </Link>
      </div>

      {reunions.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada reuni"
            description="Buat acara reuni pertama agar anggota keluarga bisa mulai mendaftar."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {reunions.map((r) => {
            const meta = statusMeta[r.status] ?? statusMeta.DRAFT;
            return (
              <li
                key={r.id}
                className="rounded-lg border border-wood/15 bg-cream p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/reuni/${r.id}`}
                      className="font-semibold text-forest hover:text-gold-deep"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {formatDateTime(r.startAt)}
                      {r.locationName ? ` · ${r.locationName}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {r._count.registrations} pendaftar
                      {r.capacity ? ` · kuota ${r.capacity}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    <AdminReuniActions
                      id={r.id}
                      status={r.status}
                      editHref={`/admin/reuni/${r.id}`}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}