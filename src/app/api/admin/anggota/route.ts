import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { personSchema } from "@/server/validations";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const parsed = personSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data tidak valid", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const person = await prisma.person.create({
    data: {
      fullName: data.fullName,
      nickname: data.nickname || null,
      gender: data.gender as any,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      birthPlace: data.birthPlace || null,
      isDeceased: data.isDeceased ?? false,
      deathDate: data.deathDate ? new Date(data.deathDate) : null,
      bio: data.bio || null,
      photoUrl: (body as any).photoUrl || null,
      generationLevel: (body as any).generationLevel ? parseInt((body as any).generationLevel) : null,
      branch: data.branchId ? { connect: { id: data.branchId } } : undefined,
    } as any,
  });

  await logAudit({
    action: "PERSON_CREATE",
    entityType: "Person",
    entityId: person.id,
    afterData: data as any,
    actorUserId: user.id,
  });

  return NextResponse.json(person, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  }

  const existing = await prisma.person.findUnique({ where: { id: id as string } });
  if (!existing) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const person = await prisma.person.update({
    where: { id: id as string },
    data: {
      ...(body.fullName !== undefined && { fullName: body.fullName as string }),
      ...(body.nickname !== undefined && { nickname: (body.nickname as string) || null }),
      ...(body.gender !== undefined && { gender: body.gender as any }),
      ...(body.birthDate !== undefined && { birthDate: body.birthDate ? new Date(body.birthDate as string) : null }),
      ...(body.birthPlace !== undefined && { birthPlace: (body.birthPlace as string) || null }),
      ...(body.isDeceased !== undefined && { isDeceased: body.isDeceased as boolean }),
      ...(body.deathDate !== undefined && { deathDate: body.deathDate ? new Date(body.deathDate as string) : null }),
      ...(body.bio !== undefined && { bio: (body.bio as string) || null }),
      ...(body.photoUrl !== undefined && { photoUrl: (body.photoUrl as string) || null }),
      ...(body.generationLevel !== undefined && { generationLevel: parseInt(body.generationLevel as string) || null }),
    } as any,
  });

  await logAudit({
    action: "PERSON_UPDATE",
    entityType: "Person",
    entityId: person.id,
    beforeData: existing as any,
    afterData: body as any,
    actorUserId: user.id,
  });

  return NextResponse.json(person);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  }

  // Soft delete
  await prisma.person.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    action: "PERSON_DELETE",
    entityType: "Person",
    entityId: id,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  }

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      branch: true,
      private: true,
      user: { select: { id: true, email: true, role: true } },
      parents: {
        include: { parent: { select: { id: true, fullName: true, photoUrl: true } } },
      },
      children: {
        include: { child: { select: { id: true, fullName: true, photoUrl: true, gender: true, generationLevel: true } } },
      },
      partnershipsA: {
        include: { partnerB: { select: { id: true, fullName: true, photoUrl: true } } },
      },
      partnershipsB: {
        include: { partnerA: { select: { id: true, fullName: true, photoUrl: true } } },
      },
    },
  });

  if (!person) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(person);
}