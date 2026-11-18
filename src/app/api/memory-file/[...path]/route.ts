import { readFile } from "fs/promises";
import { basename, join } from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/upload";
import { getActorScope, type ActorScope } from "@/lib/rbac";

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Berkas yang sudah lolos moderasi di person publik aman di-cache lama.
// Sisanya (menunggu moderasi, ditolak, atau person non-publik) tidak boleh
// di-cache sama sekali agar keputusan moderasi langsung berlaku.
const PUBLIC_CACHE = "public, max-age=86400";
const PRIVATE_CACHE = "private, max-age=0";

/**
 * Menyajikan berkas PersonMemory. Route /api/media tidak boleh dipakai untuk
 * memori karena di sana berkas tanpa baris GalleryMedia dianggap publik,
 * sehingga memori PENDING/REJECTED bisa bocor lewat URL tebak-tebakan.
 * Nama berkas dibersihkan dengan basename untuk mencegah path traversal.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const requested = path.join("/");
  const safe = basename(requested);

  // Tolak bila ada upaya keluar dari direktori (basename menyaringnya).
  if (!safe || safe !== requested) {
    return new Response("Tidak ditemukan", { status: 404 });
  }

  const dotIndex = safe.lastIndexOf(".");
  const ext = dotIndex === -1 ? "" : safe.slice(dotIndex).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new Response("Tipe berkas tidak didukung", { status: 400 });
  }

  // URL memori selalu berbentuk `/api/memory-file/<nama>`; akhiran dengan
  // garis miring mencegah `abc.mp3` cocok dengan `xyzabc.mp3`. Thumbnail
  // disajikan dengan aturan yang sama karena isinya identik dengan berkas
  // utamanya.
  const memory = await prisma.personMemory.findFirst({
    where: {
      OR: [
        { fileUrl: { endsWith: `/${safe}` } },
        { thumbnailUrl: { endsWith: `/${safe}` } },
      ],
    },
    include: {
      person: { select: { isPublicProfile: true, branchId: true } },
      uploader: { select: { person: { select: { branchId: true } } } },
    },
  });

  if (!memory) {
    return new Response("Tidak ditemukan", { status: 404 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  // Scope admin hanya perlu di-resolve bila pemohon bukan pengunggahnya,
  // sehingga pengunggah mengakses berkasnya sendiri tanpa bacaan RBAC tambahan.
  let scope: ActorScope | null = null;
  if (userId && memory.uploadedByUserId !== userId && memory.status !== "APPROVED") {
    scope = await getActorScope(session!.user!.id, prisma);
  }

  const cacheControl = resolveMemoryAccess(memory, userId, scope);
  if (!cacheControl) {
    return new Response("Akses ditolak", { status: 403 });
  }

  try {
    const file = await readFile(join(/* turbopackIgnore: true */ UPLOAD_DIR, safe));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response("Tidak ditemukan", { status: 404 });
  }
}

/**
 * Aturan akses satu berkas memori: kembalikan nilai Cache-Control bila boleh
 * disajikan, atau null bila ditolak.
 * - APPROVED di person publik: semua orang (cache publik).
 * - APPROVED di person non-publik: hanya anggota yang login.
 * - PENDING/REJECTED: hanya pengunggah atau admin yang cabangnya mencakup
 *   uploader maupun person.
 */
function resolveMemoryAccess(
  memory: {
    status: string;
    uploadedByUserId: string | null;
    person: { isPublicProfile: boolean; branchId: string | null };
    uploader: { person: { branchId: string | null } } | null;
  },
  userId: string | null,
  scope: ActorScope | null,
): string | null {
  if (memory.status === "APPROVED") {
    if (memory.person.isPublicProfile) return PUBLIC_CACHE;
    return userId ? PRIVATE_CACHE : null;
  }

  if (!userId) return null;
  if (memory.uploadedByUserId === userId) return PRIVATE_CACHE;
  if (scope?.role === "SUPER_ADMIN") return PRIVATE_CACHE;
  if (scope?.role === "BRANCH_ADMIN") {
    const uploaderBranchId = memory.uploader?.person?.branchId ?? null;
    if (uploaderBranchId === scope.branchId || memory.person.branchId === scope.branchId) {
      return PRIVATE_CACHE;
    }
  }
  return null;
}
