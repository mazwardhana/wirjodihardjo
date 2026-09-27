import { readFile } from "fs/promises";
import { basename, join } from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/upload";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Media di album terbit aman di-cache lama. Media termoderasi dan berkas
// non-galeri memakai cache berbeda; lihat resolveMediaAccess.
const PUBLIC_CACHE = "public, max-age=86400";
const PRIVATE_CACHE = "private, max-age=3600";
const LEGACY_PUBLIC_CACHE = "public, max-age=31536000, immutable";

const ADMIN_ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN"];

type MediaAccess = { cacheControl: string } | { forbidden: true };

/**
 * Menentukan apakah berkas galeri boleh disajikan dan dengan cache apa.
 * Berkas tanpa baris GalleryMedia (avatar, sampul cabang, gambar artikel)
 * tetap publik demi kompatibilitas. Sebaliknya, status moderasi dan status
 * terbit album ditegakkan agar media PENDING/REJECTED tidak bocor lewat URL.
 * 
 * Branch scope: BRANCH_ADMIN can only access moderated media from their own branch.
 */
function resolveMediaAccess(
  media: {
    status: string;
    uploadedByUserId: string | null;
    album: { isPublished: boolean };
    uploader: { person: { branchId: string | null } } | null;
  } | null,
  session: { user: { id: string; role: string; branchId: string | null } } | null,
): MediaAccess {
  if (!media) {
    return { cacheControl: LEGACY_PUBLIC_CACHE };
  }

  if (media.status === "APPROVED" && media.album.isPublished) {
    return { cacheControl: PUBLIC_CACHE };
  }

  const isOwner = session?.user.id === media.uploadedByUserId;
  const isSuperAdmin = session?.user.role === "SUPER_ADMIN";
  const isBranchAdmin = session?.user.role === "BRANCH_ADMIN";
  
  // For PENDING media: owner or admin with proper branch scope
  if (media.status === "PENDING") {
    if (isOwner || isSuperAdmin) {
      return { cacheControl: PRIVATE_CACHE };
    }
    if (isBranchAdmin) {
      const uploaderBranchId = media.uploader?.person?.branchId ?? null;
      const adminBranchId = session?.user.branchId ?? null;
      if (adminBranchId !== null && uploaderBranchId === adminBranchId) {
        return { cacheControl: PRIVATE_CACHE };
      }
    }
    return { forbidden: true };
  }

  // For REJECTED or APPROVED in unpublished album: admin with proper branch scope only
  if (media.status === "REJECTED" || (media.status === "APPROVED" && !media.album.isPublished)) {
    if (isSuperAdmin) {
      return { cacheControl: PRIVATE_CACHE };
    }
    if (isBranchAdmin) {
      const uploaderBranchId = media.uploader?.person?.branchId ?? null;
      const adminBranchId = session?.user.branchId ?? null;
      if (adminBranchId !== null && uploaderBranchId === adminBranchId) {
        return { cacheControl: PRIVATE_CACHE };
      }
    }
    return { forbidden: true };
  }

  return { forbidden: true };
}

async function serveFile(safe: string, contentType: string, cacheControl: string) {
  try {
    const file = await readFile(
      join(/* turbopackIgnore: true */ UPLOAD_DIR, safe),
    );
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return new Response("Tidak ditemukan", { status: 404 });
  }
}

/**
 * Menyajikan berkas unggahan dari direktori di luar `public/`, sehingga
 * unggahan runtime tidak bergantung pada pemindaian folder statis Next.js.
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

  const ext = safe.slice(safe.lastIndexOf(".")).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new Response("Tipe berkas tidak didukung", { status: 400 });
  }

  // URL media selalu berbentuk `/api/media/<nama>`; akhiran dengan garis miring
  // mencegah `abc.jpg` cocok dengan `xyzabc.jpg`.
  const media = await prisma.galleryMedia.findFirst({
    where: { url: { endsWith: `/${safe}` } },
    include: {
      album: { select: { isPublished: true } },
      uploader: { select: { person: { select: { branchId: true } } } },
    },
  });

  const session = await auth();
  
  // Resolve branch scope for BRANCH_ADMIN
  let sessionWithBranch = null;
  if (session?.user) {
    if (session.user.role === "BRANCH_ADMIN") {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { branchAdminOf: { select: { id: true } } },
      });
      sessionWithBranch = {
        user: {
          id: session.user.id,
          role: session.user.role,
          branchId: user?.branchAdminOf?.id ?? null,
        },
      };
    } else {
      sessionWithBranch = {
        user: {
          id: session.user.id,
          role: session.user.role,
          branchId: null,
        },
      };
    }
  }

  const access = resolveMediaAccess(media, sessionWithBranch);

  if ("forbidden" in access) {
    return new Response("Akses ditolak", { status: 403 });
  }

  return serveFile(safe, contentType, access.cacheControl);
}
