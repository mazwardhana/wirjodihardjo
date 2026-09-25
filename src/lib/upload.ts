import { join } from "path";

/**
 * Konfigurasi penyimpanan berkas unggahan.
 *
 * Disimpan di luar `public/` karena folder itu di-snapshot saat build,
 * sedangkan unggahan terjadi saat runtime. Berkas disajikan lewat
 * route handler `/api/media/[nama-berkas]`.
 */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");

export const UPLOAD_URL_PREFIX = "/api/media";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];