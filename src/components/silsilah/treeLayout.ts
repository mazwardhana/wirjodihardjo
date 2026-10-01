import type { Edge, Node } from "@xyflow/react";
import type { PublicPerson } from "@/lib/data";

export type ChildEdge = {
  parentId: string;
  childId: string;
  parentRole: string;
  isStep: boolean;
  isAdopted: boolean;
};

export type PartnerEdge = {
  partnerAId: string;
  partnerBId: string;
  status: string;
  marriageDate: Date | null;
  divorceDate: Date | null;
  orderIndex: number;
};

export type FamilyTreeData = {
  persons: PublicPerson[];
  childEdges: ChildEdge[];
  partnerEdges: PartnerEdge[];
};

export type PersonNodeData = {
  person: PublicPerson;
  childCount: number;
  hasHiddenChildren: boolean;
  collapsed: boolean;
  /** Status pernikahan dengan pasangan yang tampil bersebelahan, null = sendiri */
  partnerStatus: "MARRIED" | "DIVORCED" | "WIDOWED" | "UNKNOWN" | null;
};

const NODE_W = 230;
const NODE_H = 130; // tinggi kartu orang
const COUPLE_SPACING = NODE_W + 40; // jarak kartu primary ke kartu pasangan
const GAP_X = 60; // spasi horizontal antar blok / anak di dalam baris
const GAP_Y = 80; // spasi vertikal antar baris grid
const MAX_ROW_WIDTH = 1800; // anggaran lebar maksimum satu baris sebelum wrap

/** Jarak minimum antar kartu pada baris yang sama, dipakai jaminan anti tumpuk. */
export const NODE_MIN_GAP = 16;

type PlacedNode = {
  id: string;
  x: number;
  y: number;
  partnerStatus: PersonNodeData["partnerStatus"];
};

type PartnerLink = { a: string; b: string; edge: PartnerEdge };
type ChildLink = { parentId: string; childId: string };

/** Hasil layout satu keluarga, koordinat relatif terhadap kartu primary di (0,0). */
type FamilyLayout = {
  positions: PlacedNode[];
  partnerLinks: PartnerLink[];
  childLinks: ChildLink[];
  width: number;
  height: number;
};

/**
 * Bangun graf pohon dengan dukungan banyak pernikahan per orang.
 *
 * Setiap orang dapat punya lebih dari satu pasangan. Kartu primary berada di
 * kiri, semua pasangannya berjajar ke kanan mengikuti `orderIndex`. Setiap
 * pasangan memiliki segmen sendiri; anak-anak dari pernikahan itu digantung
 * di bawah segmen tersebut sehingga tidak ada pasangan atau anak yang hilang.
 *
 * Orang tanpa orang tua tidak lagi dianggap akar terpisah: komponen yang
 * terhubung lewat relasi orang tua/anak/pasangan disatukan memakai union-find,
 * lalu tiap komponen memilih satu akar (prioritas bukan menikah-ke-dalam,
 * generationLevel terkecil, lalu id) dan dikemas berurutan.
 *
 * Garis tepi:
 *   - kandung   → coklat solid 1.5px
 *   - tiri      → dash "6 4"
 *   - angkat    → dot "1 5"
 *   - pasangan  → emas solid (menikah), merah dash (cerai), emas dasdot (janda)
 */
