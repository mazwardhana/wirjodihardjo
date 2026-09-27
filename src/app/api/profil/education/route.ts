import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().max(200).optional(),
  fieldOfStudy: z.string().max(200).optional(),
  startYear: z.number().int().min(1900).max(2100).optional(),
  endYear: z.number().int().min(1900).max(2100).optional(),
  description: z.string().max(1000).optional(),
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

  const education = await prisma.education.findMany({
    where: { personId: user.personId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ education });
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

  const education = await prisma.education.create({
    data: {
      personId: user.personId,
      institution: parsed.data.institution,
      degree: parsed.data.degree ?? null,
      fieldOfStudy: parsed.data.fieldOfStudy ?? null,
      startYear: parsed.data.startYear ?? null,
      endYear: parsed.data.endYear ?? null,
      description: parsed.data.description ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_EDUCATION",
      entityType: "Education",
      entityId: education.id,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ education }, { status: 201 });
}
