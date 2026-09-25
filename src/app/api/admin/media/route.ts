import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyMediaModeration } from "@/lib/notifications";
import { UPLOAD_DIR, UPLOAD_URL_PREFIX, MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from "@/lib/upload";

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

/** Hapus berkas dari folder unggahan; gagal diam-diam bila file sudah hilang. */
async function removeStoredFile(url: string | null | undefined) {
  if (!url || !url.startsWith(`${UPLOAD_URL_PREFIX}/`)) return;
  const filename = url.slice(UPLOAD_URL_PREFIX.length + 1);
  if (!filename || filename.includes("..") || filename.includes("/")) return;
  try {
    await unlink(join(UPLOAD_DIR, filename));
  } catch {
    // berkas mungkin sudah tidak ada; abaikan
  }
}

// POST: upload media into an album (multipart/form-data)
export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Format unggahan tidak valid" }, { status: 400 });
  }

  const albumId = formData.get("albumId");
  const caption = formData.get("caption");
  const file = formData.get("file");

  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "albumId wajib diisi" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 400 });
  }

  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album) {
    return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
  }

  const extByType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  const ext = extByType[file.type];
  if (!ext || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Format harus JPG, PNG, atau WebP" },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Ukuran maksimal 5MB" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}${ext}`;
  const url = `${UPLOAD_URL_PREFIX}/${filename}`;
  await writeFile(join(/* turbopackIgnore: true */ UPLOAD_DIR, filename), bytes);

  // Media baru selalu menunggu moderasi admin.
  const media = await prisma.galleryMedia.create({
    data: {
      url,
      thumbnailUrl: url,
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : null,
      mediaType: "IMAGE",
      status: "PENDING",
      albumId,
      uploadedByUserId: user.id,
    },
  });

  await logAudit({
    action: "MEDIA_UPLOAD",
    entityType: "GalleryMedia",
    entityId: media.id,
    afterData: { albumId, url } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(media, { status: 201 });
}

// PUT: moderate media (approve / reject)
export async function PUT(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { id, status, rejectionReason } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID media diperlukan" }, { status: 400 });
  }
  if (status !== "APPROVED" && status !== "REJECTED" && status !== "PENDING") {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }
  if (status === "REJECTED" && (!rejectionReason || typeof rejectionReason !== "string" || !rejectionReason.trim())) {
    return NextResponse.json({ error: "Alasan penolakan wajib diisi" }, { status: 400 });
  }

  const existing = await prisma.galleryMedia.findUnique({
    where: { id },
    include: { album: { select: { title: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  }

  const media = await prisma.galleryMedia.update({
    where: { id },
    data: {
      status,
      moderatedByUserId: user.id,
      moderatedAt: new Date(),
      rejectionReason:
        status === "REJECTED" ? (rejectionReason as string).trim() : null,
    },
  });

  await logAudit({
    action: status === "APPROVED" ? "MEDIA_APPROVE" : status === "REJECTED" ? "MEDIA_REJECT" : "MEDIA_RESET",
    entityType: "GalleryMedia",
    entityId: media.id,
    beforeData: { status: existing.status } as any,
    afterData: { status: media.status, rejectionReason: media.rejectionReason } as any,
    actorUserId: user.id,
  });

  if (status === "APPROVED" || status === "REJECTED") {
    await notifyMediaModeration({
      mediaId: media.id,
      uploaderUserId: existing.uploadedByUserId,
      status: status as "APPROVED" | "REJECTED",
      albumTitle: existing.album?.title ?? "Album",
      reason: status === "REJECTED" ? rejectionReason as string : null,
    });
  }

  return NextResponse.json(media);
}

// DELETE: remove media and its stored file
export async function DELETE(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID media diperlukan" }, { status: 400 });
  }

  const existing = await prisma.galleryMedia.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  }

  await prisma.galleryMedia.delete({ where: { id } });
  await removeStoredFile(existing.url);

  await logAudit({
    action: "MEDIA_DELETE",
    entityType: "GalleryMedia",
    entityId: id,
    beforeData: { albumId: existing.albumId, url: existing.url } as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}