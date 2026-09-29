import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
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
const COUPLE_SPACING = 200; // jarak antar pasangan
const GAP_X = 60; // spasi horizontal antar blok / anak di dalam baris grid
const GAP_Y = 80; // spasi vertikal antar baris grid
const MAX_ROW_WIDTH = 1800; // anggaran lebar maksimum satu baris sebelum wrap

type TreeNode = {
  id: string; // "personId" atau "personId+partnerId"
  isCouple: boolean;
  primaryId: string;
  partnerId: string | null;
  children: TreeNode[];
};

/**
 * Bangun pohon dengan strategi couple-grouped.
 *
 * Setiap node d3-hierarchy mewakili satu unit (individu ATAU pasangan).
 * Pasangan ditempatkan berdampingan di posisi x yang sama (terbelah kiri-kanan
 * selebar COUPLE_SPACING), sehingga tampil sebagai satu grup.
 *
 * Anak dikumpulkan per pasangan orang tua: hanya anak yang terdaftar sebagai
 * hasil dari kedua orang tua tersebut yang masuk. Anak dari pernikahan lain
 * (half/step sibling) muncul di grup keluarga terpisah.
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

  // Map tiap orang → daftar pasangan (sudah urut)
  const partnersByPerson = new Map<string, PartnerEdge[]>();
  for (const pe of data.partnerEdges) {
    if (!personById.has(pe.partnerAId) || !personById.has(pe.partnerBId)) continue;
    appendTo(partnersByPerson, pe.partnerAId, pe);
    appendTo(partnersByPerson, pe.partnerBId, pe);
  }
  for (const arr of partnersByPerson.values()) {
    arr.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  // === Mutual-recursive helpers (hoisted, shared closure) ===
  const seen = new Set<string>();

  function buildNode(personId: string): TreeNode | null {
    if (seen.has(personId)) return null;
    seen.add(personId);
    const person = personById.get(personId);
    if (!person) return null;

    const partners = partnersByPerson.get(personId) ?? [];
    const partnerEdge = partners.find((p) => {
      const other = p.partnerAId === personId ? p.partnerBId : p.partnerAId;
      return !seen.has(other);
    });

    if (partnerEdge) {
      const otherId = partnerEdge.partnerAId === personId
        ? partnerEdge.partnerBId
        : partnerEdge.partnerAId;
      if (!personById.has(otherId)) {
        // Partner ada di DB? kalau tidak, skip jadi single
        return {
          id: personId,
          isCouple: false,
          primaryId: personId,
          partnerId: null,
          children: collectChildrenSingle(personId),
        };
      }
      seen.add(otherId);
      return {
        id: `${personId}+${otherId}`,
        isCouple: true,
        primaryId: personId,
        partnerId: otherId,
        children: collectChildrenCouple(personId, otherId),
      };
    }

    return {
      id: personId,
      isCouple: false,
      primaryId: personId,
      partnerId: null,
      children: collectChildrenSingle(personId),
    };
  }

  function collectChildrenSingle(parentId: string): TreeNode[] {
    if (collapsed.has(parentId)) return [];
    const edges = childEdgesByParent.get(parentId) ?? [];
    const out: TreeNode[] = [];
    for (const e of edges) {
      if (seen.has(e.childId)) continue;
      const allParents = parentIdsByChild.get(e.childId) ?? [];
      // Anak yang hanya punya satu orang tua di data
      if (allParents.length <= 1) {
        const node = buildNode(e.childId);
        if (node) out.push(node);
      }
    }
    return out;
  }

  function collectChildrenCouple(parentId: string, partnerId: string): TreeNode[] {
    if (collapsed.has(parentId) && collapsed.has(partnerId)) return [];
    const edgesA = childEdgesByParent.get(parentId) ?? [];
    const edgesB = childEdgesByParent.get(partnerId) ?? [];
    const childIds = new Set<string>();

    // Anak yang setidaknya satu orang tuanya adalah parentId dan yang lain adalah partnerId
    for (const e of edgesA) {
      if (seen.has(e.childId)) continue;
      const allParents = parentIdsByChild.get(e.childId) ?? [];
      if (allParents.includes(partnerId) || allParents.length === 1) {
        childIds.add(e.childId);
      }
    }
    for (const e of edgesB) {
      if (seen.has(e.childId)) continue;
      const allParents = parentIdsByChild.get(e.childId) ?? [];
      // Anak dari partner yang belum terdaftar via parentId
      if (allParents.includes(parentId) && !childIds.has(e.childId)) {
        childIds.add(e.childId);
      }
    }

    return [...childIds]
      .map((cid) => buildNode(cid))
      .filter((n): n is TreeNode => n !== null);
  }

  // === Akar (forest: tanpa node sintetis) ===
  // Urutan deterministik: generationLevel lalu id sebagai tiebreaker.
  const roots = data.persons
    .filter((p) => !parentIdsByChild.has(p.id))
    .sort((a, b) => {
      const levelA = a.generationLevel ?? 999;
      const levelB = b.generationLevel ?? 999;
      if (levelA !== levelB) return levelA - levelB;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  if (roots.length === 0) return { nodes: [], edges: [] };

  const rootTrees: TreeNode[] = [];
  for (const r of roots) {
    if (!seen.has(r.id)) {
      const node = buildNode(r.id);
      if (node) rootTrees.push(node);
    }
  }

  // === Layout tiap akar sendiri-sendiri ===
  type RootBlock = {
    root: HierarchyPointNode<TreeNode>;
    minX: number;
    minY: number;
    width: number;
    height: number;
    translateX: number;
    translateY: number;
  };

  const blocks: RootBlock[] = [];
  for (const rootTree of rootTrees) {
    const layout = tree<TreeNode>().nodeSize([NODE_W + 40, 150]);
    const laidOut = layout(hierarchy<TreeNode>(rootTree, (d) => d.children));

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const d of laidOut.descendants()) {
      minX = Math.min(minX, d.x);
      maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y);
      maxY = Math.max(maxY, d.y);
    }

    blocks.push({
      root: laidOut,
      minX,
      minY,
      width: maxX - minX + NODE_W,
      height: maxY - minY + NODE_H,
      translateX: 0,
      translateY: 0,
    });
  }

  // === Kemas blok ke grid (shelf packing) ===
  const cols = Math.max(1, Math.ceil(Math.sqrt(blocks.length)));
  let cursorX = 0;
  let cursorY = 0;
  let rowWidth = 0;
  let rowHeight = 0;
  let rowCount = 0;

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

    // Top-align semua blok dalam satu baris pada cursorY.
    block.translateX = cursorX + NODE_W / 2 - block.minX;
    block.translateY = cursorY + NODE_H / 2 - block.minY;

    cursorX += block.width + GAP_X;
    rowWidth += block.width + GAP_X;
    rowHeight = Math.max(rowHeight, block.height);
    rowCount += 1;
  }

  // === Build output ===
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Index partner edge per pasangan
  const partnerEdgeKey = (a: string, b: string) => [a, b].sort().join("|");
  const peMap = new Map<string, PartnerEdge>();
  for (const pe of data.partnerEdges) {
    peMap.set(partnerEdgeKey(pe.partnerAId, pe.partnerBId), pe);
  }

  // === Nodes ===
  for (const block of blocks) {
    for (const hn of block.root.descendants()) {
      const t = hn.data;
      const gap = COUPLE_SPACING / 2;
      const x = hn.x + block.translateX;
      const y = hn.y + block.translateY;

      if (t.isCouple && t.partnerId) {
        const primary = personById.get(t.primaryId)!;
        const partner = personById.get(t.partnerId)!;
        const pe = peMap.get(partnerEdgeKey(t.primaryId, t.partnerId));

        addNode(nodes, primary, { x: x - gap, y }, (pe?.status ?? null) as PersonNodeData["partnerStatus"], childEdgesByParent, collapsed);
        addNode(nodes, partner, { x: x + gap, y }, (pe?.status ?? null) as PersonNodeData["partnerStatus"], childEdgesByParent, collapsed);

        edges.push({
          id: `partner-${t.id}`,
          source: t.primaryId,
          target: t.partnerId,
          type: "straight",
          style: partnerLineStyle(pe?.status),
        });
      } else {
        const person = personById.get(t.primaryId);
        if (person) addNode(nodes, person, { x, y }, null, childEdgesByParent, collapsed);
      }
    }
  }

  // === Edges orang-tua→anak ===
  for (const block of blocks) {
    for (const link of block.root.links()) {
      const p = link.source.data;
      const c = link.target.data;

      const parentIds: string[] = [p.primaryId];
      if (p.partnerId) parentIds.push(p.partnerId);

      const childIds: string[] = [c.primaryId];
      if (c.partnerId) childIds.push(c.partnerId);

      for (const pid of parentIds) {
        for (const cid of childIds) {
          const ce = childEdgesByParent.get(pid)?.find((e) => e.childId === cid);
          if (!ce) continue;
          edges.push({
            id: `${pid}->${cid}`,
            source: pid,
            target: cid,
            type: "smoothstep",
            style: ce.isAdopted
              ? { stroke: "#2c4f3b", strokeWidth: 1.5, strokeDasharray: "1 5" }
              : ce.isStep
                ? { stroke: "#8a6238", strokeWidth: 1.5, strokeDasharray: "6 4" }
                : { stroke: "#6f4a2b", strokeWidth: 1.5, strokeOpacity: 0.7 },
          });
        }
      }
    }
  }

  return { nodes, edges };
}

// === Utility helpers ===

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

function appendTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}

export function getRootId(data: FamilyTreeData): string | null {
  const childIds = new Set(data.childEdges.map((e) => e.childId));
  const roots = data.persons
    .filter((p) => !childIds.has(p.id))
    .sort((a, b) => (a.generationLevel ?? 999) - (b.generationLevel ?? 999));
  return roots[0]?.id ?? null;
}