import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json([]);
  }

  const persons = await prisma.person.findMany({
    where: {
      deletedAt: null,
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { nickname: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, fullName: true },
    take: 10,
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(persons);
}