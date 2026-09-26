import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { generateArticleSlug } from "@/lib/article/slug";
import { isValidYouTubeUrl } from "@/lib/article/youtube";
import { sanitizeArticleHtml, htmlToPlainText } from "@/lib/article/sanitize";

/**
 * GET /api/artikel - List approved articles (public)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId") ?? undefined;

  const where: Prisma.ArticleWhereInput = { status: "APPROVED" };
  if (categoryId) where.categoryId = categoryId;

  const articles = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    include: {
      category: { select: { name: true, slug: true } },
      author: { select: { person: { select: { fullName: true } } } },
      person: { select: { fullName: true, photoUrl: true } },
    },
  });

  return NextResponse.json(articles);
}

/**
 * POST /api/artikel - Submit article (any logged-in user)
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { title, bodyContent, excerpt, categoryId, personId, youtubeUrl, photoUrl } = body;

  if (!title || !bodyContent || !categoryId) {
    return NextResponse.json(
      { error: "Judul, isi artikel, dan kategori wajib diisi" },
      { status: 400 }
    );
  }

  // Validate category exists
  const category = await prisma.articleCategory.findUnique({
    where: { id: categoryId as string },
  });
  if (!category) {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  // Validate YouTube URL if provided
  if (youtubeUrl && !isValidYouTubeUrl(youtubeUrl as string)) {
    return NextResponse.json(
      { error: "URL YouTube tidak valid. Gunakan format youtube.com/watch?v= atau youtu.be/" },
      { status: 400 }
    );
  }

  const cleanBody = sanitizeArticleHtml(bodyContent as string);
  if (!htmlToPlainText(cleanBody)) {
    return NextResponse.json({ error: "Isi artikel tidak boleh kosong" }, { status: 400 });
  }

  // Generate unique slug
  const slug = await generateArticleSlug(title as string);

  const article = await prisma.article.create({
    data: {
      title: (title as string).trim(),
      slug,
      body: cleanBody,
      excerpt: excerpt
        ? (excerpt as string).trim()
        : htmlToPlainText(cleanBody).slice(0, 200) || null,
      youtubeUrl: youtubeUrl ? (youtubeUrl as string).trim() : null,
      photoUrl: photoUrl ? (photoUrl as string).trim() : null,
      status: "PENDING",
      categoryId: categoryId as string,
      authorUserId: session.user.id,
      personId: personId ? (personId as string) : null,
    },
    include: {
      category: { select: { name: true } },
    },
  });

  await logAudit({
    action: "ARTICLE_SUBMIT",
    entityType: "Article",
    entityId: article.id,
    afterData: { title: article.title, status: "PENDING" },
    actorUserId: session.user.id,
  });

  return NextResponse.json(article, { status: 201 });
}
