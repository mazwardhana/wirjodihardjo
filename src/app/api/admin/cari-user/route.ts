import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json([]);
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { person: { fullName: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      email: true,
      role: true,
      person: { select: { fullName: true } },
    },
    take: 10,
    orderBy: { email: "asc" },
  });

  return NextResponse.json(users);
}