import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const RSVP_STATUSES = ["GOING", "MAYBE", "NOT_GOING"] as const;
type RsvpStatus = (typeof RSVP_STATUSES)[number];

function isRsvpStatus(value: unknown): value is RsvpStatus {
  return typeof value === "string" && (RSVP_STATUSES as readonly string[]).includes(value);
}

// POST: set RSVP (upsert) untuk user login pada event published.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Masuk dulu untuk RSVP." }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  if (!isRsvpStatus(body.status)) {
    return NextResponse.json({ error: "Status RSVP tidak valid" }, { status: 400 });
  }

  const event = await prisma.familyEvent.findUnique({
    where: { id },
    select: { id: true, isPublished: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
  }
  if (!event.isPublished) {
    return NextResponse.json({ error: "Event belum dipublikasikan" }, { status: 403 });
  }

  const rsvp = await prisma.familyEventRsvp.upsert({
    where: { eventId_userId: { eventId: id, userId: session.user.id } },
    update: { status: body.status },
    create: { eventId: id, userId: session.user.id, status: body.status },
  });

  return NextResponse.json(rsvp, { status: 201 });
}

// DELETE: hapus RSVP user.
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Masuk dulu." }, { status: 401 });
  }
  const { id } = await ctx.params;

  const existing = await prisma.familyEventRsvp.findUnique({
    where: { eventId_userId: { eventId: id, userId: session.user.id } },
  });
  if (!existing) {
    return NextResponse.json({ error: "RSVP tidak ditemukan" }, { status: 404 });
  }
  await prisma.familyEventRsvp.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}