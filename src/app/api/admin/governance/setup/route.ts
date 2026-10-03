import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  DEFAULT_POSITIONS,
  DEFAULT_STRUCTURE_DESCRIPTION,
  DEFAULT_STRUCTURE_NAME,
} from "@/lib/governance-admin";

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

/**
 * POST: buat struktur kepengurusan awal beserta seluruh jabatan bawaannya
 * dalam satu langkah, supaya admin tidak perlu menambah jabatan satu per satu.
 * Menolak bila sudah ada struktur aktif agar tidak menimpa susunan yang ada.
 */
export async function POST() {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const existing = await prisma.governanceStructure.findFirst({
    where: { isActive: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Struktur kepengurusan aktif sudah ada" },
      { status: 409 },
    );
  }

  const structure = await prisma.governanceStructure.create({
    data: {
      name: DEFAULT_STRUCTURE_NAME,
      description: DEFAULT_STRUCTURE_DESCRIPTION,
      startDate: new Date(),
      isActive: true,
    },
  });

  for (const position of DEFAULT_POSITIONS) {
    await prisma.governancePosition.create({
      data: {
        structureId: structure.id,
        name: position.name,
        description: position.description,
        level: position.level,
      },
    });
  }

  await logAudit({
    action: "GOVERNANCE_STRUCTURE_CREATE",
    entityType: "GovernanceStructure",
    entityId: structure.id,
    afterData: {
      name: structure.name,
      positions: DEFAULT_POSITIONS.map((p) => p.name),
    } as never,
    actorUserId: user.id,
  });

  return NextResponse.json(
    { ok: true, structureId: structure.id },
    { status: 201 },
  );
}
