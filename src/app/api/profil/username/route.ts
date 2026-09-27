import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const usernameSchema = z.object({
  newUsername: z
    .string()
    .min(3, "Username harus minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username hanya boleh mengandung huruf, angka, underscore, dan dash"),
});

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = usernameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: parsed.data.newUsername,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_USERNAME",
        entityType: "User",
        entityId: user.id,
        actorUserId: session.user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Username sudah digunakan" },
        { status: 409 }
      );
    }
    throw error;
  }
}
