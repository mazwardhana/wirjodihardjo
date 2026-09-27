import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  platformId: z.string().uuid().optional(),
  url: z.string().min(1).max(500).url().optional(),
  username: z.string().max(100).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
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

  const existing = await prisma.socialLink.findUnique({
    where: { id },
    select: { personId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Link tidak ditemukan" }, { status: 404 });
  }

  if (existing.personId !== user.personId) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  if (parsed.data.platformId) {
    const platform = await prisma.socialPlatform.findUnique({
      where: { id: parsed.data.platformId },
    });
    if (!platform) {
      return NextResponse.json({ error: "Platform tidak ditemukan" }, { status: 400 });
    }
  }

  const socialLink = await prisma.socialLink.update({
    where: { id },
    data: {
      ...(parsed.data.platformId !== undefined && { platformId: parsed.data.platformId }),
      ...(parsed.data.url !== undefined && { url: parsed.data.url }),
      ...(parsed.data.username !== undefined && { username: parsed.data.username }),
    },
    include: {
      platform: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_SOCIAL_LINK",
      entityType: "SocialLink",
      entityId: socialLink.id,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ socialLink });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  const existing = await prisma.socialLink.findUnique({
    where: { id },
    select: { personId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Link tidak ditemukan" }, { status: 404 });
  }

  if (existing.personId !== user.personId) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  await prisma.socialLink.delete({
    where: { id },
  });

  await prisma.auditLog.create({
    data: {
      action: "DELETE_SOCIAL_LINK",
      entityType: "SocialLink",
      entityId: id,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
