import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireAdminScope, type AdminScope } from "@/lib/rbac";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "album";
}

function assertAlbumAccess(scope: AdminScope, branchIds: (string | null | undefined)[]): void {
  if (scope.role === "SUPER_ADMIN") return;
  if (scope.branchId === null) throw new Error("FORBIDDEN");
  if (!branchIds.some((bid) => bid === scope.branchId)) throw new Error("FORBIDDEN");
}

// GET: list albums (with counts)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope: AdminScope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch (err) {
    return NextResponse.json({ error: "Akses admin ditolak" }, { status: 403 });
  }

  const albums = await prisma.album.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { media: true } },
      media: {
        select: {
          uploader: { select: { person: { select: { branchId: true } } } },
        },
      },
      createdBy: { select: { person: { select: { fullName: true } } } },
      publishedBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  if (scope.role === "SUPER_ADMIN") {
    return NextResponse.json(albums);
  }

  const scopedAlbums = albums
    .filter((album) =>
      album.media.some((media) => media.uploader?.person?.branchId === scope.branchId),
    )
    .map((album) => {
      const media = album.media.filter(
        (m) => m.uploader?.person?.branchId === scope.branchId,
      );
      return { ...album, media, _count: { media: media.length } };
    });

  return NextResponse.json(scopedAlbums);
}

// POST: create album
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope: AdminScope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch (err) {
    return NextResponse.json({ error: "Akses admin ditolak" }, { status: 403 });
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
      createdByUserId: session.user.id,
    },
  });

  await logAudit({
    action: "ALBUM_CREATE",
    entityType: "Album",
    entityId: album.id,
    afterData: { title: album.title, slug: album.slug } as any,
    actorUserId: session.user.id,
  });

  return NextResponse.json(album, { status: 201 });
}

// PUT: update album
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope: AdminScope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch (err) {
    return NextResponse.json({ error: "Akses admin ditolak" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { id, title, slug, description, eventDate, coverImageUrl, isPublished } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID album diperlukan" }, { status: 400 });
  }

  const existing = await prisma.album.findUnique({
    where: { id },
    include: {
      media: {
        select: { uploader: { select: { person: { select: { branchId: true } } } } },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
  }

  // Branch scope: BRANCH_ADMIN can only update albums with media from their branch
  const branchIds = existing.media.map((m) => m.uploader?.person?.branchId);
  try {
    assertAlbumAccess(scope, branchIds);
  } catch {
    return NextResponse.json({ error: "Di luar cabang Anda" }, { status: 403 });
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
      updateData.publishedByUserId = session.user.id;
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
    actorUserId: session.user.id,
  });

  return NextResponse.json(album);
}

// DELETE: delete album (cascade media via schema)
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope: AdminScope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch (err) {
    return NextResponse.json({ error: "Akses admin ditolak" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID album diperlukan" }, { status: 400 });
  }

  const existing = await prisma.album.findUnique({
    where: { id },
    include: {
      media: {
        select: { uploader: { select: { person: { select: { branchId: true } } } } },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
  }

  // Branch scope: BRANCH_ADMIN can only delete albums with media from their branch
  const branchIds = existing.media.map((m) => m.uploader?.person?.branchId);
  try {
    assertAlbumAccess(scope, branchIds);
  } catch {
    return NextResponse.json({ error: "Di luar cabang Anda" }, { status: 403 });
  }

  // Cascade delete: GalleryMedia onDelete: Cascade is set in schema
  await prisma.album.delete({ where: { id } });

  await logAudit({
    action: "ALBUM_DELETE",
    entityType: "Album",
    entityId: id,
    beforeData: { title: existing.title } as any,
    actorUserId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}