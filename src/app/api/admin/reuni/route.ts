import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "reuni";
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

// GET: list reunions with registration counts
export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const reunions = await prisma.reunion.findMany({
    orderBy: { startAt: "desc" },
    include: {
      _count: { select: { registrations: true } },
      createdBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  return NextResponse.json(reunions);
}

// POST: create reunion
export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { title, slug, description, startAt, endAt, locationName, locationUrl, capacity, registrationDeadline, heroImageUrl } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Judul reuni wajib diisi" }, { status: 400 });
  }

  if (!startAt || typeof startAt !== "string") {
    return NextResponse.json({ error: "Tanggal mulai wajib diisi" }, { status: 400 });
  }

  const finalSlug = slug && typeof slug === "string" && slug.trim()
    ? slug.trim()
    : slugify(title as string);

  // Check slug uniqueness
  const existing = await prisma.reunion.findUnique({ where: { slug: finalSlug } });
  if (existing) {
    return NextResponse.json({ error: "Slug sudah digunakan, gunakan judul yang berbeda" }, { status: 409 });
  }

  const reunion = await prisma.reunion.create({
    data: {
      title: title.trim(),
      slug: finalSlug,
      description: description ? (description as string).trim() : null,
      startAt: new Date(startAt as string),
      endAt: endAt ? new Date(endAt as string) : null,
      locationName: locationName ? (locationName as string).trim() : null,
      locationUrl: locationUrl ? (locationUrl as string).trim() : null,
      capacity: capacity ? parseInt(capacity as string) : null,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline as string) : null,
      heroImageUrl: heroImageUrl ? (heroImageUrl as string) : null,
      createdByUserId: user.id,
    },
  });

  await logAudit({
    action: "REUNION_CREATE",
    entityType: "Reunion",
    entityId: reunion.id,
    afterData: { title: reunion.title, slug: reunion.slug } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(reunion, { status: 201 });
}

// PUT: update reunion (all fields + status transitions)
export async function PUT(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { id, title, slug, description, startAt, endAt, locationName, locationUrl, capacity, registrationDeadline, heroImageUrl, status } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID reuni diperlukan" }, { status: 400 });
  }

  const existing = await prisma.reunion.findUnique({
    where: { id },
    include: { _count: { select: { registrations: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Reuni tidak ditemukan" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  // Validate and apply status transitions
  if (status !== undefined) {
    const validStatuses = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"];
    if (!validStatuses.includes(status as string)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    }

    // Status transition rules
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ["PUBLISHED", "CANCELLED"],
      PUBLISHED: ["COMPLETED", "CANCELLED"],
      CANCELLED: ["DRAFT", "PUBLISHED"],
      COMPLETED: [],
    };

    const currentStatus = existing.status;
    const newStatus = status as string;

    if (newStatus !== currentStatus) {
      const allowed = allowedTransitions[currentStatus] || [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json({
          error: `Tidak bisa mengubah status dari ${currentStatus} ke ${newStatus}`,
        }, { status: 400 });
      }
      updateData.status = newStatus;
    }
  }

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Judul tidak valid" }, { status: 400 });
    }
    updateData.title = title.trim();
  }

  if (slug !== undefined) {
    const newSlug = typeof slug === "string" ? slug.trim() : slugify(existing.title);
    if (newSlug !== existing.slug) {
      const slugExists = await prisma.reunion.findUnique({ where: { slug: newSlug } });
      if (slugExists) {
        return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
      }
      updateData.slug = newSlug;
    }
  }

  if (description !== undefined) {
    updateData.description = (description as string)?.trim() || null;
  }
  if (startAt !== undefined) {
    updateData.startAt = new Date(startAt as string);
  }
  if (endAt !== undefined) {
    updateData.endAt = endAt ? new Date(endAt as string) : null;
  }
  if (locationName !== undefined) {
    updateData.locationName = (locationName as string)?.trim() || null;
  }
  if (locationUrl !== undefined) {
    updateData.locationUrl = (locationUrl as string)?.trim() || null;
  }
  if (capacity !== undefined) {
    updateData.capacity = capacity ? parseInt(capacity as string) : null;
  }
  if (registrationDeadline !== undefined) {
    updateData.registrationDeadline = registrationDeadline ? new Date(registrationDeadline as string) : null;
  }
  if (heroImageUrl !== undefined) {
    updateData.heroImageUrl = (heroImageUrl as string) || null;
  }

  const reunion = await prisma.reunion.update({
    where: { id },
    data: updateData as any,
  });

  await logAudit({
    action: status !== undefined && status !== existing.status
      ? `REUNION_${status}`
      : "REUNION_UPDATE",
    entityType: "Reunion",
    entityId: reunion.id,
    beforeData: { title: existing.title, status: existing.status } as any,
    afterData: { title: reunion.title, status: reunion.status } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(reunion);
}

// DELETE: delete reunion
export async function DELETE(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID reuni diperlukan" }, { status: 400 });
  }

  const existing = await prisma.reunion.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Reuni tidak ditemukan" }, { status: 404 });
  }

  // Cascade delete: ReunionRegistration onDelete: Cascade is set in schema
  await prisma.reunion.delete({ where: { id } });

  await logAudit({
    action: "REUNION_DELETE",
    entityType: "Reunion",
    entityId: id,
    beforeData: { title: existing.title } as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}