import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGenerationLabel } from "@/lib/generations";
import { FilterBar } from "@/components/admin/FilterBar";

export default async function AdminAnggotaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; deleted?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, branchAdminOf: { select: { id: true } } },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const perPage = 25;

  const branchId = user.branchAdminOf?.id;
  const isBranchAdmin = user.role === "BRANCH_ADMIN" && !!branchId;
  const showDeleted = sp.deleted === "true";

  const where: Prisma.PersonWhereInput = {};
  if (isBranchAdmin) where.branchId = branchId;
  if (!showDeleted) where.deletedAt = null;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { nickname: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, persons] = await Promise.all([
    prisma.person.count({ where }),
    prisma.person.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        branch: { select: { name: true } },
        user: { select: { email: true, role: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">Data Anggota</h1>
          <p className="mt-1 text-sm text-muted">{total} anggota tercatat</p>
        </div>
        <Link
          href="/admin/anggota/tambah"
          className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Tambah Anggota
        </Link>
      </div>

      {/* Search & filters */}
      <div className="mt-6">
        <FilterBar
          config={{
            search: {
              placeholder: "Cari nama atau panggilan...",
              param: "q",
            },
            filters: [
              {
                param: "deleted",
                label: "Status",
                options: [{ value: "true", label: "Termasuk yang dihapus" }],
              },
            ],
          }}
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-wood/15">
        {persons.length === 0 ? (
          <EmptyState
            title="Tidak ada anggota"
            description={
              q
                ? "Tidak ada anggota yang cocok dengan pencarian."
                : "Belum ada anggota tercatat pada keluarga cabang ini."
            }
            action={
              q ? (
                <Link
                  href="/admin/anggota"
                  className="inline-flex min-h-11 items-center rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  Hapus pencarian
                </Link>
              ) : (
                <Link
                  href="/admin/anggota/tambah"
                  className="inline-flex min-h-11 items-center rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  Tambah Anggota
                </Link>
              )
            }
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-wood/15 bg-parchment/40 text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Anggota</th>
                <th className="px-4 py-3">Generasi</th>
                <th className="px-4 py-3">Keluarga Cabang</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Akun</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {persons.map((p) => (
                <tr key={p.id} className={`border-b border-wood/10 ${p.deletedAt ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/anggota/${p.id}`} className="flex items-center gap-3">
                      <Avatar name={p.fullName} photoUrl={p.photoUrl} size="sm" />
                      <span className="font-semibold text-forest hover:text-gold-deep">
                        {p.fullName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{getGenerationLabel(p.generationLevel)}</td>
                  <td className="px-4 py-3 text-muted">{p.branch?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      p.isDeceased ? "bg-muted/10 text-muted" : "bg-forest/10 text-forest"
                    }`}>
                      {p.isDeceased ? "Wafat" : "Hidup"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {p.user ? `${p.user.email} (${p.user.role})` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/anggota/${p.id}`}
                      className="text-xs font-medium text-gold-deep underline hover:text-forest"
                    >
                      Kelola
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <p className="text-muted">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/anggota?${new URLSearchParams({
                  ...(q && { q }),
                  page: String(page - 1),
                  ...(showDeleted && { deleted: "true" }),
                })}`}
                className="rounded-md border border-wood/25 px-3 py-1.5 text-muted hover:bg-wood/10"
              >
                Sebelumnya
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/anggota?${new URLSearchParams({
                  ...(q && { q }),
                  page: String(page + 1),
                  ...(showDeleted && { deleted: "true" }),
                })}`}
                className="rounded-md border border-wood/25 px-3 py-1.5 text-muted hover:bg-wood/10"
              >
                Berikutnya
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}