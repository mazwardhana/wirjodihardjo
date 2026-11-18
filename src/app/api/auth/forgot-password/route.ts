import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { notifyAdminsOfPasswordReset } from "@/lib/notifications";
import {
  FORGOT_PASSWORD_NEUTRAL_MESSAGE,
  generateResetToken,
  hashResetToken,
  resetExpiryFrom,
} from "@/lib/password-reset";

/** IP pemanggil dari header proxy, dengan fallback agar kunci selalu terisi. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Self-service reset password, langkah 1: minta token.
 *
 * Endpoint ini publik, jadi aturan utamanya adalah TIDAK membocorkan apakah
 * sebuah username/email terdaftar. Karena itu:
 * - respons selalu 200 dengan pesan yang sama;
 * - token hanya dibuat dan disimpan ketika akun benar-benar ada, tetapi
 *   perbedaan itu tidak terlihat oleh pemanggil.
 *
 * Repositori belum punya pengiriman email (tidak ada SMTP/nodemailer/resend),
 * jadi token diserahkan ke admin lewat notifikasi internal dan dicatat di
 * audit log. Lihat docs/ADR-012-reset-password.md.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  // Batas ketat karena endpoint ini publik dan bisa dipakai memetakan akun.
  if (!consumeRateLimit("forgot-password:" + ip, 5, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const emailOrUsername =
    typeof body?.emailOrUsername === "string" ? body.emailOrUsername.trim() : "";

  if (emailOrUsername.length === 0) {
    return NextResponse.json(
      { error: "Username atau email wajib diisi" },
      { status: 400 },
    );
  }

  // Pencarian mengikuti pola login: username apa adanya, email selalu lowercase.
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: emailOrUsername }, { email: emailOrUsername.toLowerCase() }],
    },
    select: { id: true, email: true, username: true },
  });

  if (user) {
    const token = generateResetToken();

    // Yang disimpan hash-nya, bukan token mentah: kebocoran database tidak
    // langsung memberi token yang bisa dipakai.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashResetToken(token),
        passwordResetExpires: resetExpiryFrom(Date.now()),
      },
    });

    await logAudit({
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
      actorUserId: user.id,
    });

    // Repositori belum punya pengiriman email (tidak ada SMTP/nodemailer/
    // resend), jadi token diserahkan lewat notifikasi internal ke admin,
    // mengikuti pola notifyAdminsOfNewSubmission. Lihat docs/ADR-012.
    await notifyAdminsOfPasswordReset({ username: user.username, token });
  }

  return NextResponse.json({ ok: true, message: FORGOT_PASSWORD_NEUTRAL_MESSAGE });
}
