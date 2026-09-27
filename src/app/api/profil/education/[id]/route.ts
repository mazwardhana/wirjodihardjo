import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  institution: z.string().min(1).max(200).optional(),
  degree: z.string().max(200).optional(),
  fieldOfStudy: z.string().max(200).optional(),
  startYear: z.number().int().min(1900).max(2100).optional(),
  endYear: z.number().int().min(1900).max(2100).optional(),
  description: z.string().max(1000).optional(),
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

  const existing = await prisma.education.findUnique({
    where: { id },
    select: { personId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Pendidikan tidak ditemukan" }, { status: 404 });
  }

  if (existing.personId !== user.personId) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const education = await prisma.education.update({
    where: { id },
    data: {
      ...(parsed.data.institution !== undefined && { institution: parsed.data.institution }),
      ...(parsed.data.degree !== undefined && { degree: parsed.data.degree }),
      ...(parsed.data.fieldOfStudy !== undefined && { fieldOfStudy: parsed.data.fieldOfStudy }),
      ...(parsed.data.startYear !== undefined && { startYear: parsed.data.startYear }),
      ...(parsed.data.endYear !== undefined && { endYear: parsed.data.endYear }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_EDUCATION",
      entityType: "Education",
      entityId: education.id,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ education });
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

  const existing = await prisma.education.findUnique({
    where: { id },
    select: { personId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Pendidikan tidak ditemukan" }, { status: 404 });
  }

  if (existing.personId !== user.personId) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  await prisma.education.delete({
    where: { id },
  });

  await prisma.auditLog.create({
    data: {
      action: "DELETE_EDUCATION",
      entityType: "Education",
      entityId: id,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
