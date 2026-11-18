/**
 * pedigreeLayout.ts — layout murni untuk mode Pedigree View (garis leluhur).
 *
 * Menyusun kartu leluhur murni: satu orang fokus di bawah, orang tuanya di
 * atas, lalu kakek/nenek, dst. Setiap orang tampil maksimal sekali (dedup),
 * sehingga silsilah yang menikah-ke-dalam tidak menghasilkan kartu duplikat
 * atau graf tak berujung.
 *
 * Menghasilkan koordinat absolut kanvas dengan sumbu Y negatif ke atas.
 * Komponen kanvas tinggal merender tanpa perlu menghitung ulang geometri.
 */

import type { PublicPerson } from "@/lib/data";
import type { ChildEdge } from "./treeLayout";

/** Ukuran kartu, selaras dengan treeLayout (168x92 + gap). */
const NODE_W = 168;
const NODE_H = 92;
const GAP_X = 16;
const GAP_Y = 32;

export type PedigreeNode = {
  id: string;
  person: PublicPerson;
  /** Posisi kiri atas kartu di koordinat kanvas. */
  x: number;
  y: number;
  /** 0 = fokus, 1 = orang tua, 2 = kakek/nenek, ... */
  depth: number;
  /** ID orang tua (untuk menggambar garis). */
  parentIds: string[];
};

export type PedigreeEdge = {
  parentId: string;
  childId: string;
  isStep: boolean;
  isAdopted: boolean;
  parentRole: string;
};

export type PedigreeGraph = {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
};

type ParentRef = { parentId: string; role: string };

/**
 * Bangun graph pedigree dari `focusId` ke atas hingga `maxDepth` generasi
 * leluhur (default 4). Fokus di (0,0); leluhur tumbuh ke atas (sumbu Y
 * negatif).
 */
export function buildPedigreeGraph(
  focusId: string,
  persons: PublicPerson[],
  childEdges: ChildEdge[],
  maxDepth = 4,
): PedigreeGraph {
  const personById = new Map(persons.map((p) => [p.id, p]));
  if (!personById.has(focusId)) return { nodes: [], edges: [] };

  // Child -> daftar parent ref (dedup per parent, urut stabil).
  const parentsByChild = new Map<string, ParentRef[]>();
  const edgeByPair = new Map<string, ChildEdge>();
  for (const e of childEdges) {
    if (!personById.has(e.parentId) || !personById.has(e.childId)) continue;
    const arr = parentsByChild.get(e.childId) ?? [];
    if (!arr.some((p) => p.parentId === e.parentId)) {
      arr.push({ parentId: e.parentId, role: e.parentRole });
    }
    parentsByChild.set(e.childId, arr);
    edgeByPair.set(`${e.parentId}|${e.childId}`, e);
  }
  for (const arr of parentsByChild.values()) {
    arr.sort((a, b) => {
      const ra = a.role.toUpperCase();
      const rb = b.role.toUpperCase();
      if (ra !== rb) return ra === "FATHER" ? -1 : rb === "FATHER" ? 1 : 0;
      return a.parentId < b.parentId ? -1 : a.parentId > b.parentId ? 1 : 0;
    });
  }

  const nodes: PedigreeNode[] = [];
  const edges: PedigreeEdge[] = [];
  const seen = new Set<string>([focusId]);

  const root = personById.get(focusId);
  if (root) {
    nodes.push({
      id: focusId,
      person: root,
      x: 0,
      y: 0,
      depth: 0,
      parentIds: (parentsByChild.get(focusId) ?? []).map((p) => p.parentId),
    });
  }

  let level: { id: string; depth: number }[] = [{ id: focusId, depth: 0 }];

  while (level.length > 0 && level[0].depth < maxDepth) {
    const requests: { parentId: string; childId: string }[] = [];
    for (const node of level) {
      for (const p of parentsByChild.get(node.id) ?? []) {
        if (seen.has(p.parentId)) continue;
        requests.push({ parentId: p.parentId, childId: node.id });
      }
    }
    if (requests.length === 0) break;

    const depth = level[0].depth + 1;
    const orderedParents: string[] = [];
    for (const r of requests) {
      if (!orderedParents.includes(r.parentId)) orderedParents.push(r.parentId);
    }

    const totalW = orderedParents.length * (NODE_W + GAP_X) - GAP_X;
    const startX = -totalW / 2;
    const y = -(depth * (NODE_H + GAP_Y));

    const nextLevel: { id: string; depth: number }[] = [];
    orderedParents.forEach((pid, i) => {
      const person = personById.get(pid);
      if (!person) return;
      const x = startX + i * (NODE_W + GAP_X);
      nodes.push({
        id: pid,
        person,
        x,
        y,
        depth,
        parentIds: (parentsByChild.get(pid) ?? []).map((p) => p.parentId),
      });
      seen.add(pid);
      nextLevel.push({ id: pid, depth });
    });

    for (const r of requests) {
      const e = edgeByPair.get(`${r.parentId}|${r.childId}`);
      edges.push({
        parentId: r.parentId,
        childId: r.childId,
        isStep: e?.isStep ?? false,
        isAdopted: e?.isAdopted ?? false,
        parentRole: e?.parentRole ?? "PARENT",
      });
    }

    level = nextLevel;
  }

  return { nodes, edges };
}
