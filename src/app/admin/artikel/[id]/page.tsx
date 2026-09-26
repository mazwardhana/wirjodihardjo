import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ArticleReview } from "@/components/admin/ArticleReview";

export const dynamic = "force-dynamic";

export default async function AdminArtikelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      author: { select: { person: { select: { fullName: true } } } },
      person: { select: { fullName: true } },
      reviewedBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  if (!article) notFound();

  return (
    <div className="p-8">
      <Link
        href="/admin/artikel"
        className="text-sm text-muted underline hover:text-forest"
      >
        ← Moderasi Artikel
      </Link>

      <div className="mt-6 max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-forest">
              {article.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {article.category.name} · {article.author.person.fullName}
              {article.person && ` · Tentang ${article.person.fullName}`}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Dikirim {formatDate(article.createdAt)}
            </p>
          </div>
          <Status status={article.status} />
        </div>

        {article.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.photoUrl}
            alt={`Foto artikel: ${article.title}`}
            className="mt-6 aspect-video w-full rounded-lg border border-wood/15 object-cover"
          />
        )}

        {article.youtubeUrl && (
          <div className="mt-4 rounded-md border border-wood/15 bg-parchment/40 p-3 text-sm text-muted">
            <span className="font-medium text-forest">YouTube:</span>{" "}
            <a
              href={article.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-deep underline hover:text-forest"
            >
              {article.youtubeUrl}
            </a>
          </div>
        )}

        {article.excerpt && (
          <div className="mt-4 rounded-md border border-wood/15 bg-parchment/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Ringkasan
            </p>
            <p className="mt-1 text-sm text-forest">{article.excerpt}</p>
          </div>
        )}

        <div
          className="prose-article mt-6 text-[1.05rem] leading-relaxed text-ink"
          dangerouslySetInnerHTML={{ __html: article.body }}
        />

        <style>{`
          .prose-article p { margin: 0.9rem 0; }
          .prose-article h2 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 600; color: var(--color-forest); margin: 1.75rem 0 0.75rem; }
          .prose-article h3 { font-family: var(--font-display); font-size: 1.3rem; font-weight: 600; color: var(--color-forest); margin: 1.5rem 0 0.6rem; }
          .prose-article ul { list-style: disc; padding-left: 1.5rem; margin: 0.9rem 0; }
          .prose-article ol { list-style: decimal; padding-left: 1.5rem; margin: 0.9rem 0; }
          .prose-article li { margin: 0.3rem 0; }
          .prose-article blockquote { border-left: 3px solid var(--color-gold); padding-left: 1rem; color: var(--color-muted); margin: 1.25rem 0; font-style: italic; }
          .prose-article a { color: var(--color-gold-deep); text-decoration: underline; }
          .prose-article img { margin: 1.25rem 0; border-radius: 0.5rem; border: 1px solid rgba(111, 74, 43, 0.15); max-width: 100%; height: auto; }
          .prose-article strong { font-weight: 600; color: var(--color-forest); }
        `}</style>

        {article.status === "PENDING" && (
          <div className="mt-8">
            <ArticleReview articleId={article.id} />
          </div>
        )}

        {article.status !== "PENDING" && (
          <div className="mt-8 rounded-lg border border-wood/15 bg-parchment/40 p-4">
            <p className="text-sm font-medium text-forest">
              {article.status === "APPROVED" ? "Disetujui" : "Ditolak"} oleh{" "}
              {article.reviewedBy?.person.fullName ?? "Admin"}
            </p>
            {article.reviewedAt && (
              <p className="mt-0.5 text-xs text-muted">
                {formatDate(article.reviewedAt)}
              </p>
            )}
            {article.reviewNote && (
              <p className="mt-2 text-sm text-muted">{article.reviewNote}</p>
            )}
          </div>
        )}
      </div>
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
