import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";

export default async function AdminAuditLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const [logs, actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: {
          select: {
            email: true,
            person: { select: { fullName: true } },
          },
        },
      },
    }),
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

  return (
    <div className="p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-forest">Audit Log</h1>
        <p className="mt-1 text-sm text-muted">Riwayat perubahan dan aktivitas sistem</p>
      </div>

      <AuditLogViewer
        initialLogs={logs.map((l) => ({
          id: l.id,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          beforeData: l.beforeData as Record<string, unknown> | null,
          afterData: l.afterData as Record<string, unknown> | null,
          actorLabel: l.actorLabel,
          ipAddress: l.ipAddress,
          actor: l.actor
            ? {
                email: l.actor.email,
                person: { fullName: l.actor.person.fullName },
              }
            : null,
          createdAt: l.createdAt.toISOString(),
        }))}
        uniqueActions={actions.map((a) => a.action)}
        uniqueEntityTypes={entityTypes.map((e) => e.entityType)}
      />
    </div>
  );
}