import { unlink } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireAdminScope, type AdminScope } from "@/lib/rbac";
import { UPLOAD_DIR } from "@/lib/upload";

// Berkas memori disajikan lewat route /api/memory-file, bukan /api/media
// (route galeri memperlakukan berkas tanpa baris GalleryMedia sebagai publik).
const MEMORY_URL_PREFIX = "/api/memory-file";

// REJECTED tetap tampil 30 hari supaya admin bisa meninjau keputusannya,
// lalu hilang sendiri agar daftar moderasi tidak menumpuk.
const REJECTED_RETENTION_DAYS = 30;

const MEMORY_SELECT_SCOPE = {
  uploader: { select: { person: { select: { branchId: true } } } },
  person: { select: { branchId: true } },
} as const;

/**
 * BRANCH_ADMIN hanya boleh menyentuh memori dari cabangnya: cukup salah satu
 * dari uploader atau person yang satu cabang dengannya.
 */
function assertMemoryScope(
  scope: AdminScope,
  memory: { uploader: { person: { branchId: string | null } } | null; person: { branchId: string | null } | null },
): void {
  if (scope.role === "SUPER_ADMIN") return;
  const uploaderBranchId = memory.uploader?.person?.branchId ?? null;
  const personBranchId = memory.person?.branchId ?? null;
  if (uploaderBranchId !== scope.branchId && personBranchId !== scope.branchId) {
    throw new Error("Di luar cabang Anda");
  }
}

/** Hapus berkas dari folder unggahan; gagal diam-diam bila file sudah hilang. */
async function removeStoredFile(url: string | null | undefined) {
  if (!url || !url.startsWith(`${MEMORY_URL_PREFIX}/`)) return;
  const filename = url.slice(MEMORY_URL_PREFIX.length + 1);
  if (!filename || filename.includes("..") || filename.includes("/")) return;
  try {
    await unlink(join(/* turbopackIgnore: true */ UPLOAD_DIR, filename));
  } catch {
    // berkas mungkin sudah tidak ada; abaikan
  }
}

// GET: daftar memori yang menunggu (atau baru ditolak) untuk dimoderasi
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope: AdminScope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch {
    return NextResponse.json({ error: "Akses admin ditolak" }, { status: 403 });
  }

  const rejectedSince = new Date(Date.now() - REJECTED_RETENTION_DAYS * 24 * 60 * 60_000);
  const memories = await prisma.personMemory.findMany({
    where: {
      AND: [
        {
          OR: [
            { status: "PENDING" },
            { status: "REJECTED", moderatedAt: { gte: rejectedSince } },
          ],
        },
        // SUPER_ADMIN tidak dibatasi cabang; kondisi ini tidak ditambahkan
        // agar query-nya tetap datar untuk super admin.
        ...(scope.role === "BRANCH_ADMIN"
          ? [
              {
                OR: [
                  { uploader: { person: { branchId: scope.branchId } } },
                  { person: { branchId: scope.branchId } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      uploader: { select: { username: true } },
      person: { select: { id: true, fullName: true } },
    },
  });

  return NextResponse.json({ memories });
}

// POST: setujui atau tolak satu memori
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope: AdminScope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch {
    return NextResponse.json({ error: "Akses admin ditolak" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { id, action } = body;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "ID memori diperlukan" }, { status: 400 });
  }
  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
  }
  if (action === "REJECT" && (!reason || reason.length > 500)) {
    return NextResponse.json(
      { error: "Alasan penolakan wajib diisi, maksimal 500 karakter" },
      { status: 400 },
    );
  }

  const memory = await prisma.personMemory.findUnique({
    where: { id },
    include: MEMORY_SELECT_SCOPE,
  });
  if (!memory) {
    return NextResponse.json({ error: "Memori tidak ditemukan" }, { status: 404 });
  }

  try {
    assertMemoryScope(scope, memory);
  } catch {
    return NextResponse.json({ error: "Di luar cabang Anda" }, { status: 403 });
  }

  const updated = await prisma.personMemory.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      moderatedByUserId: session.user.id,
      moderatedAt: new Date(),
      rejectionReason: action === "REJECT" ? reason : null,
    },
  });

  await logAudit({
    action: "MEMORY_MODERATE",
    entityType: "PersonMemory",
    entityId: id,
    beforeData: { status: memory.status },
    afterData: { status: updated.status, rejectionReason: updated.rejectionReason },
    actorUserId: session.user.id,
  });

  return NextResponse.json(updated);
}

// DELETE: hapus memori beserta berkas fisiknya
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope: AdminScope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch {
    return NextResponse.json({ error: "Akses admin ditolak" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID memori diperlukan" }, { status: 400 });
  }

  const memory = await prisma.personMemory.findUnique({
    where: { id },
    include: MEMORY_SELECT_SCOPE,
  });
  if (!memory) {
    return NextResponse.json({ error: "Memori tidak ditemukan" }, { status: 404 });
  }

  try {
    assertMemoryScope(scope, memory);
  } catch {
    return NextResponse.json({ error: "Di luar cabang Anda" }, { status: 403 });
  }

  await prisma.personMemory.delete({ where: { id } });
  await removeStoredFile(memory.fileUrl);
  await removeStoredFile(memory.thumbnailUrl);

  await logAudit({
    action: "MEMORY_DELETE",
    entityType: "PersonMemory",
    entityId: id,
    beforeData: { title: memory.title, fileUrl: memory.fileUrl },
    actorUserId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
