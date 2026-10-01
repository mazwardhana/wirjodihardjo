import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { FilterBar } from "@/components/admin/FilterBar";
import { auditLogQuery } from "./query";

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  PERSON_CREATE: "Tambah Anggota",
  PERSON_UPDATE: "Ubah Anggota",
  PERSON_DELETE: "Hapus Anggota",
  PERSON_RESTORE: "Pulihkan Anggota",
  HALL_OF_FAME_CREATE: "Tambah HoF",
  HALL_OF_FAME_UPDATE: "Ubah HoF",
  HALL_OF_FAME_DELETE: "Hapus HoF",
  ALBUM_CREATE: "Tambah Album",
  ALBUM_UPDATE: "Ubah Album",
  ALBUM_DELETE: "Hapus Album",
  MEDIA_MODERATE: "Moderasi Media",
  USER_CREATE: "Tambah Pengguna",
  USER_DEACTIVATE: "Nonaktifkan Pengguna",
  USER_ACTIVATE: "Aktifkan Pengguna",
  REUNION_CREATE: "Tambah Reuni",
  REUNION_UPDATE: "Ubah Reuni",
  REUNION_DELETE: "Hapus Reuni",
  SUBMISSION_APPROVE: "Setujui Pengajuan",
  SUBMISSION_REJECT: "Tolak Pengajuan",
  BRANCH_CREATE: "Tambah Keluarga Cabang",
  BRANCH_UPDATE: "Ubah Keluarga Cabang",
  LOGIN: "Login",
};

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const { where, limit, page: requestedPage } = auditLogQuery(sp);
  const total = await prisma.auditLog.count({ where });
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / limit)));
  const offset = (page - 1) * limit;

  const [logs, actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
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

  const hasMore = offset + logs.length < total;

  return (
    <div className="p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-forest">Audit Log</h1>
        <p className="mt-1 text-sm text-muted">
          Riwayat perubahan dan aktivitas sistem. {total} log tercatat
        </p>
      </div>

      <div className="mt-6">
        <FilterBar
          config={{
            search: {
              placeholder: "Cari aktor, email, atau entity ID...",
              param: "q",
            },
            filters: [
              {
                param: "action",
                label: "Aksi",
                options: actions.map((a) => ({ value: a.action, label: actionLabels[a.action] ?? a.action })),
              },
              {
                param: "entityType",
                label: "Entitas",
                options: entityTypes.map((e) => ({ value: e.entityType, label: e.entityType })),
              },
            ],
          }}
        />
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
          total={total}
          hasMore={hasMore}
          page={page}
        />
    </div>
  );
}
