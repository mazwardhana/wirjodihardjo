import { getYouTubeEmbedUrl } from "@/lib/article/youtube";

export type ArticleDetailData = {
  title: string;
  body: string;
  excerpt: string | null;
  photoUrl: string | null;
  youtubeUrl: string | null;
  publishedAt: Date | string | null;
  category: { name: string; slug: string };
  author: { person: { fullName: string } };
  person: { fullName: string } | null;
};

/**
 * Tampilan baca artikel dengan tipografi bersih (Fraunces untuk judul)
 * dan dukungan gambar + sematan YouTube.
 */
export function ArticleDetail({ article }: { article: ArticleDetailData }) {
  const embedUrl = getYouTubeEmbedUrl(article.youtubeUrl);
  const date = article.publishedAt
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(article.publishedAt))
    : null;

  return (
    <article className="mx-auto max-w-3xl">
      <header>
        <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
          {article.category.name}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-forest sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-sm text-muted">
          Oleh {article.author.person.fullName}
          {article.person && ` · Tentang ${article.person.fullName}`}
          {date && ` · ${date}`}
        </p>
      </header>

      {article.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.photoUrl}
          alt={`Foto artikel: ${article.title}`}
          className="mt-8 aspect-video w-full rounded-lg border border-wood/15 object-cover"
        />
      )}

      {embedUrl && (
        <div className="mt-8 overflow-hidden rounded-lg border border-wood/15">
          <div className="relative aspect-video w-full">
            <iframe
              src={embedUrl}
              title={`Video untuk ${article.title}`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      )}

      <div
        className="prose-article mt-8 text-[1.05rem] leading-relaxed text-ink"
        // Konten berasal dari editor TipTap yang sudah dibersihkan di sisi
        // server (hanya tag yang diizinkan). Lihat catatan keamanan di
        // sanitasi sebelum menambah elemen baru.
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
    </article>
  );
}
