import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { getGenerationLabel } from "@/lib/generations";

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

  const where: Record<string, unknown> = {};
  if (isBranchAdmin) where.branchId = branchId;
  if (!showDeleted) where.deletedAt = null;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { nickname: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, persons] = await Promise.all([
    prisma.person.count({ where: where as any }),
    prisma.person.findMany({
      where: where as any,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        branch: { select: { name: true } },
        user: { select: { id: true, email: true, role: true } },
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
      <form method="GET" action="/admin/anggota" className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama atau panggilan…"
          className="block w-72 rounded-md border border-wood/30 bg-cream px-4 py-2 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
        <button
          type="submit"
          className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Cari
        </button>
        {(q || showDeleted) && (
          <Link
            href="/admin/anggota"
            className="rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
          >
            Reset
          </Link>
        )}
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="deleted"
            value="true"
            defaultChecked={showDeleted}
            onChange={() => {}}
            className="h-4 w-4 accent-forest"
          />
          Tampilkan yang dihapus
        </label>
      </form>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-wood/15">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-wood/15 bg-parchment/40 text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Anggota</th>
              <th className="px-4 py-3">Generasi</th>
              <th className="px-4 py-3">Cabang</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Akun</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {persons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  Tidak ada anggota ditemukan.
                </td>
              </tr>
            ) : (
              persons.map((p) => (
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
              ))
            )}
          </tbody>
        </table>
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