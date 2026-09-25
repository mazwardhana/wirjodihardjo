import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPengajuanList } from "@/components/admin/PengajuanList";

export const dynamic = "force-dynamic";

export default async function AdminPengajuanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; sejak?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, branchAdminOf: { select: { id: true } } },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const { tab, type, sejak } = await searchParams;
  const statusFilter = tab === "all" ? undefined : tab === "approved" ? "APPROVED" as const : tab === "rejected" ? "REJECTED" as const : "PENDING" as const;

  const branchId = user.branchAdminOf?.id;
  const query: Record<string, unknown> = {};
  if (statusFilter) query.status = statusFilter;
  if (type) query.type = type;
  if (sejak) query.createdAt = { gte: new Date(sejak) };
  if (user.role === "BRANCH_ADMIN" && branchId) {
    query.targetPerson = { branchId };
  }

  const [submissions, pendingCount] = await Promise.all([
    prisma.submission.findMany({
      where: query as any,
      orderBy: { createdAt: "desc" },
      include: {
        submitter: { select: { person: { select: { fullName: true } } } },
        targetPerson: { select: { id: true, fullName: true, branch: { select: { name: true } } } },
        reviewer: { select: { person: { select: { fullName: true } } } },
      },
    }),
    prisma.submission.count({
      where: { status: "PENDING", ...(user.role === "BRANCH_ADMIN" && branchId ? { targetPerson: { branchId } } : {}) } as any,
    }),
  ]);

  const tabs = [
    { key: undefined, label: "Tertunda", count: pendingCount },
    { key: "approved", label: "Disetujui" },
    { key: "rejected", label: "Ditolak" },
    { key: "all", label: "Semua" },
  ];

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-forest">Pengajuan</h1>
      <p className="mt-1 text-sm text-muted">
        Kelola pengajuan perubahan data anggota dari anggota keluarga.
      </p>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-wood/15 bg-cream p-1">
          {tabs.map((t) => (
            <a
              key={t.key ?? "pending"}
              href={`/admin/pengajuan${t.key ? `?tab=${t.key}` : ""}${type ? `&type=${type}` : ""}${sejak ? `&sejak=${sejak}` : ""}`}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                (t.key ?? undefined) === statusFilter || (!statusFilter && !t.key)
                  ? "bg-forest text-cream"
                  : "text-muted hover:bg-wood/10"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full bg-forest/20 px-1.5 py-0.5 text-[10px]">
                  {t.count}
                </span>
              )}
            </a>
          ))}
        </div>

        {/* Filter tipe */}
        <form method="GET" action="/admin/pengajuan" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab ?? "pending"} />
          <label htmlFor="filter-type" className="sr-only">Jenis pengajuan</label>
          <select
            id="filter-type"
            name="type"
            value={type ?? ""}
            onChange={(e) => { if (e.target.form) e.target.form.submit(); }}
            className="rounded-md border border-wood/25 bg-cream px-2.5 py-1.5 text-xs text-forest focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
          >
            <option value="">Semua jenis</option>
            <option value="ADD_CHILD">Tambah Anak</option>
            <option value="ADD_SPOUSE">Tambah Pasangan</option>
            <option value="ADD_PERSON">Tambah Anggota</option>
            <option value="EDIT_PERSON">Edit Anggota</option>
            <option value="EDIT_RELATION">Edit Relasi</option>
          </select>
          <button type="submit" className="sr-only">Filter</button>
        </form>
      </div>

      {submissions.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Tidak ada pengajuan" description="Semua pengajuan sudah diproses." />
        </div>
      ) : (
        <AdminPengajuanList submissions={submissions as any} />
      )}
    </div>
  );
}