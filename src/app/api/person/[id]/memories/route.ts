import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { UPLOAD_DIR, MAX_UPLOAD_BYTES } from "@/lib/upload";

// Berkas memori disajikan lewat route khusus, bukan /api/media. Route galeri
// memperlakukan berkas tanpa baris GalleryMedia sebagai publik, sehingga URL
// /api/media akan membocorkan memori PENDING/REJECTED.
const MEMORY_URL_PREFIX = "/api/memory-file";

const MEMBER_ROLES = ["MEMBER", "BRANCH_ADMIN", "SUPER_ADMIN"];
const ADMIN_ROLES = ["BRANCH_ADMIN", "SUPER_ADMIN"];
const KINDS = ["STORY", "AUDIO", "DOCUMENT", "IMAGE"];

const MAX_TITLE_CHARS = 200;
const MAX_STORY_CHARS = 5000;
const GUEST_CONTENT_CHARS = 280;

// Pemetaan mime ke ekstensi dilakukan di server, bukan dari nama berkas
// kiriman, agar ekstensi tidak bisa dipalsukan klien.
const EXT_BY_TYPE: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function roleOf(session: { user?: unknown } | null): string | null {
  const user = session?.user as { role?: string } | undefined;
  return user?.role ?? null;
}

function isAdminRole(role: string | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

function isMemberRole(role: string | null): boolean {
  return role !== null && MEMBER_ROLES.includes(role);
}

/** Cari person yang boleh dilihat pemohon. Admin boleh melihat profil non-publik. */
async function findVisiblePerson(id: string, admin: boolean) {
  return prisma.person.findFirst({
    where: { id, deletedAt: null, ...(admin ? {} : { isPublicProfile: true }) },
    select: { id: true },
  });
}

// POST: kirim memori baru (multipart/form-data)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const role = roleOf(session);
  if (!isMemberRole(role)) {
    return NextResponse.json({ error: "Hanya anggota yang boleh mengirim memori" }, { status: 403 });
  }

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Format unggahan tidak valid" }, { status: 400 });
  }

  const rawTitle = formData.get("title");
  const rawKind = formData.get("kind");
  const rawContent = formData.get("content");
  const file = formData.get("file");

  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  if (!title || title.length > MAX_TITLE_CHARS) {
    return NextResponse.json({ error: "Judul wajib diisi, maksimal 200 karakter" }, { status: 400 });
  }

  const kind = typeof rawKind === "string" ? rawKind : "";
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Jenis memori tidak valid" }, { status: 400 });
  }

  const content = typeof rawContent === "string" ? rawContent.trim() : "";
  if (kind === "STORY") {
    if (!content || content.length > MAX_STORY_CHARS) {
      return NextResponse.json(
        { error: "Cerita wajib diisi, maksimal 5000 karakter" },
        { status: 400 },
      );
    }
  } else if (!(file instanceof File)) {
    return NextResponse.json({ error: "Berkas wajib diunggah untuk jenis ini" }, { status: 400 });
  }

  let ext = "";
  if (kind !== "STORY") {
    const uploaded = file as File;
    ext = EXT_BY_TYPE[uploaded.type] ?? "";
    if (!ext) {
      return NextResponse.json(
        { error: "Format berkas harus MP3, M4A, OGG, WAV, PDF, JPG, PNG, atau WebP" },
        { status: 400 },
      );
    }
    if (uploaded.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Ukuran maksimal 5MB" }, { status: 400 });
    }
  }

  const person = await findVisiblePerson(id, isAdminRole(role));
  if (!person) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  // Batas per pengguna, bukan per orang, agar satu anggota tidak membanjiri
  // moderasi dari banyak profil sekaligus.
  if (!consumeRateLimit(`memory-upload:${session.user.id}`, 10, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak unggahan. Coba lagi dalam satu jam." },
      { status: 429 },
    );
  }

  let fileUrl: string | null = null;
  if (kind !== "STORY") {
    const uploaded = file as File;
    const bytes = Buffer.from(await uploaded.arrayBuffer());
    await mkdir(UPLOAD_DIR, { recursive: true });

    const filename = `${randomUUID()}${ext}`;
    await writeFile(join(/* turbopackIgnore: true */ UPLOAD_DIR, filename), bytes);
    fileUrl = `${MEMORY_URL_PREFIX}/${filename}`;
  }

  const memory = await prisma.personMemory.create({
    data: {
      personId: id,
      kind,
      title,
      content: kind === "STORY" ? content : null,
      fileUrl,
      thumbnailUrl: null,
      status: "PENDING",
      uploadedByUserId: session.user.id,
    },
  });

  await logAudit({
    action: "MEMORY_SUBMIT",
    entityType: "PersonMemory",
    entityId: memory.id,
    afterData: { personId: id, kind, status: "PENDING" },
    actorUserId: session.user.id,
  });

  return NextResponse.json({ id: memory.id, status: "PENDING" }, { status: 201 });
}

// GET: daftar memori yang boleh dilihat pemohon
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = session?.user ?? null;
  const { id } = await params;

  const person = await findVisiblePerson(id, user !== null);
  if (!person) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  // Anggota melihat semua miliknya sendiri; orang lain hanya melihat yang
  // sudah disetujui. Tamu tidak punya identitas sehingga hanya APPROVED.
  const memories = await prisma.personMemory.findMany({
    where: {
      personId: id,
      ...(user
        ? { OR: [{ status: "APPROVED" }, { uploadedByUserId: user.id }] }
        : { status: "APPROVED" }),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    memories: memories.map((memory) => {
      const isOwner = user !== null && memory.uploadedByUserId === user.id;
      let content: string | null = null;
      if (memory.kind === "STORY" && memory.content) {
        content =
          user === null && memory.content.length > GUEST_CONTENT_CHARS
            ? memory.content.slice(0, GUEST_CONTENT_CHARS)
            : memory.content;
      }
      return {
        id: memory.id,
        kind: memory.kind,
        title: memory.title,
        content,
        fileUrl: memory.fileUrl,
        thumbnailUrl: memory.thumbnailUrl,
        status: isOwner ? memory.status : "APPROVED",
        createdAt: memory.createdAt,
      };
    }),
  });
}
