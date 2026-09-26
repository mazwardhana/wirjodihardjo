import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminArtikelPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kategori?: string }>;
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
  const statusFilter = sp.status?.trim() ?? "PENDING";
  const categoryFilter = sp.kategori?.trim() ?? "";

  const where: Prisma.ArticleWhereInput = {};
  if (["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
    where.status = statusFilter as Prisma.ArticleWhereInput["status"];
  }
  if (categoryFilter) where.categoryId = categoryFilter;

  const [articles, categories, pendingCount] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        author: { select: { person: { select: { fullName: true } } } },
      },
    }),
    prisma.articleCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.article.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">
            Moderasi Artikel
          </h1>
          <p className="mt-1 text-sm text-muted">
            {pendingCount} artikel menunggu review
          </p>
        </div>
        <Link
          href="/admin/artikel/kategori"
          className="rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10"
        >
          Kelola Kategori
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form method="GET" action="/admin/artikel" className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span>Status</span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <option value="PENDING">Menunggu</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-muted">
            <span>Kategori</span>
            <select
              name="kategori"
              defaultValue={categoryFilter}
              className="rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <option value="">Semua</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </form>

        {(statusFilter !== "PENDING" || categoryFilter) && (
          <Link
            href="/admin/artikel"
            className="rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
          >
            Reset
          </Link>
        )}
      </div>

      {articles.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Tidak ada artikel"
            description={
              statusFilter === "PENDING"
                ? "Belum ada artikel yang menunggu review."
                : "Tidak ada artikel yang cocok dengan filter."
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {articles.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-wood/15 bg-cream p-4"
            >
              <div className="flex-1">
                <Link
                  href={`/admin/artikel/${a.id}`}
                  className="font-semibold text-forest hover:text-gold-deep"
                >
                  {a.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  {a.category.name} · {a.author.person.fullName} · {formatDate(a.createdAt)}
                </p>
              </div>
              <Status status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Status({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-gold/20 text-gold-deep",
    APPROVED: "bg-forest/10 text-forest",
    REJECTED: "bg-wood/10 text-wood",
  };
  const labels: Record<string, string> = {
    PENDING: "Menunggu",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
        colors[status] ?? "bg-muted/10 text-muted"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
