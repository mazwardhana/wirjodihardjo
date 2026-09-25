import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  nickname: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  addressLine: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  visibleToMembers: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  // Field publik
  await prisma.person.update({
    where: { id: user.personId },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.nickname !== undefined && { nickname: data.nickname }),
      ...(data.bio !== undefined && { bio: data.bio }),
    },
  });

  // Field privat
  await prisma.personPrivate.upsert({
    where: { personId: user.personId },
    update: {
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
      ...(data.addressLine !== undefined && { addressLine: data.addressLine }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.visibleToMembers !== undefined && {
        visibleToMembers: data.visibleToMembers,
      }),
    },
    create: {
      personId: user.personId,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
      addressLine: data.addressLine ?? null,
      city: data.city ?? null,
      visibleToMembers: data.visibleToMembers ?? true,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_PROFILE",
      entityType: "Person",
      entityId: user.personId,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}