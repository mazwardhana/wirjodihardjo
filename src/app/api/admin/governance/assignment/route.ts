import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireAdminScope } from "@/lib/rbac";

const REPRESENTATIVE_SLOTS_PER_BRANCH = 2;

async function requireSessionUser() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user) return null;
  return user;
}

// GET: list assignments by position
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
  const positionId = url.searchParams.get("positionId");

  if (!positionId) {
    return NextResponse.json({ error: "positionId diperlukan" }, { status: 400 });
  }

  const assignments = await prisma.governanceAssignment.findMany({
    where: { positionId },
    orderBy: { startDate: "desc" },
    include: {
      person: { select: { id: true, fullName: true, branchId: true } },
      branch: { select: { id: true, name: true } },
      assignedBy: { select: { id: true, person: { select: { fullName: true } } } },
    },
  });

  return NextResponse.json(assignments);
}

// POST: create assignment with atomic capacity validation
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await requireSessionUser();
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  // Only SUPER_ADMIN can create assignments
  if (user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { positionId, personId, branchId, startDate, endDate, notes } = body;

  if (!positionId || typeof positionId !== "string") {
    return NextResponse.json({ error: "positionId diperlukan" }, { status: 400 });
  }

  if (!personId || typeof personId !== "string") {
    return NextResponse.json({ error: "personId diperlukan" }, { status: 400 });
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

  // Use transaction for atomic capacity validation
  try {
    const assignment = await prisma.$transaction(async (tx) => {
      // Lock the position row so concurrent assignments serialize on capacity.
      await tx.$queryRaw`SELECT id FROM "GovernancePosition" WHERE id = ${positionId} FOR UPDATE`;

      // Verify position exists
      const position = await tx.governancePosition.findUnique({
        where: { id: positionId },
        select: { id: true, capacity: true, isBranchRepresentative: true, structureId: true },
      });
      if (!position) {
        throw new Error("POSITION_NOT_FOUND");
      }

      // Verify person exists and is active
      const person = await tx.person.findUnique({
        where: { id: personId },
        select: { id: true, fullName: true, branchId: true, deletedAt: true },
      });
      if (!person) {
        throw new Error("PERSON_NOT_FOUND");
      }
      if (person.deletedAt) {
        throw new Error("PERSON_DELETED");
      }

      // Check if already assigned to this position
      const existingAssignment = await tx.governanceAssignment.findFirst({
        where: { positionId, personId },
      });
      if (existingAssignment) {
        throw new Error("ALREADY_ASSIGNED");
      }

      // For branch representative positions, capacity is evaluated per branch.
      // Other positions use one global capacity.
      if (!position.isBranchRepresentative && position.capacity !== null) {
        const currentCount = await tx.governanceAssignment.count({
          where: { positionId },
        });
        if (currentCount >= position.capacity) {
          throw new Error("CAPACITY_EXCEEDED");
        }
      }

      // For branch representative positions, validate branch membership
      if (position.isBranchRepresentative) {
        if (!person.branchId) {
          throw new Error("PERSON_NO_BRANCH");
        }
        // Branch representatives must have branchId in assignment
        if (!branchId || typeof branchId !== "string") {
          throw new Error("BRANCH_ID_REQUIRED");
        }
        if (person.branchId !== branchId) {
          throw new Error("PERSON_BRANCH_MISMATCH");
        }

        // Enforce per-branch slot limit (2 unless the position overrides it).
        const branchLimit = position.capacity !== null ? position.capacity : REPRESENTATIVE_SLOTS_PER_BRANCH;
        const branchCount = await tx.governanceAssignment.count({
          where: { positionId, branchId },
        });
        if (branchCount >= branchLimit) {
          throw new Error("BRANCH_CAPACITY_EXCEEDED");
        }
      }

      // Create assignment
      return await tx.governanceAssignment.create({
        data: {
          positionId,
          personId,
          branchId: branchId && typeof branchId === "string" ? branchId : null,
          startDate: start,
          endDate: end,
          notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
          assignedByUserId: user.id,
        },
        include: {
          person: { select: { id: true, fullName: true, branchId: true } },
          branch: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
        },
      });
    });

    await logAudit({
      action: "GOVERNANCE_ASSIGNMENT_CREATE",
      entityType: "GovernanceAssignment",
      entityId: assignment.id,
      afterData: { positionId, personId, branchId } as any,
      actorUserId: user.id,
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: any) {
    if (error.message === "POSITION_NOT_FOUND") {
      return NextResponse.json({ error: "Jabatan tidak ditemukan" }, { status: 404 });
    }
    if (error.message === "PERSON_NOT_FOUND") {
      return NextResponse.json({ error: "Person tidak ditemukan" }, { status: 404 });
    }
    if (error.message === "PERSON_DELETED") {
      return NextResponse.json({ error: "Person sudah dihapus" }, { status: 400 });
    }
    if (error.message === "ALREADY_ASSIGNED") {
      return NextResponse.json({ error: "Person sudah ditugaskan ke jabatan ini" }, { status: 409 });
    }
    if (error.message === "CAPACITY_EXCEEDED") {
      return NextResponse.json({ error: "Kapasitas jabatan sudah penuh" }, { status: 409 });
    }
    if (error.message === "PERSON_NO_BRANCH") {
      return NextResponse.json({ error: "Person harus memiliki cabang untuk jabatan perwakilan cabang" }, { status: 400 });
    }
    if (error.message === "BRANCH_ID_REQUIRED") {
      return NextResponse.json({ error: "branchId wajib untuk jabatan perwakilan cabang" }, { status: 400 });
    }
    if (error.message === "PERSON_BRANCH_MISMATCH") {
      return NextResponse.json({ error: "Person harus dari cabang yang sama dengan penugasan" }, { status: 400 });
    }
    if (error.message === "BRANCH_CAPACITY_EXCEEDED") {
      return NextResponse.json({ error: "Kapasitas perwakilan cabang sudah penuh (maksimal 2 per cabang)" }, { status: 409 });
    }
    throw error;
  }
}

// DELETE: remove assignment
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await requireSessionUser();
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  // Only SUPER_ADMIN can delete assignments
  if (user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID penugasan diperlukan" }, { status: 400 });
  }

  const existing = await prisma.governanceAssignment.findUnique({
    where: { id },
    include: {
      person: { select: { fullName: true } },
      position: { select: { name: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan" }, { status: 404 });
  }

  await prisma.governanceAssignment.delete({ where: { id } });

  await logAudit({
    action: "GOVERNANCE_ASSIGNMENT_DELETE",
    entityType: "GovernanceAssignment",
    entityId: id,
    beforeData: {
      personName: existing.person.fullName,
      positionName: existing.position.name,
    } as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}