export function buildTreeGraph(
  data: FamilyTreeData,
  collapsed: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const personById = new Map(data.persons.map((p) => [p.id, p]));

  // Map parent → semua ChildEdge dari parent itu
  const childEdgesByParent = new Map<string, ChildEdge[]>();
  // Map child → semua parentId
  const parentIdsByChild = new Map<string, string[]>();

  for (const edge of data.childEdges) {
    if (!personById.has(edge.parentId) || !personById.has(edge.childId)) continue;
    appendTo(childEdgesByParent, edge.parentId, edge);
    appendTo(parentIdsByChild, edge.childId, edge.parentId);
  }

  // Map tiap orang → daftar pasangan (sudah urut orderIndex)
  const partnersByPerson = new Map<string, PartnerEdge[]>();
  for (const pe of data.partnerEdges) {
    if (!personById.has(pe.partnerAId) || !personById.has(pe.partnerBId)) continue;
    appendTo(partnersByPerson, pe.partnerAId, pe);
    appendTo(partnersByPerson, pe.partnerBId, pe);
  }
  for (const arr of partnersByPerson.values()) {
    arr.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  const partnerOf = (id: string): { id: string; edge: PartnerEdge }[] =>
    (partnersByPerson.get(id) ?? [])
      .map((edge) => ({
        id: edge.partnerAId === id ? edge.partnerBId : edge.partnerAId,
        edge,
      }))
      .filter((p) => personById.has(p.id));

  // Anak dikelompokkan per pasangan orang tua, bukan per individu.
  const coupleKey = (a: string, b: string) => [a, b].sort().join("|");
  const coupleChildren = new Map<string, string[]>();
  const singleChildren = new Map<string, string[]>();
  for (const [childId, parentsRaw] of parentIdsByChild) {
    const parents = [...new Set(parentsRaw)];
    if (parents.length === 1) {
      appendTo(singleChildren, parents[0], childId);
    } else if (parents.length >= 2) {
      appendTo(coupleChildren, coupleKey(parents[0], parents[1]), childId);
    }
  }

  const seen = new Set<string>();
  // Orang yang sengaja disembunyikan karena induknya dikuncupkan. Dipakai agar
  // jaring pengaman di bawah tidak menampilkan mereka kembali.
  const hidden = new Set<string>();
  const markHidden = (id: string) => {
    if (hidden.has(id) || seen.has(id)) return;
    hidden.add(id);
    for (const e of childEdgesByParent.get(id) ?? []) markHidden(e.childId);
  };

  function layoutFamily(pid: string): FamilyLayout {
    seen.add(pid);

    const partnerLinks: PartnerLink[] = [];
    const childLinks: ChildLink[] = [];
    const claimed = new Set<string>();

    // Baris kartu: primary di x=0, lalu semua pasangan (termasuk pasangan dari
    // pasangan) berjajar ke kanan mengikuti BFS, sehingga pernikahan berantai
    // tetap satu pohon dan tidak ada pasangan yang hilang.
    const row: { id: string; x: number }[] = [{ id: pid, x: 0 }];
    const xById = new Map<string, number>([[pid, 0]]);
    const queue: string[] = [pid];
    let primaryStatus: PersonNodeData["partnerStatus"] = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const pr of partnerOf(current)) {
        if (seen.has(pr.id)) continue;
        seen.add(pr.id);
        const x = row.length * COUPLE_SPACING;
        row.push({ id: pr.id, x });
        xById.set(pr.id, x);
        queue.push(pr.id);
        partnerLinks.push({ a: current, b: pr.id, edge: pr.edge });
        if (current === pid && primaryStatus === null) {
          primaryStatus = (pr.edge.status ?? null) as PersonNodeData["partnerStatus"];
        }
      }
    }

    const positions: PlacedNode[] = row.map((card) => {
      const status =
        card.id === pid
          ? primaryStatus
          : (partnerLinks.find((l) => l.a === card.id || l.b === card.id)?.edge.status ??
            null) as PersonNodeData["partnerStatus"];
      return { id: card.id, x: card.x, y: 0, partnerStatus: status };
    });

    // Susun blok anak, lalu rekursi tiap anak.
    const blocks: {
      childId: string;
      centerX: number;
      parentIds: string[];
      layout: FamilyLayout;
    }[] = [];

    const pushChildBlock = (childId: string, centerX: number, parentIds: string[]) => {
      if (seen.has(childId) || claimed.has(childId)) return;
      // Collapse per individu: bila salah satu orang tua dikuncupkan, anak
      // dari pernikahan itu ikut disembunyikan.
      if (parentIds.some((id) => collapsed.has(id))) {
        markHidden(childId);
        return;
      }
      claimed.add(childId);
      blocks.push({ childId, centerX, parentIds, layout: layoutFamily(childId) });
    };

    // Anak dari tiap pernikahan digantung di tengah segmen pasangan itu.
    for (const link of partnerLinks) {
      const centerX = ((xById.get(link.a) ?? 0) + (xById.get(link.b) ?? 0) + NODE_W) / 2;
      for (const cid of coupleChildren.get(coupleKey(link.a, link.b)) ?? []) {
        pushChildBlock(cid, centerX, [link.a, link.b]);
      }
    }
    // Anak dengan satu orang tua (atau dua orang tua yang bukan pasangan
    // tercatat) digantung di bawah kartu orang tuanya.
    for (const card of row) {
      const centerX = card.x + NODE_W / 2;
      for (const cid of singleChildren.get(card.id) ?? []) {
        pushChildBlock(cid, centerX, [card.id]);
      }
      for (const [key, kids] of coupleChildren) {
        const parents = key.split("|");
        if (!parents.includes(card.id)) continue;
        for (const cid of kids) {
          pushChildBlock(cid, centerX, parents);
        }
      }
    }

    let cursor = 0;
    let childHeight = 0;
    for (const block of blocks) {
      const desiredX = block.centerX - block.layout.width / 2;
      const blockX = Math.max(desiredX, cursor);
      const blockY = NODE_H + GAP_Y;

      for (const p of block.layout.positions) {
        positions.push({ ...p, x: p.x + blockX, y: p.y + blockY });
      }
      partnerLinks.push(...block.layout.partnerLinks);
      childLinks.push(...block.layout.childLinks);

      for (const parentId of block.parentIds) {
        if (childEdgesByParent.get(parentId)?.some((e) => e.childId === block.childId)) {
          childLinks.push({ parentId, childId: block.childId });
        }
      }

      cursor = blockX + block.layout.width + GAP_X;
      childHeight = Math.max(childHeight, block.layout.height);
    }

    const childrenEnd = blocks.length > 0 ? cursor - GAP_X : 0;
    const cardsWidth = (row.length - 1) * COUPLE_SPACING + NODE_W;
    const width = Math.max(cardsWidth, childrenEnd, NODE_W);
    const height = blocks.length > 0 ? NODE_H + GAP_Y + childHeight : NODE_H;

    return { positions, partnerLinks, childLinks, width, height };
  }

  // === Akar per komponen terhubung (union-find) ===
  const roots = orderedComponentRoots(data, personById, parentIdsByChild);
  if (roots.length === 0) return { nodes: [], edges: [] };

  const blocks: FamilyLayout[] = [];
  for (const rootId of roots) {
    if (!seen.has(rootId)) blocks.push(layoutFamily(rootId));
  }
  // Jaring pengaman: anggota komponen yang belum tersentuh (mis. pernikahan
  // berantai) tetap tampil sebagai blok sendiri, tidak ada orang yang hilang.
  for (const p of data.persons) {
    if (!seen.has(p.id) && !hidden.has(p.id)) blocks.push(layoutFamily(p.id));
  }

  // === Kemas blok ke grid (shelf packing) ===
  const cols = Math.max(1, Math.ceil(Math.sqrt(blocks.length)));
  let cursorX = 0;
  let cursorY = 0;
  let rowWidth = 0;
  let rowHeight = 0;
  let rowCount = 0;
  const offsets: { x: number; y: number }[] = [];

  for (const block of blocks) {
    const wrapsByCount = rowCount >= cols;
    const wrapsByWidth = rowCount > 0 && rowWidth + block.width + GAP_X > MAX_ROW_WIDTH;

    if (wrapsByCount || wrapsByWidth) {
      cursorX = 0;
      cursorY += rowHeight + GAP_Y;
      rowWidth = 0;
      rowHeight = 0;
      rowCount = 0;
    }

    offsets.push({ x: cursorX, y: cursorY });
    cursorX += block.width + GAP_X;
    rowWidth += block.width + GAP_X;
    rowHeight = Math.max(rowHeight, block.height);
    rowCount += 1;
  }

  // Setiap orang dipancarkan tepat sekali dengan posisi final. Bila kartu
  // berbagi baris yang sama namun terlalu rapat (mis. baris pasangan melintang
  // antar keluarga), geser ke kanan agar selalu ada jarak minimum NODE_MIN_GAP.
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const emitted = new Set<string>();
  const rowRight = new Map<number, number>();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const offset = offsets[i];

    for (const placed of block.positions) {
      if (emitted.has(placed.id)) continue;
      emitted.add(placed.id);
      const person = personById.get(placed.id);
      if (!person) continue;

      const y = placed.y + offset.y;
      const minX = rowRight.get(y);
      const x = minX === undefined ? placed.x + offset.x : Math.max(placed.x + offset.x, minX);
      rowRight.set(y, x + NODE_W + NODE_MIN_GAP);

      addNode(nodes, person, { x, y }, placed.partnerStatus, childEdgesByParent, collapsed);
    }

    for (const link of block.partnerLinks) {
      edges.push({
        id: `partner-${link.a}+${link.b}`,
        source: link.a,
        target: link.b,
        type: "straight",
        style: partnerLineStyle(link.edge.status),
      });
    }

    for (const link of block.childLinks) {
      const ce = childEdgesByParent.get(link.parentId)?.find((e) => e.childId === link.childId);
      edges.push({
        id: `${link.parentId}->${link.childId}`,
        source: link.parentId,
        target: link.childId,
        type: "smoothstep",
        style: childLineStyle(ce),
      });
    }
  }

  return { nodes, edges };
}

