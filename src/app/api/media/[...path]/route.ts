import { readFile } from "fs/promises";
import { basename, join } from "path";
import { UPLOAD_DIR } from "@/lib/upload";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

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

  try {
    const file = await readFile(
      join(/* turbopackIgnore: true */ UPLOAD_DIR, safe),
    );
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Tidak ditemukan", { status: 404 });
  }
}