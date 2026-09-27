import Link from "next/link";

export type ArticleCardData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  photoUrl: string | null;
  publishedAt: Date | string | null;
  category: { name: string; slug: string };
  author: { person: { fullName: string } };
};

/**
 * Kartu artikel untuk tab "Artikel & Cerita" di Hall of Fame.
 */
export function ArticleCard({ article }: { article: ArticleCardData }) {
  const date = article.publishedAt
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(article.publishedAt))
    : null;

  return (
    <li className="group overflow-hidden rounded-lg border border-wood/20 bg-cream transition-colors hover:border-gold/60">
      <Link href={`/hall-of-fame/artikel/${article.slug}`} className="block">
        {article.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.photoUrl}
            alt={`Foto artikel: ${article.title}`}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center bg-parchment/60">
            <span className="font-display text-2xl text-wood/40" aria-hidden="true">
              ❦
            </span>
          </div>
        )}

        <div className="p-5">
          <p className="text-xs font-medium tracking-wide text-gold-deep">
            {article.category.name}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold leading-snug text-forest group-hover:text-gold-deep">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
              {article.excerpt}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">
            {article.author.person.fullName}
            {date && ` · ${date}`}
          </p>
        </div>
      </Link>
    </li>
  );
}
