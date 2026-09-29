import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import { FilterBar } from "@/components/admin/FilterBar";
import { KategoriModal } from "@/components/admin/KategoriModal";

export const dynamic = "force-dynamic";

export default async function AdminArtikelPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kategori?: string; q?: string }>;
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
  const q = sp.q?.trim() ?? "";

  const where: Prisma.ArticleWhereInput = {};
  if (["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
    where.status = statusFilter as Prisma.ArticleWhereInput["status"];
  }
  if (categoryFilter) where.categoryId = categoryFilter;
  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }

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
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { articles: true } },
      },
    }),
    prisma.article.count({ where: { status: "PENDING" } }),
  ]);

  const filtering = q !== "" || categoryFilter !== "" || statusFilter !== "PENDING";

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">
            Moderasi Artikel
          </h1>
          <p className="mt-1 text-sm text-muted">
            {pendingCount} artikel menunggu review
          </p>
        </div>
        {user.role === "SUPER_ADMIN" && <KategoriModal initial={categories} />}
      </div>

      <FilterBar
        config={{
          search: { placeholder: "Cari judul artikel...", param: "q" },
          filters: [
            {
              param: "status",
              label: "Status",
              options: [
                { value: "PENDING", label: "Menunggu" },
                { value: "APPROVED", label: "Disetujui" },
                { value: "REJECTED", label: "Ditolak" },
              ],
            },
            {
              param: "kategori",
              label: "Kategori",
              options: categories.map((c) => ({ value: c.id, label: c.name })),
            },
          ],
        }}
      />

      {articles.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Tidak ada artikel"
            description={
              filtering
                ? "Tidak ada artikel yang cocok dengan filter."
                : "Belum ada artikel yang menunggu review."
            }
            action={
              filtering ? (
                <Link
                  href="/admin/artikel"
                  className="inline-flex min-h-11 items-center rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  Reset filter
                </Link>
              ) : undefined
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
