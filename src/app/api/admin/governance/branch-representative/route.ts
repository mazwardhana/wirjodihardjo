import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireAdminScope, assertBranchAccess } from "@/lib/rbac";

// GET: list branch representatives by branch
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch {
    return NextResponse.json({ error: "Akses admin diperlukan" }, { status: 403 });
  }

  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");

  if (!branchId) {
    return NextResponse.json({ error: "branchId diperlukan" }, { status: 400 });
  }

  // BRANCH_ADMIN can only query their own branch representatives
  try {
    assertBranchAccess(scope, branchId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Akses ditolak" }, { status: error.status || 403 });
  }

  const representatives = await prisma.branchRepresentative.findMany({
    where: { branchId },
    orderBy: { slot: "asc" },
    include: {
      person: { select: { id: true, fullName: true, photoUrl: true } },
      assignedBy: { select: { id: true, person: { select: { fullName: true } } } },
    },
  });

  return NextResponse.json(representatives);
}

// POST: assign branch representative with atomic 2-slot enforcement
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch {
    return NextResponse.json({ error: "Akses admin diperlukan" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { branchId, personId, slot, startDate, endDate, notes } = body;

  if (!branchId || typeof branchId !== "string") {
    return NextResponse.json({ error: "branchId diperlukan" }, { status: 400 });
  }

  if (!personId || typeof personId !== "string") {
    return NextResponse.json({ error: "personId diperlukan" }, { status: 400 });
  }

  if (!slot || typeof slot !== "number" || ![1, 2].includes(slot)) {
    return NextResponse.json({ error: "slot harus 1 atau 2" }, { status: 400 });
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

  // BRANCH_ADMIN can only manage their own branch representatives
  try {
    assertBranchAccess(scope, branchId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Akses ditolak" }, { status: error.status || 403 });
  }

  // Use transaction for atomic slot enforcement
  try {
    const representative = await prisma.$transaction(async (tx) => {
      // Verify branch exists
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { id: true, name: true },
      });
      if (!branch) {
        throw new Error("BRANCH_NOT_FOUND");
      }

      // Verify person exists and belongs to the branch
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
      if (person.branchId !== branchId) {
        throw new Error("PERSON_BRANCH_MISMATCH");
      }

      // Check if slot is already occupied (atomic check with unique constraint)
      const existingSlot = await tx.branchRepresentative.findUnique({
        where: { branchId_slot: { branchId, slot } },
      });
      if (existingSlot) {
        throw new Error("SLOT_OCCUPIED");
      }

      // Create representative assignment
      return await tx.branchRepresentative.create({
        data: {
          branchId,
          personId,
          slot,
          startDate: start,
          endDate: end,
          notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
          assignedByUserId: session.user.id,
        },
        include: {
          person: { select: { id: true, fullName: true, photoUrl: true } },
          branch: { select: { id: true, name: true } },
        },
      });
    });

    await logAudit({
      action: "BRANCH_REPRESENTATIVE_CREATE",
      entityType: "BranchRepresentative",
      entityId: representative.id,
      afterData: { branchId, personId, slot } as any,
      actorUserId: session.user.id,
    });

    return NextResponse.json(representative, { status: 201 });
  } catch (error: any) {
    if (error.message === "BRANCH_NOT_FOUND") {
      return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
    }
    if (error.message === "PERSON_NOT_FOUND") {
      return NextResponse.json({ error: "Person tidak ditemukan" }, { status: 404 });
    }
    if (error.message === "PERSON_DELETED") {
      return NextResponse.json({ error: "Person sudah dihapus" }, { status: 400 });
    }
    if (error.message === "PERSON_BRANCH_MISMATCH") {
      return NextResponse.json({ error: "Person harus dari cabang yang sama" }, { status: 400 });
    }
    if (error.message === "SLOT_OCCUPIED") {
      return NextResponse.json({ error: "Slot sudah terisi" }, { status: 409 });
    }
    throw error;
  }
}

// DELETE: remove branch representative
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let scope;
  try {
    scope = await requireAdminScope(session.user.id);
  } catch {
    return NextResponse.json({ error: "Akses admin diperlukan" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID perwakilan diperlukan" }, { status: 400 });
  }

  const existing = await prisma.branchRepresentative.findUnique({
    where: { id },
    include: {
      person: { select: { fullName: true } },
      branch: { select: { name: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Perwakilan tidak ditemukan" }, { status: 404 });
  }

  // BRANCH_ADMIN can only delete their own branch representatives
  try {
    assertBranchAccess(scope, existing.branchId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Akses ditolak" }, { status: error.status || 403 });
  }

  await prisma.branchRepresentative.delete({ where: { id } });

  await logAudit({
    action: "BRANCH_REPRESENTATIVE_DELETE",
    entityType: "BranchRepresentative",
    entityId: id,
    beforeData: {
      personName: existing.person.fullName,
      branchName: existing.branch.name,
      slot: existing.slot,
    } as any,
    actorUserId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