// === Utility helpers ===

/**
 * Akar tiap komponen terhubung, terurut deterministik.
 * Prioritas: bukan menikah-ke-dalam, generationLevel terkecil, lalu id.
 */
function orderedComponentRoots(
  data: FamilyTreeData,
  personById: Map<string, PublicPerson>,
  parentIdsByChild: Map<string, string[]>,
): string[] {
  const parent = new Map<string, string>();
  for (const p of data.persons) parent.set(p.id, p.id);

  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = id;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const e of data.childEdges) {
    if (parent.has(e.parentId) && parent.has(e.childId)) union(e.parentId, e.childId);
  }
  for (const pe of data.partnerEdges) {
    if (parent.has(pe.partnerAId) && parent.has(pe.partnerBId)) {
      union(pe.partnerAId, pe.partnerBId);
    }
  }

  const compareRoot = (a: string, b: string) => {
    const pa = personById.get(a);
    const pb = personById.get(b);
    const marriedA = pa?.isMarriedInto === true ? 1 : 0;
    const marriedB = pb?.isMarriedInto === true ? 1 : 0;
    if (marriedA !== marriedB) return marriedA - marriedB;
    const levelA = pa?.generationLevel ?? 999;
    const levelB = pb?.generationLevel ?? 999;
    if (levelA !== levelB) return levelA - levelB;
    return a < b ? -1 : a > b ? 1 : 0;
  };

  const members = new Map<string, string[]>();
  for (const p of data.persons) appendTo(members, find(p.id), p.id);

  const roots: string[] = [];
  for (const ids of members.values()) {
    const parentless = ids.filter((id) => (parentIdsByChild.get(id) ?? []).length === 0);
    const pool = parentless.length > 0 ? parentless : ids;
    pool.sort(compareRoot);
    roots.push(pool[0]);
  }
  roots.sort(compareRoot);
  return roots;
}

