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

// GET: list structures (accessible to all admins)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    await requireAdminScope(session.user.id);
  } catch {
    return NextResponse.json({ error: "Akses admin diperlukan" }, { status: 403 });
  }

  const structures = await prisma.governanceStructure.findMany({
    orderBy: { startDate: "desc" },
    include: {
      positions: {
        include: {
          _count: { select: { assignments: true } },
        },
        orderBy: { level: "asc" },
      },
    },
  });

  return NextResponse.json(structures);
}

// POST: create structure (SUPER_ADMIN only)
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

  const { name, description, startDate, endDate, isActive } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nama struktur wajib diisi" }, { status: 400 });
  }

  if (!startDate || typeof startDate !== "string") {
    return NextResponse.json({ error: "Tanggal mulai wajib diisi" }, { status: 400 });
  }

  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Tanggal mulai tidak valid" }, { status: 400 });
  }

  let end: Date | null = null;
  if (endDate) {
    if (typeof endDate !== "string") {
      return NextResponse.json({ error: "Tanggal selesai tidak valid" }, { status: 400 });
    }
    end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return NextResponse.json({ error: "Tanggal selesai tidak valid" }, { status: 400 });
    }
    if (end < start) {
      return NextResponse.json({ error: "Tanggal selesai harus setelah atau sama dengan tanggal mulai" }, { status: 400 });
    }
  }

  // Check for duplicate name
  const existing = await prisma.governanceStructure.findUnique({
    where: { name: name.trim() },
  });
  if (existing) {
    return NextResponse.json({ error: "Nama struktur sudah digunakan" }, { status: 409 });
  }

  const structure = await prisma.governanceStructure.create({
    data: {
      name: name.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      startDate: start,
      endDate: end,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
    include: {
      positions: {
        include: {
          _count: { select: { assignments: true } },
        },
      },
    },
  });

  await logAudit({
    action: "GOVERNANCE_STRUCTURE_CREATE",
    entityType: "GovernanceStructure",
    entityId: structure.id,
    afterData: { name: structure.name, startDate: structure.startDate } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(structure, { status: 201 });
}

// PUT: update structure (SUPER_ADMIN only)
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

  const { id, name, description, startDate, endDate, isActive } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID struktur diperlukan" }, { status: 400 });
  }

  const existing = await prisma.governanceStructure.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Struktur tidak ditemukan" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nama struktur tidak valid" }, { status: 400 });
    }
    // Check for duplicate name (excluding current)
    const conflict = await prisma.governanceStructure.findFirst({
      where: { name: name.trim(), id: { not: id } },
    });
    if (conflict) {
      return NextResponse.json({ error: "Nama struktur sudah digunakan" }, { status: 409 });
    }
    data.name = name.trim();
  }

  if (description !== undefined) {
    data.description = typeof description === "string" && description.trim() ? description.trim() : null;
  }

  if (startDate !== undefined) {
    if (typeof startDate !== "string") {
      return NextResponse.json({ error: "Tanggal mulai tidak valid" }, { status: 400 });
    }
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: "Tanggal mulai tidak valid" }, { status: 400 });
    }
    data.startDate = start;
  }

  if (endDate !== undefined) {
    if (endDate === null || endDate === "") {
      data.endDate = null;
    } else {
      if (typeof endDate !== "string") {
        return NextResponse.json({ error: "Tanggal selesai tidak valid" }, { status: 400 });
      }
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return NextResponse.json({ error: "Tanggal selesai tidak valid" }, { status: 400 });
      }
      const effectiveStart = (data.startDate as Date) || existing.startDate;
      if (end < effectiveStart) {
        return NextResponse.json({ error: "Tanggal selesai harus setelah atau sama dengan tanggal mulai" }, { status: 400 });
      }
      data.endDate = end;
    }
  }

  if (isActive !== undefined) {
    data.isActive = Boolean(isActive);
  }

  const structure = await prisma.governanceStructure.update({
    where: { id },
    data: data as any,
    include: {
      positions: {
        include: {
          _count: { select: { assignments: true } },
        },
        orderBy: { level: "asc" },
      },
    },
  });

  await logAudit({
    action: "GOVERNANCE_STRUCTURE_UPDATE",
    entityType: "GovernanceStructure",
    entityId: structure.id,
    beforeData: existing as any,
    afterData: body as any,
    actorUserId: user.id,
  });

  return NextResponse.json(structure);
}

// DELETE: soft deactivate (set isActive = false)
export async function DELETE(request: Request) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID struktur diperlukan" }, { status: 400 });
  }

  const existing = await prisma.governanceStructure.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Struktur tidak ditemukan" }, { status: 404 });
  }

  const structure = await prisma.governanceStructure.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit({
    action: "GOVERNANCE_STRUCTURE_DEACTIVATE",
    entityType: "GovernanceStructure",
    entityId: structure.id,
    beforeData: { isActive: existing.isActive } as any,
    afterData: { isActive: false } as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}
