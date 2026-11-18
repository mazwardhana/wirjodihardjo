import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { FAMILY_EVENT_TYPES, FAMILY_EVENT_TYPE_LABEL } from "@/lib/calendar";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "event-keluarga";
}

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

// GET: list semua event (termasuk draft) untuk panel admin.
export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const where = q
    ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }] }
    : {};

  const events = await prisma.familyEvent.findMany({
    where,
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { rsvps: true } } },
  });
  return NextResponse.json(events);
}

// POST: buat event.
export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const title = body.title;
  const type = body.type;
  const startsAt = body.startsAt;
  const slug = body.slug;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Judul event wajib diisi" }, { status: 400 });
  }
  if (!isEventType(type)) {
    return NextResponse.json({ error: "Tipe event tidak valid" }, { status: 400 });
  }
  if (typeof startsAt !== "string" || Number.isNaN(new Date(startsAt).getTime())) {
    return NextResponse.json({ error: "Tanggal mulai wajib valid" }, { status: 400 });
  }

  const finalSlug = slug && typeof slug === "string" && slug.trim()
    ? slug.trim()
    : slugify(title) + "-" + Date.now().toString(36);
  const existing = await prisma.familyEvent.findUnique({ where: { slug: finalSlug } });
  if (existing) {
    return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
  }

  const event = await prisma.familyEvent.create({
    data: {
      title: title.trim(),
      type: type as never,
      description: typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null,
      startsAt: new Date(startsAt as string),
      endsAt: typeof body.endsAt === "string" && body.endsAt
        ? new Date(body.endsAt)
        : null,
      locationName: typeof body.locationName === "string" && body.locationName.trim()
        ? body.locationName.trim()
        : null,
      repeatYearly: body.repeatYearly === true,
      slug: finalSlug,
      isPublished: body.isPublished === true,
      createdByUserId: user.id,
    },
  });

  await logAudit({
    action: "EVENT_CREATE",
    entityType: "FamilyEvent",
    entityId: event.id,
    afterData: { title: event.title, type: event.type, slug: event.slug } as never,
    actorUserId: user.id,
  });

  return NextResponse.json(event, { status: 201 });
}
