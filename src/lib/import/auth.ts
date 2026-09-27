import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireImportAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true, mustChangePassword: true },
  });
  if (!user?.isActive || user.role !== "SUPER_ADMIN" || user.mustChangePassword) {
    return { error: NextResponse.json({ error: "Impor hanya tersedia untuk Super Admin aktif yang sudah mengganti kata sandi awal." }, { status: 403 }) };
  }
  return { user };
}
