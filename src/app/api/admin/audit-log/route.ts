import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  // Single log with detail
  if (id) {
    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            email: true,
            person: { select: { fullName: true } },
          },
        },
      },
    });
    if (!log) {
      return NextResponse.json({ error: "Log tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(log);
  }

  // List with filters
  const action = url.searchParams.get("action") ?? undefined;
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const actor = url.searchParams.get("actor") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

  const where: Record<string, unknown> = {};

  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (actor) {
    // Search by actor email — find matching user IDs first
    const matchingUsers = await prisma.user.findMany({
      where: { email: { contains: actor, mode: "insensitive" } },
      select: { id: true },
    });
    where.actorUserId = { in: matchingUsers.map((u) => u.id) };
  }
  if (dateFrom) {
    where.createdAt = { ...((where.createdAt as Record<string, unknown>) ?? {}), gte: new Date(dateFrom) };
  }
  if (dateTo) {
    // Include the entire end day
    const endDate = new Date(dateTo);
    endDate.setDate(endDate.getDate() + 1);
    where.createdAt = { ...((where.createdAt as Record<string, unknown>) ?? {}), lt: endDate };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: {
          select: {
            email: true,
            person: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.auditLog.count({ where: where as any }),
  ]);

  return NextResponse.json({
    logs,
    total,
    hasMore: offset + logs.length < total,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  // Return unique actions and entity types for filter dropdowns
  const [actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    }),
  ]);

  return NextResponse.json({
    actions: actions.map((a) => a.action),
    entityTypes: entityTypes.map((e) => e.entityType),
  });
}