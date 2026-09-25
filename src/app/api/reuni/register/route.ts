import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseGuestCount(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(20, Math.max(1, Math.trunc(n)));
}

// POST: daftar atau ubah pendaftaran reuni (upsert)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Masuk dulu untuk mendaftar reuni." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { reunionId, guestCount, notes } = body;

  if (!reunionId || typeof reunionId !== "string") {
    return NextResponse.json({ error: "ID reuni diperlukan" }, { status: 400 });
  }

  const reunion = await prisma.reunion.findUnique({ where: { id: reunionId } });
  if (!reunion) {
    return NextResponse.json({ error: "Reuni tidak ditemukan" }, { status: 404 });
  }

  if (reunion.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Pendaftaran belum dibuka untuk reuni ini." }, { status: 400 });
  }

  const now = new Date();
  if (new Date(reunion.startAt) <= now) {
    return NextResponse.json({ error: "Reuni sudah berlangsung, pendaftaran ditutup." }, { status: 400 });
  }
  if (reunion.registrationDeadline && new Date(reunion.registrationDeadline) < now) {
    return NextResponse.json({ error: "Batas pendaftaran sudah lewat." }, { status: 400 });
  }

  const gc = parseGuestCount(guestCount);
  const trimmedNotes = typeof notes === "string" && notes.trim() ? notes.trim() : null;

  // Kuota dihitung dari jumlah orang, bukan jumlah pendaftar.
  let status: "CONFIRMED" | "WAITLIST" = "CONFIRMED";
  if (reunion.capacity) {
    const others = await prisma.reunionRegistration.aggregate({
      where: {
        reunionId,
        status: "CONFIRMED",
        userId: { not: session.user.id },
      },
      _sum: { guestCount: true },
    });
    const seatsTaken = others._sum.guestCount ?? 0;
    if (seatsTaken + gc > reunion.capacity) status = "WAITLIST";
  }

  const registration = await prisma.reunionRegistration.upsert({
    where: {
      reunionId_userId: { reunionId, userId: session.user.id },
    },
    update: { guestCount: gc, notes: trimmedNotes, status },
    create: {
      reunionId,
      userId: session.user.id,
      guestCount: gc,
      notes: trimmedNotes,
      status,
    },
  });

  return NextResponse.json(registration, { status: 201 });
}

// DELETE: batalkan pendaftaran (status CANCELLED)
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Masuk dulu untuk membatalkan pendaftaran." }, { status: 401 });
  }

  const reunionId = new URL(request.url).searchParams.get("reunionId");
  if (!reunionId) {
    return NextResponse.json({ error: "ID reuni diperlukan" }, { status: 400 });
  }

  const existing = await prisma.reunionRegistration.findUnique({
    where: { reunionId_userId: { reunionId, userId: session.user.id } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Anda belum terdaftar di reuni ini." }, { status: 404 });
  }

  if (existing.status === "CANCELLED") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  await prisma.reunionRegistration.update({
    where: { id: existing.id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ ok: true });
}