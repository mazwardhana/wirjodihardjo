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
const COUPLE_SPACING = 200; // jarak antar pasangan

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

  // === Akar ===
  const roots = data.persons
    .filter((p) => !parentIdsByChild.has(p.id))
    .sort((a, b) => (a.generationLevel ?? 999) - (b.generationLevel ?? 999));

  if (roots.length === 0) return { nodes: [], edges: [] };

  const rootChildren: TreeNode[] = [];
  for (const r of roots) {
    if (!seen.has(r.id)) {
      const node = buildNode(r.id);
      if (node) rootChildren.push(node);
    }
  }

  const rootData: TreeNode =
    rootChildren.length === 1
      ? rootChildren[0]
      : { id: "__root", isCouple: false, primaryId: "__root", partnerId: null, children: rootChildren };

  // === d3-hierarchy layout ===
  const layoutRoot = hierarchy<TreeNode>(rootData, (d) => d.children);
  const layout = tree<TreeNode>().nodeSize([NODE_W + 40, 150]);
  layout(layoutRoot);

  // === Build output ===
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const allHierarchyNodes = layoutRoot.descendants() as HierarchyPointNode<TreeNode>[];
  const allHierarchyLinks = layoutRoot.links();

  // Index partner edge per pasangan
  const partnerEdgeKey = (a: string, b: string) => [a, b].sort().join("|");
  const peMap = new Map<string, PartnerEdge>();
  for (const pe of data.partnerEdges) {
    peMap.set(partnerEdgeKey(pe.partnerAId, pe.partnerBId), pe);
  }

  // === Nodes ===
  for (const hn of allHierarchyNodes) {
    const t = hn.data;
    if (t.id === "__root") continue;
    const gap = COUPLE_SPACING / 2;

    if (t.isCouple && t.partnerId) {
      const primary = personById.get(t.primaryId)!;
      const partner = personById.get(t.partnerId)!;
      const pe = peMap.get(partnerEdgeKey(t.primaryId, t.partnerId));

      addNode(nodes, primary, { x: hn.x - gap, y: hn.y }, (pe?.status ?? null) as PersonNodeData["partnerStatus"], childEdgesByParent, collapsed);
      addNode(nodes, partner, { x: hn.x + gap, y: hn.y }, (pe?.status ?? null) as PersonNodeData["partnerStatus"], childEdgesByParent, collapsed);

      edges.push({
        id: `partner-${t.id}`,
        source: t.primaryId,
        target: t.partnerId,
        type: "straight",
        style: partnerLineStyle(pe?.status),
      });
    } else {
      const person = personById.get(t.primaryId);
      if (person) addNode(nodes, person, { x: hn.x, y: hn.y }, null, childEdgesByParent, collapsed);
    }
  }

  // === Edges orang-tua→anak ===
  for (const link of allHierarchyLinks) {
    const p = link.source.data;
    const c = link.target.data;
    if (p.id === "__root") continue;

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