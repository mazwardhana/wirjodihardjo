import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  platformId: z.string().uuid(),
  url: z.string().min(1).max(500).url(),
  username: z.string().max(100).optional(),
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

  const socialLinks = await prisma.socialLink.findMany({
    where: { personId: user.personId },
    include: {
      platform: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ socialLinks });
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

  const platform = await prisma.socialPlatform.findUnique({
    where: { id: parsed.data.platformId },
  });
  if (!platform) {
    return NextResponse.json({ error: "Platform tidak ditemukan" }, { status: 400 });
  }

  const socialLink = await prisma.socialLink.create({
    data: {
      personId: user.personId,
      platformId: parsed.data.platformId,
      url: parsed.data.url,
      username: parsed.data.username ?? null,
    },
    include: {
      platform: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_SOCIAL_LINK",
      entityType: "SocialLink",
      entityId: socialLink.id,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ socialLink }, { status: 201 });
}
