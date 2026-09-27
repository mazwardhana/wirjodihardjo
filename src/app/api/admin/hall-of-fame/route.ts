import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireAdminScope, assertPersonAccess, assertBranchAccess, AuthorizationError } from "@/lib/rbac";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const scope = await requireAdminScope(session.user.id);

    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? undefined;
    const isPublished = url.searchParams.get("isPublished");

    const where: Record<string, unknown> = {};
    if (category) where.category = { contains: category, mode: "insensitive" };
    if (isPublished === "true") where.isPublished = true;
    else if (isPublished === "false") where.isPublished = false;

    // Scope by branch for BRANCH_ADMIN
    if (scope.role === "BRANCH_ADMIN" && scope.branchId) {
      where.person = { branchId: scope.branchId };
    }

    const entries = await prisma.hallOfFameEntry.findMany({
      where: where as any,
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      include: {
        person: { select: { id: true, fullName: true, photoUrl: true, branchId: true } },
        createdBy: { select: { person: { select: { fullName: true } } } },
      },
    });

    return NextResponse.json(entries);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const scope = await requireAdminScope(session.user.id);

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

    // Validate access to the person
    await assertPersonAccess(scope, personId as string);

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
        createdBy: { connect: { id: session.user.id } },
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
      actorUserId: session.user.id,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const scope = await requireAdminScope(session.user.id);

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

    const existing = await prisma.hallOfFameEntry.findUnique({
      where: { id: id as string },
      include: { person: { select: { branchId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Entri tidak ditemukan" }, { status: 404 });
    }

    // Validate access to existing entry's person
    if (existing.person.branchId) {
      assertBranchAccess(scope, existing.person.branchId);
    }

    // If personId is being changed, validate access to new person
    if (body.personId !== undefined && body.personId !== existing.personId) {
      await assertPersonAccess(scope, body.personId as string);
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
      actorUserId: session.user.id,
    });

    return NextResponse.json(entry);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const scope = await requireAdminScope(session.user.id);
    
    if (scope.role !== "SUPER_ADMIN") {
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
      actorUserId: session.user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}