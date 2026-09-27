import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireAdminScope } from "@/lib/rbac";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

// GET: list positions by structure
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    await requireAdminScope(session.user.id);
  } catch {
    return NextResponse.json({ error: "Akses admin diperlukan" }, { status: 403 });
  }

  const url = new URL(request.url);
  const structureId = url.searchParams.get("structureId");

  if (!structureId) {
    return NextResponse.json({ error: "structureId diperlukan" }, { status: 400 });
  }

  const positions = await prisma.governancePosition.findMany({
    where: { structureId },
    orderBy: [{ level: "asc" }, { createdAt: "asc" }],
    include: {
      parentPosition: { select: { id: true, name: true } },
      _count: { select: { assignments: true, childPositions: true } },
    },
  });

  return NextResponse.json(positions);
}

// POST: create position (SUPER_ADMIN only)
export async function POST(request: Request) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { structureId, name, description, level, capacity, isBranchRepresentative, parentPositionId } = body;

  if (!structureId || typeof structureId !== "string") {
    return NextResponse.json({ error: "structureId diperlukan" }, { status: 400 });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nama jabatan wajib diisi" }, { status: 400 });
  }

  // Verify structure exists
  const structure = await prisma.governanceStructure.findUnique({
    where: { id: structureId },
  });
  if (!structure) {
    return NextResponse.json({ error: "Struktur tidak ditemukan" }, { status: 404 });
  }

  // Verify parent position if provided
  if (parentPositionId && typeof parentPositionId === "string") {
    const parent = await prisma.governancePosition.findUnique({
      where: { id: parentPositionId },
    });
    if (!parent) {
      return NextResponse.json({ error: "Jabatan induk tidak ditemukan" }, { status: 404 });
    }
    if (parent.structureId !== structureId) {
      return NextResponse.json({ error: "Jabatan induk harus dalam struktur yang sama" }, { status: 400 });
    }
  }

  const position = await prisma.governancePosition.create({
    data: {
      structureId,
      name: name.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      level: typeof level === "number" ? level : 0,
      capacity: typeof capacity === "number" && capacity > 0 ? capacity : null,
      isBranchRepresentative: Boolean(isBranchRepresentative),
      parentPositionId: parentPositionId && typeof parentPositionId === "string" ? parentPositionId : null,
    },
    include: {
      parentPosition: { select: { id: true, name: true } },
      _count: { select: { assignments: true, childPositions: true } },
    },
  });

  await logAudit({
    action: "GOVERNANCE_POSITION_CREATE",
    entityType: "GovernancePosition",
    entityId: position.id,
    afterData: { name: position.name, structureId: position.structureId } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(position, { status: 201 });
}

// PUT: update position (SUPER_ADMIN only)
export async function PUT(request: Request) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { id, name, description, level, capacity, isBranchRepresentative, parentPositionId } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID jabatan diperlukan" }, { status: 400 });
  }

  const existing = await prisma.governancePosition.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Jabatan tidak ditemukan" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nama jabatan tidak valid" }, { status: 400 });
    }
    data.name = name.trim();
  }

  if (description !== undefined) {
    data.description = typeof description === "string" && description.trim() ? description.trim() : null;
  }

  if (level !== undefined) {
    data.level = typeof level === "number" ? level : 0;
  }

  if (capacity !== undefined) {
    if (capacity === null || capacity === "") {
      data.capacity = null;
    } else if (typeof capacity === "number" && capacity > 0) {
      data.capacity = capacity;
    } else {
      return NextResponse.json({ error: "Kapasitas harus berupa angka positif" }, { status: 400 });
    }
  }

  if (isBranchRepresentative !== undefined) {
    data.isBranchRepresentative = Boolean(isBranchRepresentative);
  }

  if (parentPositionId !== undefined) {
    if (parentPositionId === null || parentPositionId === "") {
      data.parentPositionId = null;
    } else if (typeof parentPositionId === "string") {
      // Verify parent exists
      const parent = await prisma.governancePosition.findUnique({
        where: { id: parentPositionId },
      });
      if (!parent) {
        return NextResponse.json({ error: "Jabatan induk tidak ditemukan" }, { status: 404 });
      }
      if (parent.structureId !== existing.structureId) {
        return NextResponse.json({ error: "Jabatan induk harus dalam struktur yang sama" }, { status: 400 });
      }
      // Prevent circular reference
      if (parentPositionId === id) {
        return NextResponse.json({ error: "Jabatan tidak dapat menjadi induk dari dirinya sendiri" }, { status: 400 });
      }
      data.parentPositionId = parentPositionId;
    }
  }

  const position = await prisma.governancePosition.update({
    where: { id },
    data: data as any,
    include: {
      parentPosition: { select: { id: true, name: true } },
      _count: { select: { assignments: true, childPositions: true } },
    },
  });

  await logAudit({
    action: "GOVERNANCE_POSITION_UPDATE",
    entityType: "GovernancePosition",
    entityId: position.id,
    beforeData: existing as any,
    afterData: body as any,
    actorUserId: user.id,
  });

  return NextResponse.json(position);
}

// DELETE: delete position (SUPER_ADMIN only, cascades assignments)
export async function DELETE(request: Request) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID jabatan diperlukan" }, { status: 400 });
  }

  const existing = await prisma.governancePosition.findUnique({
    where: { id },
    include: {
      _count: { select: { childPositions: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Jabatan tidak ditemukan" }, { status: 404 });
  }

  // Prevent deletion if it has child positions
  if (existing._count.childPositions > 0) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus jabatan yang memiliki jabatan bawahan" },
      { status: 400 }
    );
  }

  await prisma.governancePosition.delete({ where: { id } });

  await logAudit({
    action: "GOVERNANCE_POSITION_DELETE",
    entityType: "GovernancePosition",
    entityId: id,
    beforeData: { name: existing.name, structureId: existing.structureId } as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}
