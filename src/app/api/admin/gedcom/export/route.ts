import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeGedcom, type GedcomExportPerson } from "@/lib/gedcom/export";

/**
 * GET /api/admin/gedcom/export — ekspor seluruh data keluarga ke GEDCOM 5.5.1.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isActive: true } });
    if (!user?.isActive) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const people = await prisma.person.findMany({
      where: { deletedAt: null },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        externalRef: true,
        fullName: true,
        nickname: true,
        gender: true,
        birthDate: true,
        birthPlace: true,
        deathDate: true,
        deathPlace: true,
        isDeceased: true,
        occupation: true,
        bio: true,
        parents: { select: { parent: { select: { id: true, gender: true } } } },
        children: { select: { childId: true } },
        partnershipsA: {
          select: { partnerBId: true, status: true, marriageDate: true, divorceDate: true },
        },
        partnershipsB: {
          select: { partnerAId: true, status: true, marriageDate: true, divorceDate: true },
        },
      },
    });

    const exportPersons: GedcomExportPerson[] = people.map((person) => ({
      id: person.id,
      externalRef: person.externalRef,
      fullName: person.fullName,
      nickname: person.nickname,
      gender: person.gender,
      birthDate: person.birthDate,
      birthPlace: person.birthPlace,
      deathDate: person.deathDate,
      deathPlace: person.deathPlace,
      isDeceased: person.isDeceased,
      occupation: person.occupation,
      notes: person.bio,
      parents: person.parents.map((p) => ({
        parentId: p.parent.id,
        parentGender: p.parent.gender,
      })),
      children: person.children.map((c) => ({ childId: c.childId })),
      partners: [
        ...person.partnershipsA.map((p) => ({
          partnerId: p.partnerBId,
          status: p.status,
          marriageDate: p.marriageDate,
          divorceDate: p.divorceDate,
        })),
        ...person.partnershipsB.map((p) => ({
          partnerId: p.partnerAId,
          status: p.status,
          marriageDate: p.marriageDate,
          divorceDate: p.divorceDate,
        })),
      ],
    }));

    const gedcom = serializeGedcom(exportPersons);
    return new NextResponse(gedcom, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="silsilah-keluarga.ged"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengekspor data keluarga" }, { status: 500 });
  }
}