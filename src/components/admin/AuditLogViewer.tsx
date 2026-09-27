"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import { JsonDiff } from "@/components/admin/JsonDiff";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  actorLabel: string | null;
  ipAddress: string | null;
  actor: { email: string; person: { fullName: string } } | null;
  createdAt: string;
}

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
  BRANCH_CREATE: "Tambah Cabang",
  BRANCH_UPDATE: "Ubah Cabang",
  LOGIN: "Login",
};

const inputCls = "min-h-11 rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

export function AuditLogViewer({
  initialLogs: logs,
  total,
  hasMore,
  page,
}: {
  initialLogs: AuditLogEntry[];
  total: number;
  hasMore: boolean;
  page: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function navigate(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    if (param !== "page") params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div aria-busy={pending}>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {([
          ["dateFrom", "Dari tanggal"],
          ["dateTo", "Sampai tanggal"],
        ] as const).map(([param, label]) => (
          <label key={param} className="flex flex-col gap-1 text-sm text-muted">
            {label}
            <input
              type="date"
              value={searchParams.get(param) ?? ""}
              onChange={(event) => navigate(param, event.target.value)}
              className={inputCls}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm text-muted">
          Log per halaman
          <select value={searchParams.get("limit") ?? "50"} onChange={(event) => navigate("limit", event.target.value)} className={inputCls}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        {(searchParams.has("dateFrom") || searchParams.has("dateTo")) && (
          <button type="button" className={inputCls} onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("dateFrom");
            params.delete("dateTo");
            params.delete("page");
            startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
          }}>Reset tanggal</button>
        )}
        <p className="text-sm text-muted" role="status">
          {pending ? "Memuat log..." : `${total} log, halaman ${page}`}
        </p>
      </div>

      {logs.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-wood/25 px-4 py-12 text-center text-sm text-muted">
          Tidak ada log yang cocok. Ubah atau reset filter untuk melihat aktivitas lainnya.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-wood/15">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit Log</caption>
            <thead>
              <tr className="border-b border-wood/15 bg-parchment/40 text-xs font-medium text-muted">
                <th scope="col" className="px-4 py-3">Aksi</th>
                <th scope="col" className="px-4 py-3">Entitas</th>
                <th scope="col" className="px-4 py-3">ID</th>
                <th scope="col" className="px-4 py-3">Aktor</th>
                <th scope="col" className="px-4 py-3">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <LogRow key={log.id} log={log} isExpanded={expandedId === log.id} onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Halaman audit log" className="mt-6 flex flex-wrap justify-center gap-3">
        {page > 1 && (
          <button type="button" disabled={pending} onClick={() => navigate("page", String(page - 1))} className={inputCls}>Sebelumnya</button>
        )}
        {hasMore && (
          <button type="button" disabled={pending} onClick={() => navigate("page", String(page + 1))} className={inputCls}>Berikutnya</button>
        )}
      </nav>
    </div>
  );
}

function LogRow({ log, isExpanded, onToggle }: {
  log: AuditLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-wood/10 last:border-0">
        <td className="px-4 py-3">
          <button type="button" onClick={onToggle} aria-expanded={isExpanded} className="min-h-11 text-left font-semibold text-forest underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-forest">
            {actionLabels[log.action] ?? log.action}
          </button>
        </td>
        <td className="px-4 py-3 text-muted">{log.entityType}</td>
        <td className="px-4 py-3 font-mono text-xs text-muted">{log.entityId ? `${log.entityId.slice(0, 8)}…` : "-"}</td>
        <td className="px-4 py-3 text-muted">{log.actor?.email ?? log.actorLabel ?? "sistem"}</td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(log.createdAt)}</td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-wood/10 bg-cream">
          <td colSpan={5} className="px-6 py-4">
            <dl className="mb-4 grid gap-4 text-xs sm:grid-cols-2">
              <div><dt className="text-muted">Aksi</dt><dd>{actionLabels[log.action] ?? log.action}</dd></div>
              <div><dt className="text-muted">Entitas</dt><dd>{log.entityType}</dd></div>
              <div><dt className="text-muted">ID Entitas</dt><dd className="break-all">{log.entityId ?? "-"}</dd></div>
              <div><dt className="text-muted">Aktor</dt><dd>{log.actor ? `${log.actor.person.fullName} (${log.actor.email})` : log.actorLabel ?? "sistem"}</dd></div>
              <div><dt className="text-muted">Waktu</dt><dd>{formatDateTime(log.createdAt)}</dd></div>
              {log.ipAddress && <div><dt className="text-muted">IP</dt><dd>{log.ipAddress}</dd></div>}
            </dl>
            {log.beforeData || log.afterData ? (
              <JsonDiff before={log.beforeData} after={log.afterData} />
            ) : (
              <p className="text-sm text-muted">Tidak ada data perubahan untuk aksi ini.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
