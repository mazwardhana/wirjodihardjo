import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "album";
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) return null;
  return user;
}

// GET: list albums (with counts)
export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const albums = await prisma.album.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { media: true } },
      createdBy: { select: { person: { select: { fullName: true } } } },
      publishedBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  return NextResponse.json(albums);
}

// POST: create album
export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { title, slug, description, eventDate, coverImageUrl } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Judul album wajib diisi" }, { status: 400 });
  }

  const finalSlug = slug && typeof slug === "string" && slug.trim()
    ? slug.trim()
    : slugify(title as string);

  // Check slug uniqueness
  const existing = await prisma.album.findUnique({ where: { slug: finalSlug } });
  if (existing) {
    return NextResponse.json({ error: "Slug sudah digunakan, gunakan judul yang berbeda" }, { status: 409 });
  }

  const album = await prisma.album.create({
    data: {
      title: title.trim(),
      slug: finalSlug,
      description: description ? (description as string).trim() : null,
      eventDate: eventDate ? new Date(eventDate as string) : null,
      coverImageUrl: coverImageUrl ? (coverImageUrl as string) : null,
      createdByUserId: user.id,
    },
  });

  await logAudit({
    action: "ALBUM_CREATE",
    entityType: "Album",
    entityId: album.id,
    afterData: { title: album.title, slug: album.slug } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(album, { status: 201 });
}

// PUT: update album
export async function PUT(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { id, title, slug, description, eventDate, coverImageUrl, isPublished } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID album diperlukan" }, { status: 400 });
  }

  const existing = await prisma.album.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Judul tidak valid" }, { status: 400 });
    }
    updateData.title = title.trim();
  }

  if (slug !== undefined) {
    const newSlug = typeof slug === "string" ? slug.trim() : slugify(existing.title);
    if (newSlug !== existing.slug) {
      const slugExists = await prisma.album.findUnique({ where: { slug: newSlug } });
      if (slugExists) {
        return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
      }
      updateData.slug = newSlug;
    }
  }

  if (description !== undefined) {
    updateData.description = (description as string)?.trim() || null;
  }
  if (eventDate !== undefined) {
    updateData.eventDate = eventDate ? new Date(eventDate as string) : null;
  }
  if (coverImageUrl !== undefined) {
    updateData.coverImageUrl = (coverImageUrl as string) || null;
  }

  // Handle publish/unpublish
  if (isPublished !== undefined) {
    const publish = Boolean(isPublished);
    if (publish && !existing.isPublished) {
      // Publishing now
      updateData.isPublished = true;
      updateData.publishedByUserId = user.id;
      updateData.publishedAt = new Date();
    } else if (!publish && existing.isPublished) {
      // Unpublishing
      updateData.isPublished = false;
      updateData.publishedByUserId = null;
      updateData.publishedAt = null;
    }
  }

  const album = await prisma.album.update({
    where: { id },
    data: updateData as any,
  });

  await logAudit({
    action: isPublished !== undefined
      ? (isPublished ? "ALBUM_PUBLISH" : "ALBUM_UNPUBLISH")
      : "ALBUM_UPDATE",
    entityType: "Album",
    entityId: album.id,
    beforeData: { title: existing.title, isPublished: existing.isPublished } as any,
    afterData: { title: album.title, isPublished: album.isPublished } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(album);
}

// DELETE: delete album (cascade media via schema)
export async function DELETE(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID album diperlukan" }, { status: 400 });
  }

  const existing = await prisma.album.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
  }

  // Cascade delete: GalleryMedia onDelete: Cascade is set in schema
  await prisma.album.delete({ where: { id } });

  await logAudit({
    action: "ALBUM_DELETE",
    entityType: "Album",
    entityId: id,
    beforeData: { title: existing.title } as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}