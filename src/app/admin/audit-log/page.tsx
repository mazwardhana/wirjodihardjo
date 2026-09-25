import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminAuditLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Audit Log</h1>

      {logs.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Belum ada aktivitas" description="Riwayat perubahan akan tercatat di sini." />
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="rounded-lg border border-wood/15 bg-cream px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-forest">{log.action}</span>
                <span className="text-xs text-muted">{formatDateTime(log.createdAt)}</span>
              </div>
              <p className="text-xs text-muted">
                {log.entityType} {log.entityId ? `#${log.entityId.slice(0, 8)}` : ""} · {log.actor?.email ?? "sistem"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}