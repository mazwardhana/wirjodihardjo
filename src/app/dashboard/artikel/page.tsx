import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardArtikelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const articles = await prisma.article.findMany({
    where: { authorUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">
            Artikel Saya
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tulis cerita keluarga dan kirim untuk ditinjau admin.
          </p>
        </div>
        <Link
          href="/dashboard/artikel/baru"
          className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Tulis Artikel
        </Link>
      </div>

      {articles.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada artikel"
            description="Bagikan sejarah keluarga, biografi, kenangan, atau prestasi. Artikel akan tampil di Hall of Fame setelah disetujui admin."
            action={
              <Link
                href="/dashboard/artikel/baru"
                className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep"
              >
                Tulis Artikel Pertama
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {articles.map((a) => (
            <li key={a.id} className="rounded-lg border border-wood/15 bg-cream p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-forest">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.category.name} · {formatDate(a.createdAt)}
                  </p>
                </div>
                <Status status={a.status} />
              </div>
              {a.status === "APPROVED" && (
                <Link
                  href={`/hall-of-fame/artikel/${a.slug}`}
                  className="mt-2 inline-block text-xs font-medium text-gold-deep underline hover:text-forest"
                >
                  Lihat di Hall of Fame
                </Link>
              )}
              {a.status === "REJECTED" && a.reviewNote && (
                <p className="mt-2 rounded bg-wood/10 p-2 text-sm text-wood">
                  Catatan admin: {a.reviewNote}
                </p>
              )}
              {a.status === "PENDING" && (
                <p className="mt-2 text-xs text-muted">
                  Menunggu tinjauan admin.
                </p>
              )}
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
