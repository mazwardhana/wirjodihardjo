import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) return null;
  return user;
}

// GET: list registrations for a reunion
export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const url = new URL(request.url);
  const reunionId = url.searchParams.get("reunionId");

  if (!reunionId) {
    return NextResponse.json({ error: "ID reuni diperlukan" }, { status: 400 });
  }

  const registrations = await prisma.reunionRegistration.findMany({
    where: { reunionId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { person: { select: { fullName: true } } } },
    },
  });

  return NextResponse.json(registrations);
}

// PUT: update registration status (confirm/cancel) dan/atau kehadiran
export async function PUT(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { id, status, attendance } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID pendaftaran diperlukan" }, { status: 400 });
  }

  // Kedua field opsional, tapi setidaknya satu harus dikirim: PUT tanpa satu
  // pun tidak mengubah apa pun, jadi lebih baik ditolak agar tidak disalahartikan.
  const hasStatus = status !== undefined && status !== null;
  const hasAttendance = attendance !== undefined && attendance !== null;
  if (!hasStatus && !hasAttendance) {
    return NextResponse.json(
      { error: "Kirim status atau attendance (minimal salah satu)" },
      { status: 400 },
    );
  }

  if (hasStatus && !["CONFIRMED", "CANCELLED"].includes(status as string)) {
    return NextResponse.json({ error: "Status harus CONFIRMED atau CANCELLED" }, { status: 400 });
  }

  if (hasAttendance && !["ATTENDING", "NOT_ATTENDING"].includes(attendance as string)) {
    return NextResponse.json(
      { error: "Attendance harus ATTENDING atau NOT_ATTENDING" },
      { status: 400 },
    );
  }

  const existing = await prisma.reunionRegistration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
  }

  const nextStatus = hasStatus
    ? (status as "CONFIRMED" | "CANCELLED")
    : undefined;
  const nextAttendance = hasAttendance
    ? (attendance as "ATTENDING" | "NOT_ATTENDING")
    : undefined;

  // Hanya field yang benar-benar dikirim yang ditulis, supaya `status` tidak
  // ikut berubah ketika panitia hanya menandai kehadiran.
  const registration = await prisma.reunionRegistration.update({
    where: { id },
    data: { status: nextStatus, attendance: nextAttendance },
  });

  // Kehadiran punya aksi audit sendiri: perubahan "hadir/tidak ikut" sering
  // terjadi tanpa status ikut bergeser.
  if (hasAttendance) {
    await logAudit({
      action: "ATTENDANCE_SET",
      entityType: "ReunionRegistration",
      entityId: id,
      beforeData: { attendance: existing.attendance },
      afterData: { attendance },
      actorUserId: user.id,
    });
  }

  if (hasStatus) {
    await logAudit({
      action: status === "CANCELLED" ? "REGISTRATION_CANCEL" : "REGISTRATION_CONFIRM",
      entityType: "ReunionRegistration",
      entityId: id,
      beforeData: { status: existing.status },
      afterData: { status: nextStatus },
      actorUserId: user.id,
    });
  }

  return NextResponse.json(registration);
}

// POST: tambah peserta secara manual (anggota yang belum punya akun)
// Dipakai panitia untuk mendaftarkan anggota yang tidak bisa mendaftar sendiri.
export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { reunionId, personId } = body;
  if (!reunionId || typeof reunionId !== "string") {
    return NextResponse.json({ error: "ID reuni diperlukan" }, { status: 400 });
  }
  if (!personId || typeof personId !== "string") {
    return NextResponse.json({ error: "ID anggota diperlukan" }, { status: 400 });
  }

  // `userId` ikut diambil: baris pendaftaran diarahkan ke akun bila ada, agar
  // anggota yang punya akun bisa dikenali dari sisi akunnya juga.
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, fullName: true, user: { select: { id: true } } },
  });
  if (!person) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const userId = person.user?.id ?? null;
  const duplicate = await prisma.reunionRegistration.findFirst({
    where: {
      reunionId,
      OR: [{ personId }, ...(userId ? [{ userId }] : [])],
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Anggota ini sudah terdaftar di reuni tersebut" },
      { status: 409 },
    );
  }

  const registration = await prisma.reunionRegistration.create({
    data: {
      reunionId,
      personId,
      userId,
      status: "CONFIRMED",
      attendance: "ATTENDING",
      guestCount: 1,
    } as never,
  });

  await logAudit({
    action: "REGISTRATION_CREATE_MANUAL",
    entityType: "ReunionRegistration",
    entityId: registration.id,
    afterData: { reunionId, personId, userId, status: "CONFIRMED", attendance: "ATTENDING" },
    actorUserId: user.id,
  });

  return NextResponse.json(registration, { status: 201 });
}

// DELETE: delete a registration entirely
export async function DELETE(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID pendaftaran diperlukan" }, { status: 400 });
  }

  const existing = await prisma.reunionRegistration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
  }

  await prisma.reunionRegistration.delete({ where: { id } });

  await logAudit({
    action: "REGISTRATION_DELETE",
    entityType: "ReunionRegistration",
    entityId: id,
    beforeData: { status: existing.status },
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}