function addNode(
  nodes: Node[],
  person: PublicPerson,
  pos: { x: number; y: number },
  partnerStatus: PersonNodeData["partnerStatus"],
  childEdgesByParent: Map<string, ChildEdge[]>,
  collapsed: Set<string>,
) {
  const childCount = (childEdgesByParent.get(person.id) ?? []).length;
  const isCollapsed = collapsed.has(person.id);

  nodes.push({
    id: person.id,
    type: "person",
    position: pos,
    data: {
      person,
      childCount,
      hasHiddenChildren: isCollapsed && childCount > 0,
      collapsed: isCollapsed,
      partnerStatus,
    } satisfies PersonNodeData as unknown as Record<string, unknown>,
    draggable: false,
  });
}

function partnerLineStyle(status?: string) {
  switch (status) {
    case "DIVORCED":
      return { stroke: "#7a3b2e", strokeWidth: 2, strokeDasharray: "5 4" };
    case "WIDOWED":
      return { stroke: "#b4872a", strokeWidth: 1.5, strokeDasharray: "2 5" };
    default:
      return { stroke: "#b4872a", strokeWidth: 2 };
  }
}

function childLineStyle(edge?: ChildEdge) {
  if (edge?.isAdopted) {
    return { stroke: "#2c4f3b", strokeWidth: 1.5, strokeDasharray: "1 5" };
  }
  if (edge?.isStep) {
    return { stroke: "#8a6238", strokeWidth: 1.5, strokeDasharray: "6 4" };
  }
  return { stroke: "#6f4a2b", strokeWidth: 1.5, strokeOpacity: 0.7 };
}

function appendTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}

export function getRootId(data: FamilyTreeData): string | null {
  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const parentIdsByChild = new Map<string, string[]>();
  for (const edge of data.childEdges) {
    if (!personById.has(edge.parentId) || !personById.has(edge.childId)) continue;
    appendTo(parentIdsByChild, edge.childId, edge.parentId);
  }
  return orderedComponentRoots(data, personById, parentIdsByChild)[0] ?? null;
}
