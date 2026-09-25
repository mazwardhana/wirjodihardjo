"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { JsonDiff } from "@/components/admin/JsonDiff";

/* ─── Types ─── */

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

interface FilterValues {
  action: string;
  entityType: string;
  actor: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
}

const defaultFilters: FilterValues = {
  action: "",
  entityType: "",
  actor: "",
  dateFrom: "",
  dateTo: "",
  limit: 50,
};

const selectCls =
  "rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

const inputCls =
  "rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest placeholder:text-muted/50 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

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

function actionLabel(action: string): string {
  return actionLabels[action] ?? action;
}

/* ─── Main component ─── */

export function AuditLogViewer({
  initialLogs,
  uniqueActions,
  uniqueEntityTypes,
}: {
  initialLogs: AuditLogEntry[];
  uniqueActions: string[];
  uniqueEntityTypes: string[];
}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialLogs.length >= 50);
  const [total, setTotal] = useState<number | null>(null);
  const offsetRef = useRef(initialLogs.length);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchLogs = useCallback(
    async (append = false) => {
      const params = new URLSearchParams();
      if (append && offsetRef.current > 0) params.set("offset", String(offsetRef.current));
      if (filters.action) params.set("action", filters.action);
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.actor) params.set("actor", filters.actor);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      params.set("limit", String(filters.limit));

      const setLoader = append ? setLoadingMore : setLoading;
      setLoader(true);

      try {
        const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
        if (!res.ok) throw new Error("Gagal memuat log");
        const data = await res.json();

        if (append) {
          setLogs((prev) => [...prev, ...data.logs]);
        } else {
          setLogs(data.logs);
        }
        setHasMore(data.hasMore);
        setTotal(data.total ?? null);
        offsetRef.current = append ? offsetRef.current + data.logs.length : data.logs.length;
      } catch {
        // silent
      } finally {
        setLoader(false);
      }
    },
    [filters],
  );

  // Debounced filter changes
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchLogs(false);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [fetchLogs]);

  function handleFilterChange(key: keyof FilterValues, value: string | number) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(defaultFilters);
    offsetRef.current = 0;
  }

  const hasActiveFilters =
    filters.action !== "" ||
    filters.entityType !== "" ||
    filters.actor !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const filtering = hasActiveFilters || filters.limit !== 50;

  return (
    <div>
      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted">
          <span className="text-xs">Aksi</span>
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange("action", e.target.value)}
            className={selectCls}
          >
            <option value="">Semua aksi</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          <span className="text-xs">Entitas</span>
          <select
            value={filters.entityType}
            onChange={(e) => handleFilterChange("entityType", e.target.value)}
            className={selectCls}
          >
            <option value="">Semua entitas</option>
            {uniqueEntityTypes.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          <span className="text-xs">Aktor (email)</span>
          <input
            type="text"
            value={filters.actor}
            onChange={(e) => handleFilterChange("actor", e.target.value)}
            placeholder="Cari email..."
            className={`${inputCls} w-44`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          <span className="text-xs">Dari tanggal</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          <span className="text-xs">Sampai tanggal</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          <span className="text-xs">Limit</span>
          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange("limit", Number(e.target.value))}
            className={selectCls}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        {filtering && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
          >
            Reset
          </button>
        )}

        {total !== null && (
          <p className="ml-auto text-xs text-muted">
            {logs.length} dari {total} log
          </p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-8 flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
          <span className="ml-3 text-sm text-muted">Memuat log...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-wood/25 bg-cream px-4 py-12 text-center text-sm text-muted">
          {filtering
            ? "Tidak ada log yang cocok dengan filter."
            : "Belum ada aktivitas tercatat."}
        </div>
      )}

      {/* Logs table */}
      {!loading && logs.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-wood/15">
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
                <LogRow
                  key={log.id}
                  log={log}
                  isExpanded={expandedId === log.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === log.id ? null : log.id))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => fetchLogs(true)}
            disabled={loadingMore}
            className="rounded-md border border-wood/30 px-6 py-2 text-sm font-medium text-forest transition-colors hover:bg-wood/10 disabled:opacity-50"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />
                Memuat...
              </span>
            ) : (
              "Muat lebih banyak"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Row component ─── */

function LogRow({
  log,
  isExpanded,
  onToggle,
}: {
  log: AuditLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasDiff = log.beforeData || log.afterData;

  return (
    <>
      <tr
        className={`cursor-pointer border-b border-wood/10 transition-colors last:border-0 hover:bg-parchment/30 ${
          isExpanded ? "bg-parchment/20" : ""
        }`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <td className="px-4 py-3">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
              log.action.startsWith("CREATE")
                ? "bg-green-100 text-green-800"
                : log.action.startsWith("DELETE")
                  ? "bg-red-100 text-red-800"
                  : log.action.startsWith("LOGIN")
                    ? "bg-blue-100 text-blue-800"
                    : "bg-amber-100 text-amber-800"
            }`}
          >
            {actionLabel(log.action)}
          </span>
        </td>
        <td className="px-4 py-3 text-muted">{log.entityType}</td>
        <td className="px-4 py-3 font-mono text-[11px] text-muted">
          {log.entityId ? log.entityId.slice(0, 8) + "…" : "-"}
        </td>
        <td className="px-4 py-3 text-muted">{log.actor?.email ?? log.actorLabel ?? "sistem"}</td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
          {formatDateTime(log.createdAt)}
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr className="border-b border-wood/10 bg-cream">
          <td colSpan={5} className="px-6 py-4">
            <div className="space-y-4">
              {/* Detail info */}
              <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
                <div>
                  <span className="block text-[10px] font-medium text-muted">Aksi</span>
                  <span className="text-forest">{actionLabel(log.action)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-muted">Entitas</span>
                  <span className="text-forest">{log.entityType}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-muted">ID Entitas</span>
                  <span className="font-mono text-[11px] text-forest">{log.entityId ?? "-"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-muted">Aktor</span>
                  <span className="text-forest">
                    {log.actor
                      ? `${log.actor.person.fullName} (${log.actor.email})`
                      : log.actorLabel ?? "sistem"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-muted">Waktu</span>
                  <span className="text-forest">{formatDateTime(log.createdAt)}</span>
                </div>
                {log.ipAddress && (
                  <div>
                    <span className="block text-[10px] font-medium text-muted">IP</span>
                    <span className="text-forest">{log.ipAddress}</span>
                  </div>
                )}
              </div>

              {/* Diff viewer */}
              {hasDiff ? (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-forest">Perubahan Data</h4>
                  <JsonDiff before={log.beforeData} after={log.afterData} />
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-wood/20 bg-parchment/30 px-4 py-3 text-xs text-muted">
                  Tidak ada data perubahan untuk aksi ini.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}