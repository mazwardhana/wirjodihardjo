"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getGenerationLabel } from "@/lib/generations";

/**
 * Panel filter silsilah: cabang, generasi, status hidup/meninggal.
 * Setiap perubahan → navigasi ke URL baru, server render ulang tree.
 */
export function FilterPanel({
  branches,
  generations,
  current,
}: {
  branches: { id: string; name: string }[];
  generations: { level: number; count: number }[];
  current: { branchId?: string; generationLevel?: number; isDeceased?: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const apply = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.push(`/silsilah${qs ? `?${qs}` : ""}`);
    },
    [router, sp],
  );

  const resetFilters = () => {
    // Pertahankan query pencarian, hapus filter
    const next = new URLSearchParams(sp);
    next.delete("branchId");
    next.delete("generation");
    next.delete("deceased");
    const qs = next.toString();
    router.push(`/silsilah${qs ? `?${qs}` : ""}`);
  };

  const hasFilters = !!(current.branchId || current.generationLevel !== undefined || current.isDeceased);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Cabang */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="filter-branch" className="sr-only">Cabang</label>
        <select
          id="filter-branch"
          value={current.branchId ?? ""}
          onChange={(e) => apply({ branchId: e.target.value || undefined })}
          className="rounded-md border border-wood/25 bg-cream px-2.5 py-1.5 text-xs text-forest focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
        >
          <option value="">Semua cabang</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Generasi */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="filter-gen" className="sr-only">Generasi</label>
        <select
          id="filter-gen"
          value={current.generationLevel?.toString() ?? ""}
          onChange={(e) => apply({ generation: e.target.value || undefined })}
          className="rounded-md border border-wood/25 bg-cream px-2.5 py-1.5 text-xs text-forest focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
        >
          <option value="">Semua generasi</option>
          {generations.map((g) => (
            <option key={g.level} value={g.level}>
              {getGenerationLabel(g.level)} ({g.count})
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="filter-status" className="sr-only">Status</label>
        <select
          id="filter-status"
          value={current.isDeceased ?? ""}
          onChange={(e) => apply({ deceased: e.target.value || undefined })}
          className="rounded-md border border-wood/25 bg-cream px-2.5 py-1.5 text-xs text-forest focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
        >
          <option value="">Semua status</option>
          <option value="false">Masih hidup</option>
          <option value="true">Almarhum/Almarhumah</option>
        </select>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="rounded-md border border-wood/25 px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-wood/10"
        >
          Reset filter
        </button>
      )}
    </div>
  );
}