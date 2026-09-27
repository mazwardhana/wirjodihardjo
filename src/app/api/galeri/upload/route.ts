import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { UPLOAD_DIR, UPLOAD_URL_PREFIX, ACCEPTED_IMAGE_TYPES } from "@/lib/upload";

// Unggahan anggota memakai batas 10MB; endpoint admin memakai 5MB.
const MAX_MEMBER_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Ambil semua berkas dari field `files[]` (fallback ke `files` / `file`). */
function collectFiles(formData: FormData): File[] {
  return [
    ...formData.getAll("files[]"),
    ...formData.getAll("files"),
    ...formData.getAll("file"),
  ].filter((entry): entry is File => entry instanceof File);
}

/**
 * POST /api/galeri/upload - unggah foto galeri oleh anggota.
 *
 * Terbuka untuk semua peran yang sudah masuk. Setiap unggahan otomatis
 * berstatus PENDING dan admin diberi tahu untuk meninjau.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
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
  const files = collectFiles(formData);

  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "albumId wajib diisi" }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 400 });
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, slug: true, isPublished: true },
  });
  if (!album) {
    return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
  }
  if (!album.isPublished) {
    return NextResponse.json({ error: "Album belum dipublikasikan" }, { status: 403 });
  }

  // Validasi seluruh berkas sebelum menyimpan, agar tidak ada unggahan separuh jalan.
  const validated: { file: File; ext: string }[] = [];
  for (const file of files) {
    const ext = EXT_BY_TYPE[file.type];
    if (!ext || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Format harus JPG, PNG, atau WebP" }, { status: 400 });
    }
    if (file.size > MAX_MEMBER_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Ukuran maksimal 10MB" }, { status: 400 });
    }
    validated.push({ file, ext });
  }

  const normalizedCaption =
    typeof caption === "string" && caption.trim() ? caption.trim() : null;

  await mkdir(UPLOAD_DIR, { recursive: true });

  const mediaIds: string[] = [];
  try {
    for (const { file, ext } of validated) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const filename = `${randomUUID()}${ext}`;
      const url = `${UPLOAD_URL_PREFIX}/${filename}`;
      await writeFile(join(/* turbopackIgnore: true */ UPLOAD_DIR, filename), bytes);

      // Unggahan anggota selalu menunggu moderasi admin.
      const media = await prisma.galleryMedia.create({
        data: {
          url,
          thumbnailUrl: url,
          caption: normalizedCaption,
          mediaType: "IMAGE",
          status: "PENDING",
          albumId,
          uploadedByUserId: session.user.id,
        },
      });
      mediaIds.push(media.id);

      await logAudit({
        action: "MEDIA_UPLOAD",
        entityType: "GalleryMedia",
        entityId: media.id,
        afterData: { albumId, url, status: "PENDING" },
        actorUserId: session.user.id,
      });
    }
  } catch (error) {
    // Rollback: delete any files already written
    for (const id of mediaIds) {
      await prisma.galleryMedia.delete({ where: { id } }).catch(() => {});
    }
    return NextResponse.json({ error: "Gagal menyimpan media" }, { status: 500 });
  }

  await notifyAdminsOfPendingMedia(album.title, album.slug);

  return NextResponse.json({ ok: true, mediaIds, count: mediaIds.length }, { status: 201 });
}

/** Beri tahu semua admin aktif bahwa ada unggahan galeri menunggu moderasi. */
async function notifyAdminsOfPendingMedia(albumTitle: string, albumSlug: string) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "BRANCH_ADMIN"] }, isActive: true },
    select: { id: true },
  });
  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: "MEDIA_PENDING",
        title: "Ada foto baru menunggu moderasi",
        body: `Ada foto baru menunggu moderasi di album ${albumTitle}`,
        link: `/admin/galeri/${albumSlug}`,
      },
    });
  }
}
