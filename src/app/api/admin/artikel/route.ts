import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { generateArticleSlug } from "@/lib/article/slug";
import { isValidYouTubeUrl } from "@/lib/article/youtube";
import { sanitizeArticleHtml, htmlToPlainText } from "@/lib/article/sanitize";

/**
 * GET /api/admin/artikel - List all articles with filters (admin only)
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;

  const where: Prisma.ArticleWhereInput = {};
  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    where.status = status as Prisma.ArticleWhereInput["status"];
  }
  if (categoryId) where.categoryId = categoryId;

  const articles = await prisma.article.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true, slug: true } },
      author: { select: { person: { select: { fullName: true } } } },
      reviewedBy: { select: { person: { select: { fullName: true } } } },
      person: { select: { fullName: true } },
    },
  });

  return NextResponse.json(articles);
}

/**
 * PUT /api/admin/artikel - Update article (admin only)
 */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { id, title, bodyContent, excerpt, categoryId, personId, youtubeUrl, photoUrl } = body;

  if (!id) {
    return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  }

  const existing = await prisma.article.findUnique({ where: { id: id as string } });
  if (!existing) {
    return NextResponse.json({ error: "Artikel tidak ditemukan" }, { status: 404 });
  }

  // Validate YouTube URL if provided
  if (youtubeUrl && !isValidYouTubeUrl(youtubeUrl as string)) {
    return NextResponse.json(
      { error: "URL YouTube tidak valid" },
      { status: 400 }
    );
  }

  const updateData: Prisma.ArticleUpdateInput = {};

  if (title !== undefined && title !== existing.title) {
    updateData.title = (title as string).trim();
    updateData.slug = await generateArticleSlug(title as string, id as string);
  }

  if (bodyContent !== undefined) {
    const cleanBody = sanitizeArticleHtml(bodyContent as string);
    if (!htmlToPlainText(cleanBody)) {
      return NextResponse.json({ error: "Isi artikel tidak boleh kosong" }, { status: 400 });
    }
    updateData.body = cleanBody;
  }
  if (excerpt !== undefined) updateData.excerpt = excerpt ? (excerpt as string).trim() : null;
  if (categoryId !== undefined) updateData.category = { connect: { id: categoryId as string } };
  if (personId !== undefined) {
    updateData.person = personId ? { connect: { id: personId as string } } : { disconnect: true };
  }
  if (youtubeUrl !== undefined) updateData.youtubeUrl = youtubeUrl ? (youtubeUrl as string).trim() : null;
  if (photoUrl !== undefined) updateData.photoUrl = photoUrl ? (photoUrl as string).trim() : null;

  const article = await prisma.article.update({
    where: { id: id as string },
    data: updateData,
    include: {
      category: { select: { name: true } },
    },
  });

  await logAudit({
    action: "ARTICLE_UPDATE",
    entityType: "Article",
    entityId: article.id,
    beforeData: {
      title: existing.title,
      status: existing.status,
      categoryId: existing.categoryId,
      excerpt: existing.excerpt,
      youtubeUrl: existing.youtubeUrl,
      photoUrl: existing.photoUrl,
    },
    afterData: {
      title: article.title,
      status: article.status,
      categoryId: article.categoryId,
      excerpt: article.excerpt,
      youtubeUrl: article.youtubeUrl,
      photoUrl: article.photoUrl,
    },
    actorUserId: session.user.id,
  });

  return NextResponse.json(article);
}
