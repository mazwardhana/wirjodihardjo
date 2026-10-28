/**
 * S11 — utilitas reset password (self-service).
 *
 * Schema sudah punya `passwordResetToken` + `passwordResetExpires` sejak awal,
 * tapi belum ada route yang memakainya. Modul ini memegang logika murni
 * (tanpa Prisma) supaya bisa diuji langsung dengan node:test.
 *
 * Prinsip keamanan:
 * - Token mentah TIDAK pernah disimpan. Yang disimpan hanya hash SHA-256,
 *   sehingga kebocoran database tidak langsung memberi token yang bisa dipakai.
 * - Token kedaluwarsa 1 jam (TTL singkat, sekali pakai).
 * - Respons endpoint selalu netral: kita tidak mengungkap apakah sebuah
 *   username/email terdaftar atau tidak (anti user-enumeration).
 */

import crypto from "crypto";

/** Masa berlaku token reset: 1 jam. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Panjang minimum password baru (mengikuti pola registrasi). */
export const MIN_PASSWORD_LENGTH = 8;

/** Hash token untuk penyimpanan. SHA-256 cukup: token sendiri acak 256-bit. */
export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Token acak 32 byte → hex 64 karakter. */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Waktu kedaluwarsa baru, dihitung dari `now` agar bisa diuji. */
export function resetExpiryFrom(now: number): Date {
  return new Date(now + PASSWORD_RESET_TTL_MS);
}

/** Token masih sah? (`expiresAt` boleh null → dianggap kedaluwarsa). */
export function isResetTokenValid(
  storedToken: string | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!storedToken || !expiresAt) return false;
  return expiresAt.getTime() > now.getTime();
}

/**
 * Pesan netral untuk endpoint forgot-password. Sengaja sama baik akun ada
 * maupun tidak, agar endpoint tidak bisa dipakai memeriksa keberadaan akun.
 */
export const FORGOT_PASSWORD_NEUTRAL_MESSAGE =
  "Jika akun dengan data tersebut terdaftar, instruksi reset password sudah dikirim ke admin.";
