import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { ArticleCard } from "@/components/artikel/ArticleCard";
import { HallOfFameTabs } from "@/components/artikel/HallOfFameTabs";

export const dynamic = "force-dynamic";

export default async function HallOfFamePage() {
  const [entries, articles] = await Promise.all([
    prisma.hallOfFameEntry.findMany({
      where: { isPublished: true },
      include: {
        person: { select: { id: true, fullName: true, photoUrl: true, gender: true } },
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    }),
    prisma.article.findMany({
      where: { status: "APPROVED" },
      orderBy: { publishedAt: "desc" },
      include: {
        category: { select: { name: true, slug: true } },
        author: { select: { person: { select: { fullName: true } } } },
      },
    }),
  ]);

  const appreciationPanel =
    entries.length === 0 ? (
      <EmptyState
        title="Belum ada entri Hall of Fame"
        description="Admin keluarga dapat menambahkan entri pertama melalui panel admin."
      />
    ) : (
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="group rounded-lg border border-wood/20 bg-cream p-5 transition-colors hover:border-gold/60"
          >
            <div className="flex items-center gap-3">
              <Avatar
                name={entry.person.fullName}
                photoUrl={entry.person.photoUrl}
                size="md"
              />
              <div>
                <Link
                  href={`/profil/${entry.person.id}`}
                  className="font-semibold text-forest hover:text-gold-deep"
                >
                  {entry.person.fullName}
                </Link>
                <p className="text-xs font-medium text-wood">{entry.category}</p>
              </div>
            </div>

            {entry.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.photoUrl}
                alt={`Foto terkait: ${entry.title}`}
                className="mt-3 aspect-video w-full rounded-md border border-wood/15 object-cover"
              />
            )}

            {entry.entryType === "IN_MEMORIAM" && (
              <p className="mt-3 inline-block rounded-full bg-wood/10 px-2.5 py-0.5 text-[10px] font-medium text-wood">
                In Memoriam
              </p>
            )}
            {entry.entryType === "ACHIEVEMENT" && (
              <p className="mt-3 inline-block rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-medium text-gold-deep">
                Prestasi
              </p>
            )}

            <h3 className="mt-2 font-display text-base font-semibold text-forest">
              {entry.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {entry.description}
            </p>
            {entry.year && (
              <p className="mt-2 text-xs text-muted">{entry.year}</p>
            )}
          </li>
        ))}
      </ul>
    );

  const articlePanel =
    articles.length === 0 ? (
      <EmptyState
        title="Belum ada artikel & cerita"
        description="Anggota keluarga dapat menulis cerita melalui dashboard, lalu admin meninjaunya sebelum terbit di sini."
      />
    ) : (
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={{
              id: article.id,
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt,
              photoUrl: article.photoUrl,
              publishedAt: article.publishedAt,
              category: article.category,
              author: article.author,
            }}
          />
        ))}
      </ul>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
        Warisan & Cerita
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
        Hall of Fame
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Prestasi, kontribusi, dan cerita anggota keluarga. Setiap entri berasal
        dari data nyata, dikelola oleh admin keluarga.
      </p>

      <HallOfFameTabs
        appreciation={appreciationPanel}
        articles={articlePanel}
      />
    </div>
  );
}
