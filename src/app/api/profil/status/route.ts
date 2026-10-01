import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  const statuses = await prisma.personStatus.findMany({
    where: { personId: user.personId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ statuses });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  const status = await prisma.personStatus.create({
    data: {
      personId: user.personId,
      message: parsed.data.message,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_STATUS",
      entityType: "PersonStatus",
      entityId: status.id,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ status }, { status: 201 });
}
