import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET: list branches with rootPerson, admin, member count
export async function GET() {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const branches = await prisma.branch.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      rootPerson: { select: { id: true, fullName: true } },
      admin: { select: { id: true, email: true, role: true, person: { select: { fullName: true } } } },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json(branches);
}

// POST: create branch
export async function POST(request: Request) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { name, description, coverImageUrl, orderIndex } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nama cabang wajib diisi" }, { status: 400 });
  }

  let slug = slugify(name.trim());
  // Ensure unique slug
  const existing = await prisma.branch.findUnique({ where: { slug } });
  if (existing) {
    const suffix = Date.now().toString(36);
    slug = `${slug}-${suffix}`;
  }

  const branch = await prisma.branch.create({
    data: {
      name: name.trim(),
      slug,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      coverImageUrl: typeof coverImageUrl === "string" && coverImageUrl.trim() ? coverImageUrl.trim() : null,
      orderIndex: typeof orderIndex === "number" ? orderIndex : 0,
    },
    include: {
      rootPerson: { select: { id: true, fullName: true } },
      admin: { select: { id: true, email: true, role: true, person: { select: { fullName: true } } } },
      _count: { select: { members: true } },
    },
  });

  await logAudit({
    action: "BRANCH_CREATE",
    entityType: "Branch",
    entityId: branch.id,
    afterData: { name: branch.name, slug: branch.slug } as any,
    actorUserId: user.id,
  });

  return NextResponse.json(branch, { status: 201 });
}

// PUT: update branch
export async function PUT(request: Request) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { id, name, description, coverImageUrl, orderIndex, isActive, rootPersonId, adminId } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID cabang diperlukan" }, { status: 400 });
  }

  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nama cabang tidak valid" }, { status: 400 });
    }
    data.name = name.trim();
    // Regenerate slug if name changes
    let slug = slugify(name.trim());
    const slugConflict = await prisma.branch.findFirst({
      where: { slug, id: { not: id } },
    });
    if (slugConflict) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    data.slug = slug;
  }

  if (description !== undefined) {
    data.description = typeof description === "string" && description.trim() ? description.trim() : null;
  }

  if (coverImageUrl !== undefined) {
    data.coverImageUrl = typeof coverImageUrl === "string" && coverImageUrl.trim() ? coverImageUrl.trim() : null;
  }

  if (orderIndex !== undefined) {
    data.orderIndex = typeof orderIndex === "number" ? orderIndex : 0;
  }

  if (isActive !== undefined) {
    data.isActive = Boolean(isActive);
  }

  if (rootPersonId !== undefined) {
    if (rootPersonId === null || rootPersonId === "") {
      data.rootPerson = { disconnect: true };
    } else {
      // Check if person exists
      const person = await prisma.person.findUnique({ where: { id: rootPersonId as string } });
      if (!person) {
        return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
      }
      // Check if person is already root of another branch
      const otherBranch = await prisma.branch.findFirst({
        where: { rootPersonId: rootPersonId as string, id: { not: id } },
      });
      if (otherBranch) {
        return NextResponse.json(
          { error: "Anggota ini sudah menjadi akar dari cabang lain" },
          { status: 409 },
        );
      }
      data.rootPerson = { connect: { id: rootPersonId } };
    }
  }

  if (adminId !== undefined) {
    if (adminId === null || adminId === "") {
      data.admin = { disconnect: true };
    } else {
      // Check if user exists
      const adminUser = await prisma.user.findUnique({ where: { id: adminId as string } });
      if (!adminUser) {
        return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
      }
      // Check if user is already admin of another branch
      const otherBranch = await prisma.branch.findFirst({
        where: { adminId: adminId as string, id: { not: id } },
      });
      if (otherBranch) {
        return NextResponse.json(
          { error: "Pengguna ini sudah menjadi admin cabang lain" },
          { status: 409 },
        );
      }
      data.admin = { connect: { id: adminId } };
    }
  }

  const branch = await prisma.branch.update({
    where: { id },
    data: data as any,
    include: {
      rootPerson: { select: { id: true, fullName: true } },
      admin: { select: { id: true, email: true, role: true, person: { select: { fullName: true } } } },
      _count: { select: { members: true } },
    },
  });

  await logAudit({
    action: "BRANCH_UPDATE",
    entityType: "Branch",
    entityId: branch.id,
    beforeData: existing as any,
    afterData: body as any,
    actorUserId: user.id,
  });

  return NextResponse.json(branch);
}

// DELETE: soft deactivate (set isActive = false)
export async function DELETE(request: Request) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID cabang diperlukan" }, { status: 400 });
  }

  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
  }

  const branch = await prisma.branch.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit({
    action: "BRANCH_DEACTIVATE",
    entityType: "Branch",
    entityId: branch.id,
    beforeData: { isActive: existing.isActive } as any,
    afterData: { isActive: false } as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}