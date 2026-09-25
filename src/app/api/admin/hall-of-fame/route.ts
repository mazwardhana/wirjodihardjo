import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? undefined;
  const isPublished = url.searchParams.get("isPublished");

  const where: Record<string, unknown> = {};
  if (category) where.category = { contains: category, mode: "insensitive" };
  if (isPublished === "true") where.isPublished = true;
  else if (isPublished === "false") where.isPublished = false;

  const entries = await prisma.hallOfFameEntry.findMany({
    where: where as any,
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    include: {
      person: { select: { id: true, fullName: true, photoUrl: true } },
      createdBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  return NextResponse.json(entries);
}

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { category, title, description, year, entryType, personId, photoUrl } = body;

  if (!title || !category || !personId) {
    return NextResponse.json({ error: "Judul, kategori, dan anggota wajib diisi" }, { status: 400 });
  }

  if (!["ACHIEVEMENT", "IN_MEMORIAM"].includes(entryType as string)) {
    return NextResponse.json({ error: "Tipe entri tidak valid" }, { status: 400 });
  }

  const person = await prisma.person.findUnique({ where: { id: personId as string } });
  if (!person) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const entry = await prisma.hallOfFameEntry.create({
    data: {
      category: category as string,
      title: title as string,
      description: (description as string) ?? "",
      year: year ? parseInt(year as string) : null,
      entryType: entryType as any,
      photoUrl: (photoUrl as string) ?? null,
      person: { connect: { id: personId as string } },
      createdBy: { connect: { id: user.id } },
    },
    include: {
      person: { select: { id: true, fullName: true, photoUrl: true } },
    },
  });

  await logAudit({
    action: "HALL_OF_FAME_CREATE",
    entityType: "HallOfFameEntry",
    entityId: entry.id,
    afterData: body as any,
    actorUserId: user.id,
  });

  return NextResponse.json(entry, { status: 201 });
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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  }

  const existing = await prisma.hallOfFameEntry.findUnique({ where: { id: id as string } });
  if (!existing) {
    return NextResponse.json({ error: "Entri tidak ditemukan" }, { status: 404 });
  }

  const entry = await prisma.hallOfFameEntry.update({
    where: { id: id as string },
    data: {
      ...(body.category !== undefined && { category: body.category as string }),
      ...(body.title !== undefined && { title: body.title as string }),
      ...(body.description !== undefined && { description: body.description as string }),
      ...(body.year !== undefined && { year: body.year ? parseInt(body.year as string) : null }),
      ...(body.entryType !== undefined && { entryType: body.entryType as any }),
      ...(body.photoUrl !== undefined && { photoUrl: (body.photoUrl as string) || null }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished as boolean }),
      ...(body.personId !== undefined && {
        person: { connect: { id: body.personId as string } },
      }),
    } as any,
    include: {
      person: { select: { id: true, fullName: true, photoUrl: true } },
    },
  });

  await logAudit({
    action: "HALL_OF_FAME_UPDATE",
    entityType: "HallOfFameEntry",
    entityId: entry.id,
    beforeData: existing as any,
    afterData: body as any,
    actorUserId: user.id,
  });

  return NextResponse.json(entry);
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

  const existing = await prisma.hallOfFameEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Entri tidak ditemukan" }, { status: 404 });
  }

  await prisma.hallOfFameEntry.delete({ where: { id } });

  await logAudit({
    action: "HALL_OF_FAME_DELETE",
    entityType: "HallOfFameEntry",
    entityId: id,
    beforeData: existing as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}