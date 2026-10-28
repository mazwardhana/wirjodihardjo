import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import {
  MIN_PASSWORD_LENGTH,
  hashResetToken,
  isResetTokenValid,
} from "@/lib/password-reset";

/** IP pemanggil dari header proxy, dengan fallback agar kunci selalu terisi. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Self-service reset password, langkah 2: tukar token dengan password baru.
 *
 * Endpoint ini juga publik, tetapi token yang benar adalah rahasianya, jadi
 * kegagalan di sini boleh spesifik (token tidak dikenal/kedaluwarsa). Yang
 * tidak boleh bocor adalah isi akun: hanya status token yang dilaporkan.
 *
 * Token hanya pernah ditangani dalam bentuk hash, sama seperti pada langkah 1.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  // Batas longgar sedikit lebih besar dari langkah 1 karena satu percobaan
  // membutuhkan token yang sah, tetapi tetap rapat untuk menekan perburuan.
  if (!consumeRateLimit("reset-password:" + ip, 10, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword =
    typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (token.length === 0) {
    return NextResponse.json({ error: "Token wajib diisi" }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Kata sandi dan konfirmasi tidak cocok" },
      { status: 400 },
    );
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Kata sandi harus minimal ${MIN_PASSWORD_LENGTH} karakter` },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { passwordResetToken: hashResetToken(token) },
    select: {
      id: true,
      passwordResetToken: true,
      passwordResetExpires: true,
    },
  });

  const invalid = NextResponse.json(
    { error: "Token tidak valid atau sudah kedaluwarsa" },
    { status: 400 },
  );

  if (!user) return invalid;
  if (!isResetTokenValid(user.passwordResetToken, user.passwordResetExpires)) {
    return invalid;
  }

  // Algoritma hash mengikuti pola registrasi/onboarding (bcrypt, cost 12),
  // tidak diperkenalkan algoritma baru.
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Satu transaksi agar password baru dan pembuangan token tidak terpisah.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangeCredentials: false,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "User",
        entityId: user.id,
        actorUserId: user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
