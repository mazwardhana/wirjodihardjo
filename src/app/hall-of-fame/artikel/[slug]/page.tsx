import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArticleDetail } from "@/components/artikel/ArticleDetail";

import { htmlToPlainText } from "@/lib/article/sanitize";

export const dynamic = "force-dynamic";

async function getArticle(slug: string) {
  return prisma.article.findFirst({
    where: { slug, status: "APPROVED" },
    include: {
      category: { select: { name: true, slug: true } },
      author: { select: { person: { select: { fullName: true } } } },
      person: { select: { fullName: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Artikel tidak ditemukan" };

  const description =
    article.excerpt ??
    htmlToPlainText(article.body).slice(0, 160);

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      ...(article.photoUrl ? { images: [{ url: article.photoUrl }] } : {}),
    },
  };
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/hall-of-fame"
        className="text-sm text-muted underline hover:text-forest"
      >
        ← Kembali ke Hall of Fame
      </Link>

      <div className="mt-8">
        <ArticleDetail
          article={{
            title: article.title,
            body: article.body,
            excerpt: article.excerpt,
            photoUrl: article.photoUrl,
            youtubeUrl: article.youtubeUrl,
            publishedAt: article.publishedAt,
            category: article.category,
            author: article.author,
            person: article.person,
          }}
        />
      </div>
    </div>
  );
}
