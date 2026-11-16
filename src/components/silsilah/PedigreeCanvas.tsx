"use client";

/**
 * PedigreeCanvas — kanvas mode Pedigree View (garis leluhur).
 *
 * Menggambar kartu leluhur di atas kartu fokus dengan garis penghubung
 * ortogonal (anak di bawah, orang tua di atas). Kartu memakai gaya visual
 * yang sama dengan tree utama (palet arsip, kartu cream + aksen gold).
 * Setiap kartu adalah tombol: klik/Enter = buka detail.
 */

import { useMemo } from "react";
import { getGenerationLabel } from "@/lib/generations";
import type { PublicPerson } from "@/lib/data";
import type { ChildEdge, FamilyTreeData } from "./treeLayout";
import { buildPedigreeGraph, type PedigreeNode } from "./pedigreeLayout";

const NODE_W = 168;
const NODE_H = 92;

/** Kartu kecil pedigree: nama, generasi, tahun. Tombol utuh (44px+). */
function MiniCard({
  node,
  onOpenDetail,
  isFocus,
}: {
  node: PedigreeNode;
  onOpenDetail: (p: PublicPerson) => void;
  isFocus: boolean;
}) {
  const { person } = node;
  const genLabel = getGenerationLabel(person.generationLevel);
  const years = person.birthDate
    ? String(new Date(person.birthDate).getFullYear())
    : null;
  const death = person.deathDate
    ? String(new Date(person.deathDate).getFullYear())
    : null;
  const yearText = person.isDeceased
    ? years && death
      ? `${years}–${death}`
      : death
        ? `wafat ${death}`
        : years
    : years;

  return (
    <button
      type="button"
      onClick={() => onOpenDetail(person)}
      className={`absolute flex w-[168px] items-center gap-2 rounded-md border bg-cream px-2.5 py-2 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
        isFocus
          ? "border-gold ring-2 ring-gold/40"
          : "border-wood/35 hover:border-gold/60"
      }`}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        minHeight: NODE_H,
      }}
    >
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photoUrl}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-gold/40"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest/10 text-[11px] font-semibold text-forest"
        >
          {(person.fullName ?? "?").charAt(0)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[12px] font-semibold leading-tight text-forest">
          {person.fullName}
        </span>
        <span className="mt-0.5 block text-[11px] text-wood tabular-nums">
          {[genLabel, yearText].filter(Boolean).join(" · ")}
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

/** Garis ortogonal dari bawah kartu parent ke atas kartu child. */
function edgePath(parent: PedigreeNode, child: PedigreeNode): string {
  const px = parent.x + NODE_W / 2;
  const py = parent.y + NODE_H;
  const cx = child.x + NODE_W / 2;
  const cy = child.y;
  const midY = (py + cy) / 2;
  return `M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`;
}

export function PedigreeCanvas({
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
    if (!focusId) return { nodes: [], edges: [] };
    return buildPedigreeGraph(
      focusId,
      data.persons,
      data.childEdges as ChildEdge[],
      4,
    );
  }, [data, focusId]);

  const nodeById = useMemo(() => {
    const m = new Map<string, PedigreeNode>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph]);

  if (!focusId || graph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted">
        Belum ada data leluhur untuk ditampilkan.
      </div>
    );
  }

  const width = Math.max(...graph.nodes.map((n) => n.x + NODE_W)) + 40;
  const height = Math.max(...graph.nodes.map((n) => n.y + NODE_H)) + 80;

  return (
    <div className="relative h-full w-full overflow-auto">
      <div
        role="group"
        aria-label="Pedigree view: garis leluhur"
        className="relative"
        style={{ width, height }}
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
                d={edgePath(p, c)}
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
          <MiniCard
            key={n.id}
            node={n}
            onOpenDetail={onOpenDetail}
            isFocus={n.id === focusId}
          />
        ))}

        {/* Tombol kembali ke fokus, melayang di kanan atas */}
        <button
          type="button"
          onClick={() => onFocusPerson(focusId)}
          className="absolute right-2 top-2 rounded-md border border-wood/30 bg-cream/95 px-3 py-1.5 text-xs font-medium text-forest shadow-sm transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Fokus: {nodeById.get(focusId)?.person.fullName ?? "—"}
        </button>
      </div>
    </div>
  );
}