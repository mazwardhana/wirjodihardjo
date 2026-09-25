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

// PUT: update registration status (confirm/cancel)
export async function PUT(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { id, status } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID pendaftaran diperlukan" }, { status: 400 });
  }

  if (!status || !["CONFIRMED", "CANCELLED"].includes(status as string)) {
    return NextResponse.json({ error: "Status harus CONFIRMED atau CANCELLED" }, { status: 400 });
  }

  const existing = await prisma.reunionRegistration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
  }

  const registration = await prisma.reunionRegistration.update({
    where: { id },
    data: { status: status as "CONFIRMED" | "CANCELLED" },
  });

  await logAudit({
    action: status === "CANCELLED" ? "REGISTRATION_CANCEL" : "REGISTRATION_CONFIRM",
    entityType: "ReunionRegistration",
    entityId: id,
    beforeData: { status: existing.status } as any,
    afterData: { status } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(registration);
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
    beforeData: { status: existing.status } as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}