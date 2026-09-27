import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/admin/artikel/kategori - List all categories
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const categories = await prisma.articleCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { articles: true } },
    },
  });

  return NextResponse.json(categories);
}

/**
 * POST /api/admin/artikel/kategori - Create category (SUPER_ADMIN only)
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { name } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    return NextResponse.json({ error: "Nama kategori tidak valid" }, { status: 400 });
  }

  // Check for duplicate
  const existing = await prisma.articleCategory.findUnique({
    where: { slug },
  });
  if (existing) {
    return NextResponse.json({ error: "Kategori dengan nama serupa sudah ada" }, { status: 409 });
  }

  const category = await prisma.articleCategory.create({
    data: {
      name: name.trim(),
      slug,
    },
  });

  await logAudit({
    action: "ARTICLE_CATEGORY_CREATE",
    entityType: "ArticleCategory",
    entityId: category.id,
    afterData: { name: category.name },
    actorUserId: session.user.id,
  });

  return NextResponse.json(category, { status: 201 });
}

/**
 * PUT /api/admin/artikel/kategori - Update category (SUPER_ADMIN only)
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
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { id, name } = body;

  if (!id) {
    return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  }

  const existing = await prisma.articleCategory.findUnique({
    where: { id: id as string },
  });
  if (!existing) {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    return NextResponse.json({ error: "Nama kategori tidak valid" }, { status: 400 });
  }

  // Check for duplicate slug (exclude current)
  const duplicate = await prisma.articleCategory.findFirst({
    where: { slug, NOT: { id: id as string } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Kategori dengan nama serupa sudah ada" }, { status: 409 });
  }

  const category = await prisma.articleCategory.update({
    where: { id: id as string },
    data: {
      name: name.trim(),
      slug,
    },
  });

  await logAudit({
    action: "ARTICLE_CATEGORY_UPDATE",
    entityType: "ArticleCategory",
    entityId: category.id,
    beforeData: { name: existing.name, slug: existing.slug },
    afterData: { name: category.name, slug: category.slug },
    actorUserId: session.user.id,
  });

  return NextResponse.json(category);
}

/**
 * DELETE /api/admin/artikel/kategori - Delete category (SUPER_ADMIN only)
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  }

  const existing = await prisma.articleCategory.findUnique({
    where: { id },
    include: {
      _count: { select: { articles: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  if (existing._count.articles > 0) {
    return NextResponse.json(
      { error: "Kategori tidak bisa dihapus karena masih digunakan oleh artikel" },
      { status: 409 }
    );
  }

  await prisma.articleCategory.delete({ where: { id } });

  await logAudit({
    action: "ARTICLE_CATEGORY_DELETE",
    entityType: "ArticleCategory",
    entityId: id,
    beforeData: { name: existing.name },
    actorUserId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
