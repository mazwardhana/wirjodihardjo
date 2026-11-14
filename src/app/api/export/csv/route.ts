import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePeopleCsv, type CsvPerson } from "./serialize";

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
        fullName: true,
        birthDate: true,
        deathDate: true,
        isDeceased: true,
        generationLevel: true,
        parents: { select: { parent: { select: { fullName: true } } } },
        children: { select: { child: { select: { fullName: true } } } },
        partnershipsA: { select: { partnerB: { select: { fullName: true } } } },
        partnershipsB: { select: { partnerA: { select: { fullName: true } } } },
      },
    });

    const csv = `﻿${serializePeopleCsv(people as CsvPerson[], new Date())}`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="silsilah-keluarga.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengekspor data keluarga" }, { status: 500 });
  }
}