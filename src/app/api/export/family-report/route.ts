import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FamilyReport } from "@/lib/pdf-family-report";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isActive: true } });
  if (!user?.isActive) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const activePerson = { deletedAt: null };
    const [totalPeople, parentChildRelations, partnerships, couples] = await Promise.all([
      prisma.person.count({ where: activePerson }),
      prisma.personChild.count({
        where: { parent: { deletedAt: null }, child: { deletedAt: null } },
      }),
      prisma.personPartner.count({
        where: { partnerA: { deletedAt: null }, partnerB: { deletedAt: null } },
      }),
      prisma.personPartner.count({
        where: { status: "MARRIED", partnerA: { deletedAt: null }, partnerB: { deletedAt: null } },
      }),
    ]);

    const report: FamilyReport = {
      title: "Arsip Keluarga Wirjodihardjo",
      generatedAt: new Date().toISOString(),
      totalPeople,
      parentChildRelations,
      partnerships,
      couples,
      nodes: totalPeople,
    };

    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Gagal menyiapkan laporan keluarga" }, { status: 500 });
  }
}