/**
 * fanLayout.ts — layout murni untuk mode Fan Chart (melingkar).
 *
 * Menyusun leluhur dalam setengah lingkaran (fan) di atas orang fokus, tiap
 * generasi = satu cincin. Fokus di tengah; generasi 1 (orang tua) di cincin
 * terdalam, dst. hingga `maxDepth` cincin (default 6, jadi total 7 generasi
 * termasuk fokus).
 *
 * Jarak sudut antar kartu di satu cincin menyesuaikan lebar kartu pada radius
 * cincin itu: bila anggota terlalu rapat, radius cincin membesar sehingga
 * kartu tidak pernah saling menumpuk. Radius antar cincin dijaga monoton
 * naik dengan jarak cukup untuk tinggi kartu.
 *
 * Koordinat absolut kanvas: pusat fan di (cx, cy), fokus di pusat.
 */

import type { PublicPerson } from "@/lib/data";
import type { ChildEdge } from "./treeLayout";

export const FAN_NODE_W = 120;
export const FAN_NODE_H = 56;
/** Jarak radial antar cincin (cukup untuk tinggi kartu + jarak). */
const RING_GAP = 88;
/** Jarak minimum antar kartu se-arc (chord). */
const CARD_GAP = 12;
/** Fan menutupi setengah lingkaran (derajat). */
const ARC_SPAN = 180;

export type FanNode = {
  id: string;
  person: PublicPerson;
  /** Posisi kiri atas kartu. */
  x: number;
  y: number;
  /** 0 = fokus, 1.. = cincin leluhur. */
  depth: number;
  /** ID parent untuk garis. */
  parentIds: string[];
};

export type FanEdge = {
  parentId: string;
  childId: string;
  isStep: boolean;
  isAdopted: boolean;
  parentRole: string;
};

export type FanGraph = {
  nodes: FanNode[];
  edges: FanEdge[];
  /** Radius cincin terluar (untuk menghitung ukuran kanvas). */
  outerRadius: number;
  /** Posisi pusat fan di kanvas. */
  cx: number;
  cy: number;
};

const DEG = Math.PI / 180;

type ParentRef = { parentId: string; role: string };

/**
 * Bangun graph fan. `maxDepth` = jumlah cincin leluhur (default 6 = 7
 * generasi termasuk fokus).
 */
export function buildFanGraph(
  focusId: string,
  persons: PublicPerson[],
  childEdges: ChildEdge[],
  maxDepth = 6,
): FanGraph {
  const personById = new Map(persons.map((p) => [p.id, p]));
  if (!personById.has(focusId)) {
    return { nodes: [], edges: [], outerRadius: 0, cx: 0, cy: 0 };
  }

  // Child -> daftar parent (dedup, urut stabil: FATHER dulu lalu id).
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

  const nodes: FanNode[] = [];
  const edges: FanEdge[] = [];
  const seen = new Set<string>([focusId]);

  const focusPerson = personById.get(focusId);
  if (focusPerson) {
    nodes.push({
      id: focusId,
      person: focusPerson,
      x: -FAN_NODE_W / 2,
      y: -FAN_NODE_H / 2,
      depth: 0,
      parentIds: (parentsByChild.get(focusId) ?? []).map((p) => p.parentId),
    });
  }

  // Traversal BFS per cincin; radius tiap cincin dihitung dari jumlah kartu
  // supaya tidak ada kartu yang bertumpuk, lalu dijaga monoton naik.
  let level: string[] = [focusId];
  let prevRadius = 0;
  let outerRadius = 0;
  const ringLayout: {
    depth: number;
    radius: number;
    ids: string[];
    edges: { parentId: string; childId: string }[];
  }[] = [];

  while (level.length > 0 && ringLayout.length < maxDepth) {
    const requests: { parentId: string; childId: string }[] = [];
    for (const id of level) {
      for (const p of parentsByChild.get(id) ?? []) {
        if (seen.has(p.parentId)) continue;
        requests.push({ parentId: p.parentId, childId: id });
      }
    }
    if (requests.length === 0) break;

    const ids: string[] = [];
    for (const r of requests) {
      if (!ids.includes(r.parentId)) ids.push(r.parentId);
    }

    const depth = ringLayout.length + 1;
    // Radius minimum agar n kartu muat di 180° tanpa tumpuk:
    // chord antar pusat kartu >= FAN_NODE_W + CARD_GAP
    // => r >= (FAN_NODE_W + CARD_GAP) / (2 * sin(ARC_SPAN / n / 2))
    const minChord = FAN_NODE_W + CARD_GAP;
    const halfStep = ARC_SPAN / Math.max(ids.length, 1) / 2;
    const rByCount = minChord / (2 * Math.sin((halfStep * DEG) || 1));
    const radius = Math.max(depth * RING_GAP, rByCount, prevRadius + FAN_NODE_H + 16);

    ringLayout.push({ depth, radius, ids, edges: requests });
    outerRadius = radius;
    prevRadius = radius;

    for (const id of ids) seen.add(id);
    level = ids;
  }

  // Tempatkan kartu per cincin: sudut merata di [180°, 360°) (setengah
  // lingkaran atas), pusat fan di (0,0) sementara.
  for (const ring of ringLayout) {
    const step = ARC_SPAN / ring.ids.length;
    ring.ids.forEach((pid, i) => {
      const person = personById.get(pid);
      if (!person) return;
      const angle = (180 + step * (i + 0.5)) * DEG;
      const cx = Math.cos(angle) * ring.radius;
      const cy = Math.sin(angle) * ring.radius;
      nodes.push({
        id: pid,
        person,
        x: cx - FAN_NODE_W / 2,
        y: cy - FAN_NODE_H / 2,
        depth: ring.depth,
        parentIds: (parentsByChild.get(pid) ?? []).map((p) => p.parentId),
      });
    });
    for (const r of ring.edges) {
      const e = edgeByPair.get(`${r.parentId}|${r.childId}`);
      edges.push({
        parentId: r.parentId,
        childId: r.childId,
        isStep: e?.isStep ?? false,
        isAdopted: e?.isAdopted ?? false,
        parentRole: e?.parentRole ?? "PARENT",
      });
    }
  }

  // Pusat fan di (cx, cy) dengan margin cukup untuk setengah lebar kartu.
  const cx = outerRadius + FAN_NODE_W;
  const cy = outerRadius + FAN_NODE_H;
  for (const n of nodes) {
    n.x += cx;
    n.y += cy;
  }

  return { nodes, edges, outerRadius, cx, cy };
}