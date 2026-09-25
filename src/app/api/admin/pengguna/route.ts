import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import crypto from "crypto";

type AdminGuard = { user: { id: string; role: string } };
type GuardResult = AdminGuard | NextResponse;

function isGuardError(r: GuardResult): r is NextResponse {
  return r instanceof NextResponse;
}

async function checkSuperAdmin(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }
  return { user };
}

// ──────────────────────────────────────
// GET — list users
// ──────────────────────────────────────
export async function GET(request: Request) {
  const guard = await checkSuperAdmin();
  if (isGuardError(guard)) return guard;
  const { user: admin } = guard;

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (q.trim().length > 0) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { person: { fullName: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (role && ["SUPER_ADMIN", "BRANCH_ADMIN", "MEMBER"].includes(role)) {
    where.role = role;
  }
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;

  const users = await prisma.user.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" },
    include: {
      person: { select: { id: true, fullName: true, photoUrl: true } },
      createdBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  return NextResponse.json(users);
}

// ──────────────────────────────────────
// POST — create user OR reset password
// ──────────────────────────────────────
export async function POST(request: Request) {
  const guard = await checkSuperAdmin();
  if (isGuardError(guard)) return guard;
  const { user: admin } = guard;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  // ── Reset password action ──
  if (body.action === "reset-password") {
    const userId = body.userId as string;
    if (!userId) {
      return NextResponse.json({ error: "userId diperlukan" }, { status: 400 });
    }
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const randomPassword = crypto.randomBytes(12).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true, passwordResetToken: null, passwordResetExpires: null },
    });

    await logAudit({ action: "USER_RESET_PASSWORD", entityType: "User", entityId: userId, actorUserId: admin.id });

    return NextResponse.json({ ok: true, newPassword: randomPassword });
  }

  // ── Create user ──
  const { email, password, role, personId } = body;

  if (!email || !password || !role || !personId) {
    return NextResponse.json({ error: "Email, password, role, dan personId diperlukan" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }
  if (!["SUPER_ADMIN", "BRANCH_ADMIN", "MEMBER"].includes(role as string)) {
    return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: email as string } });
  if (existingEmail) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });

  const existingPersonUser = await prisma.user.findUnique({ where: { personId: personId as string } });
  if (existingPersonUser) return NextResponse.json({ error: "Orang ini sudah memiliki akun" }, { status: 409 });

  const person = await prisma.person.findUnique({ where: { id: personId as string } });
  if (!person) return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });

  const passwordHash = await bcrypt.hash(password as string, 12);

  const user = await prisma.user.create({
    data: {
      email: (email as string).toLowerCase(),
      passwordHash,
      role: role as any,
      personId: personId as string,
      createdById: admin.id,
    },
    include: { person: { select: { id: true, fullName: true } } },
  });

  await logAudit({
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    afterData: { email: user.email, role: user.role, personId: user.personId } as any,
    actorUserId: admin.id,
  });

  return NextResponse.json(user, { status: 201 });
}

// ──────────────────────────────────────
// PUT — update user
// ──────────────────────────────────────
export async function PUT(request: Request) {
  const guard = await checkSuperAdmin();
  if (isGuardError(guard)) return guard;
  const { user: admin } = guard;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const { id, role, isActive, isVerified, mustChangePassword } = body;
  if (!id) return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { id: id as string } });
  if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (role !== undefined) {
    if (!["SUPER_ADMIN", "BRANCH_ADMIN", "MEMBER"].includes(role as string)) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }
    data.role = role;
  }
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (isVerified !== undefined) data.isVerified = Boolean(isVerified);
  if (mustChangePassword !== undefined) data.mustChangePassword = Boolean(mustChangePassword);

  const updated = await prisma.user.update({
    where: { id: id as string },
    data: data as any,
    include: { person: { select: { id: true, fullName: true } } },
  });

  await logAudit({
    action: "USER_UPDATE",
    entityType: "User",
    entityId: id as string,
    beforeData: { role: existing.role, isActive: existing.isActive, isVerified: existing.isVerified } as any,
    afterData: data as any,
    actorUserId: admin.id,
  });

  return NextResponse.json(updated);
}

// ──────────────────────────────────────
// DELETE — delete user
// ──────────────────────────────────────
export async function DELETE(request: Request) {
  const guard = await checkSuperAdmin();
  if (isGuardError(guard)) return guard;
  const { user: admin } = guard;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  if (id === admin.id) {
    return NextResponse.json({ error: "Tidak dapat menghapus akun sendiri" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  await prisma.user.delete({ where: { id } });

  await logAudit({
    action: "USER_DELETE",
    entityType: "User",
    entityId: id,
    beforeData: { email: existing.email, role: existing.role } as any,
    actorUserId: admin.id,
  });

  return NextResponse.json({ ok: true });
}