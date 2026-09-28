import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const onboardingSchema = z.object({
  nickname: z
    .string({ message: "Nickname wajib diisi" })
    .trim()
    .min(2, "Nickname harus minimal 2 karakter")
    .max(50, "Nickname maksimal 50 karakter"),
  newPassword: z.string().min(8, "Kata sandi harus minimal 8 karakter"),
  confirmPassword: z.string(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, personId: true, mustChangeCredentials: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  if (!user.mustChangeCredentials) {
    return NextResponse.json(
      { error: "Tidak memerlukan perubahan kredensial" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return NextResponse.json(
      { error: "Kata sandi dan konfirmasi tidak cocok" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  // Ketiga tulisan dibungkus satu transaksi agar akun tidak pernah berada
  // dalam keadaan setengah jadi bila salah satu tulisan gagal.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangeCredentials: false,
      },
    });

    await tx.person.update({
      where: { id: user.personId },
      data: { nickname: parsed.data.nickname },
    });

    await tx.auditLog.create({
      data: {
        action: "COMPLETE_ONBOARDING",
        entityType: "User",
        entityId: user.id,
        actorUserId: session.user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
