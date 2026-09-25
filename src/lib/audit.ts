import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

export async function logAudit(params: {
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  actorUserId?: string | null;
}) {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ipAddress = h.get("x-forwarded-for") ?? null;
    userAgent = h.get("user-agent") ?? null;
  } catch {}

  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeData: params.beforeData,
      afterData: params.afterData,
      actorUserId: params.actorUserId,
      actorLabel: null, // diisi oleh pemanggil bila perlu
      ipAddress,
      userAgent,
    },
  });
}