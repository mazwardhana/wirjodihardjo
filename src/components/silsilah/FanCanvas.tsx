"use client";

/**
 * FanCanvas — kanvas mode Fan Chart (melingkar, setengah lingkaran di atas
 * orang fokus). Setiap generasi = satu cincin; kartu ditempatkan radial.
 * Kartu = tombol utuh, kontras memakai token palet arsip.
 */

import { useMemo } from "react";
import { getGenerationLabel } from "@/lib/generations";
import type { PublicPerson } from "@/lib/data";
import type { ChildEdge, FamilyTreeData } from "./treeLayout";
import { buildFanGraph, FAN_NODE_W, FAN_NODE_H, type FanNode } from "./fanLayout";

/** Kartu radial: nama (2 baris) + label generasi. Teks tetap horizontal. */
function FanCard({
  node,
  onOpenDetail,
  isFocus,
}: {
  node: FanNode;
  onOpenDetail: (p: PublicPerson) => void;
  isFocus: boolean;
}) {
  const genLabel = getGenerationLabel(node.person.generationLevel);
  return (
    <button
      type="button"
      onClick={() => onOpenDetail(node.person)}
      className={`absolute flex items-center gap-1.5 rounded-md border bg-cream px-2 py-1.5 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
        isFocus
          ? "border-gold ring-2 ring-gold/40"
          : "border-wood/35 hover:border-gold/60"
      }`}
      style={{
        left: node.x,
        top: node.y,
        width: FAN_NODE_W,
        minHeight: FAN_NODE_H,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[12px] font-semibold leading-tight text-forest">
          {node.person.fullName}
        </span>
        <span className="block text-[11px] leading-tight text-wood tabular-nums">
          {genLabel}
        </span>
      </span>
      {isFocus && (
        <span className="shrink-0 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold-deep">
          fokus
        </span>
      )}
    </button>
  );
}

/** Garis radial dari pusat bawah kartu parent ke pusat atas kartu child. */
function fanEdgePath(parent: FanNode, child: FanNode): string {
  const px = parent.x + FAN_NODE_W / 2;
  const py = parent.y + FAN_NODE_H;
  const cx = child.x + FAN_NODE_W / 2;
  const cy = child.y;
  return `M ${px} ${py} L ${cx} ${cy}`;
}

export function FanCanvas({
  data,
  focusId,
  onOpenDetail,
  onFocusPerson,
}: {
  data: FamilyTreeData;
  focusId: string | null;
  onOpenDetail: (p: PublicPerson) => void;
  onFocusPerson: (id: string) => void;
}) {
  const graph = useMemo(() => {
    if (!focusId) return null;
    return buildFanGraph(
      focusId,
      data.persons,
      data.childEdges as ChildEdge[],
      6,
    );
  }, [data, focusId]);

  const nodeById = useMemo(() => {
    const m = new Map<string, FanNode>();
    for (const n of graph?.nodes ?? []) m.set(n.id, n);
    return m;
  }, [graph]);

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted">
        Belum ada data leluhur untuk ditampilkan.
      </div>
    );
  }

  // Kanvas: ukuran penuh = radius terluar + margin setengah kartu.
  const size = graph.outerRadius * 2 + FAN_NODE_W + 80;

  return (
    <div className="relative h-full w-full overflow-auto">
      <div
        role="group"
        aria-label="Fan chart: leluhur melingkar"
        className="relative"
        style={{ width: size, height: size }}
      >
        <svg
          className="pointer-events-none absolute inset-0"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          {graph.edges.map((e, i) => {
            const p = nodeById.get(e.parentId);
            const c = nodeById.get(e.childId);
            if (!p || !c) return null;
            return (
              <path
                key={`${e.parentId}-${e.childId}-${i}`}
                d={fanEdgePath(p, c)}
                fill="none"
                stroke="var(--color-wood-soft)"
                strokeWidth={1.5}
                strokeOpacity={0.55}
                strokeDasharray={e.isStep ? "6 4" : e.isAdopted ? "1 5" : undefined}
              />
            );
          })}
        </svg>

        {graph.nodes.map((n) => (
          <FanCard key={n.id} node={n} onOpenDetail={onOpenDetail} isFocus={n.id === focusId} />
        ))}

        <button
          type="button"
          onClick={() => focusId && onFocusPerson(focusId)}
          className="absolute right-2 top-2 rounded-md border border-wood/30 bg-cream/95 px-3 py-1.5 text-xs font-medium text-forest shadow-sm transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Fokus: {focusId ? nodeById.get(focusId)?.person.fullName ?? "—" : "—"}
        </button>
      </div>
    </div>
  );
}