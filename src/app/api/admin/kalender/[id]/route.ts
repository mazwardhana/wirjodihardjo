import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { FAMILY_EVENT_TYPES } from "@/lib/calendar";

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

function isEventType(value: unknown): value is (typeof FAMILY_EVENT_TYPES)[number] {
  return typeof value === "string" && FAMILY_EVENT_TYPES.includes(value as never);
}

// PUT: update event (termasuk publish/unpublish via isPublished).
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const existing = await prisma.familyEvent.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
  }

  const title = body.title ?? existing.title;
  const type = body.type ?? existing.type;
  const startsAt = body.startsAt ?? existing.startsAt;
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Judul event wajib diisi" }, { status: 400 });
  }
  if (!isEventType(type)) {
    return NextResponse.json({ error: "Tipe event tidak valid" }, { status: 400 });
  }
  if (typeof startsAt === "string" && Number.isNaN(new Date(startsAt).getTime())) {
    return NextResponse.json({ error: "Tanggal mulai tidak valid" }, { status: 400 });
  }

  const updated = await prisma.familyEvent.update({
    where: { id },
    data: {
      title: typeof title === "string" ? title.trim() : existing.title,
      type: type as never,
      description: typeof body.description === "string"
        ? body.description.trim()
        : body.description === null ? null : existing.description,
      startsAt: typeof startsAt === "string" ? new Date(startsAt) : existing.startsAt,
      endsAt: body.endsAt === undefined ? existing.endsAt
        : typeof body.endsAt === "string" && body.endsAt ? new Date(body.endsAt) : null,
      locationName: body.locationName === undefined ? existing.locationName
        : typeof body.locationName === "string" && body.locationName.trim() ? body.locationName.trim() : null,
      repeatYearly: typeof body.repeatYearly === "boolean" ? body.repeatYearly : existing.repeatYearly,
      isPublished: typeof body.isPublished === "boolean" ? body.isPublished : existing.isPublished,
    },
  });

  await logAudit({
    action: "EVENT_UPDATE",
    entityType: "FamilyEvent",
    entityId: updated.id,
    beforeData: { isPublished: existing.isPublished } as never,
    afterData: { isPublished: updated.isPublished } as never,
    actorUserId: user.id,
  });

  return NextResponse.json(updated);
}

// DELETE: hapus event.
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const existing = await prisma.familyEvent.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
  }

  await prisma.familyEvent.delete({ where: { id } });
  await logAudit({
    action: "EVENT_DELETE",
    entityType: "FamilyEvent",
    entityId: id,
    beforeData: { title: existing.title } as never,
    actorUserId: user.id,
  });
  return NextResponse.json({ ok: true });
}