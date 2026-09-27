import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPengajuanList } from "@/components/admin/PengajuanList";
import { FilterBar } from "@/components/admin/FilterBar";

export const dynamic = "force-dynamic";

export default async function AdminPengajuanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tab?: string; type?: string; sejak?: string; q?: string }>;
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

  const { status, tab, type, sejak, q } = await searchParams;
  const statusParam = status ?? tab;
  const statusFilter =
    statusParam === "ALL" || statusParam === "all"
      ? undefined
      : statusParam === "APPROVED" || statusParam === "approved"
        ? "APPROVED" as const
        : statusParam === "REJECTED" || statusParam === "rejected"
          ? "REJECTED" as const
          : "PENDING" as const;

  const branchId = user.branchAdminOf?.id;
  const query: Prisma.SubmissionWhereInput = {};
  if (statusFilter) query.status = statusFilter;
  if (type) query.type = type as Prisma.SubmissionWhereInput["type"];
  if (sejak) query.createdAt = { gte: new Date(sejak) };
  if (user.role === "BRANCH_ADMIN" && branchId) {
    query.targetPerson = { branchId };
  }
  if (q?.trim()) {
    query.OR = [
      { submitter: { person: { fullName: { contains: q.trim(), mode: "insensitive" } } } },
      { targetPerson: { fullName: { contains: q.trim(), mode: "insensitive" } } },
    ];
  }

  const [submissions, pendingCount] = await Promise.all([
    prisma.submission.findMany({
      where: query,
      orderBy: { createdAt: "desc" },
      include: {
        submitter: { select: { person: { select: { fullName: true } } } },
        targetPerson: { select: { id: true, fullName: true, branch: { select: { name: true } } } },
        reviewer: { select: { person: { select: { fullName: true } } } },
      },
    }),
    prisma.submission.count({
      where: { status: "PENDING", ...(user.role === "BRANCH_ADMIN" && branchId ? { targetPerson: { branchId } } : {}) },
    }),
  ]);

  const serializedSubmissions = submissions.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
  }));

  const tabs = [
    { key: "PENDING", label: "Tertunda", count: pendingCount },
    { key: "APPROVED", label: "Disetujui" },
    { key: "REJECTED", label: "Ditolak" },
    { key: "ALL", label: "Semua" },
  ];

  const tabHref = (tabStatus: string) => {
    const params = new URLSearchParams();
    params.set("status", tabStatus);
    if (type) params.set("type", type);
    if (sejak) params.set("sejak", sejak);
    if (q) params.set("q", q);
    return `/admin/pengajuan?${params.toString()}`;
  };

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
              key={t.key}
              href={tabHref(t.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                (t.key === "ALL" && !statusFilter) || t.key === statusFilter
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
      </div>

      {/* Search & filters */}
      <div className="mt-4">
        <FilterBar
          config={{
            search: {
              placeholder: "Cari anggota atau jenis pengajuan...",
              param: "q",
            },
            filters: [
              {
                param: "status",
                label: "Status",
                options: [
                  { value: "PENDING", label: "Tertunda" },
                  { value: "APPROVED", label: "Disetujui" },
                  { value: "REJECTED", label: "Ditolak" },
                ],
              },
            ],
          }}
        />
      </div>

      {submissions.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Tidak ada pengajuan" description="Semua pengajuan sudah diproses." />
        </div>
      ) : (
        <AdminPengajuanList submissions={serializedSubmissions} />
      )}
    </div>
  );
}