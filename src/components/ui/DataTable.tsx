"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { LoadingState, EmptyState } from "./States";

export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyTitle = "Tidak ada data",
  emptyDescription = "",
  page = 1,
  totalPages = 1,
  onPageChange,
  onRowClick,
  sortKey: externalSortKey,
  sortDir: externalSortDir,
  onSort,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (p: number) => void;
  onRowClick?: (item: T) => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
}) {
  const [internalSort, setInternalSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sortKey = externalSortKey ?? internalSort?.key;
  const sortDir = externalSortDir ?? internalSort?.dir;

  function handleSort(key: string) {
    if (onSort) {
      onSort(key);
    } else {
      setInternalSort((prev) => {
        if (prev?.key === key) {
          return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
        }
        return { key, dir: "asc" };
      });
    }
  }

  if (loading) return <LoadingState />;

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" role="grid">
        <thead>
          <tr className="border-b border-wood/15 text-xs font-medium uppercase tracking-wide text-muted">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn("pb-3 pr-4", col.sortable && "cursor-pointer select-none hover:text-forest", col.className)}
                onClick={() => col.sortable && handleSort(col.key)}
                aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.id}
              className={cn(
                "border-b border-wood/10 transition-colors",
                onRowClick && "cursor-pointer hover:bg-parchment/40"
              )}
              onClick={() => onRowClick?.(item)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onRowClick(item);
                }
              }}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("py-3 pr-4", col.className)}>
                  {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && onPageChange && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded border border-wood/30 px-3 py-1 text-xs disabled:opacity-30"
            >
              ← Sebelumnya
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded border border-wood/30 px-3 py-1 text-xs disabled:opacity-30"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}