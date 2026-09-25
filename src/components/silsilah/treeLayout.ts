import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import type { Edge, Node } from "@xyflow/react";
import type { PublicPerson } from "@/lib/data";

export type ChildEdge = { parentId: string; childId: string; parentRole: string };
export type PartnerEdge = { partnerAId: string; partnerBId: string; status: string };

export type FamilyTreeData = {
  persons: PublicPerson[];
  childEdges: ChildEdge[];
  partnerEdges: PartnerEdge[];
};

type PersonNodeData = {
  person: PublicPerson;
  childCount: number;
  hasHiddenChildren: boolean;
  collapsed: boolean;
};

/**
 * Susun node dan edge React Flow dari data keluarga.
 *
 * Strategi:
 *  - Bangun adjacency map dari edge parent-child.
 *  - Mulai dari akar (generationLevel terkecil, atau orang tanpa orang tua).
 *  - Atur posisi dengan d3-hierarchy (layout pohon rapi, tidak tumpang tindih).
 *  - Node yang di-collapse menyembunyikan keturunannya (lazy expand).
 */
export function buildTreeGraph(
  data: FamilyTreeData,
  collapsed: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const childIdsByParent = new Map<string, string[]>();
  const parentIdsByChild = new Map<string, string[]>();

  for (const edge of data.childEdges) {
    if (!personById.has(edge.parentId) || !personById.has(edge.childId)) continue;
    const arr = childIdsByParent.get(edge.parentId) ?? [];
    arr.push(edge.childId);
    childIdsByParent.set(edge.parentId, arr);

    const parr = parentIdsByChild.get(edge.childId) ?? [];
    parr.push(edge.parentId);
    parentIdsByChild.set(edge.childId, parr);
  }

  // Akar: orang tanpa orang tua; bila banyak, pilih yang generationLevel terkecil
  const roots = data.persons
    .filter((p) => !parentIdsByChild.has(p.id))
    .sort(
      (a, b) =>
        (a.generationLevel ?? 999) - (b.generationLevel ?? 999) ||
        a.fullName.localeCompare(b.fullName),
    );

  if (roots.length === 0) return { nodes: [], edges: [] };

  // Bila ada beberapa akar, bungkus dalam node virtual agar layout tetap satu pohon
  type TreeDatum = {
    id: string;
    person?: PublicPerson;
    children: TreeDatum[];
  };

  const seen = new Set<string>();
  function buildSubtree(id: string, depth: number): TreeDatum | null {
    if (seen.has(id)) return null; // hindari siklus
    if (depth > 60) return null;
    seen.add(id);

    const person = personById.get(id)!;
    const isCollapsed = collapsed.has(id);
    const childIds = isCollapsed ? [] : (childIdsByParent.get(id) ?? []);

    const children = childIds
      .map((cid) => buildSubtree(cid, depth + 1))
      .filter((c): c is TreeDatum => c !== null);

    return { id, person, children };
  }

  const rootData: TreeDatum =
    roots.length === 1
      ? (buildSubtree(roots[0].id, 0) ?? { id: "__root", children: [] })
      : {
          id: "__root",
          children: roots
            .map((r) => buildSubtree(r.id, 0))
            .filter((c): c is TreeDatum => c !== null),
        };

  const root = hierarchy<TreeDatum>(rootData, (d) => d.children);
  const layout = tree<TreeDatum>()
    .nodeSize([230, 150])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.25));

  layout(root);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const allNodes = root.descendants() as HierarchyPointNode<TreeDatum>[];
  const allLinks = root.links();

  for (const n of allNodes) {
    if (n.data.id === "__root") continue;
    const person = n.data.person!;
    const childCount = (childIdsByParent.get(person.id) ?? []).length;
    const isCollapsed = collapsed.has(person.id);

    const nodeData: PersonNodeData = {
      person,
      childCount,
      hasHiddenChildren: isCollapsed && childCount > 0,
      collapsed: isCollapsed,
    };

    nodes.push({
      id: person.id,
      type: "person",
      position: { x: n.x, y: n.y },
      data: nodeData as unknown as Record<string, unknown>,
      draggable: false,
    });
  }

  for (const link of allLinks) {
    const parentId = link.source.data.id;
    const childId = link.target.data.id;
    if (parentId === "__root" && childId === "__root") continue;

    if (parentId === "__root") continue; // akar virtual tidak digambar
    edges.push({
      id: `${parentId}->${childId}`,
      source: parentId,
      target: childId,
      type: "smoothstep",
      style: { stroke: "#8a6238", strokeOpacity: 0.45, strokeWidth: 1.5 },
    });
  }

  // Garis pasangan (dash) antar pasangan yang dua-duanya terlihat
  for (const partner of data.partnerEdges) {
    if (
      personById.has(partner.partnerAId) &&
      personById.has(partner.partnerBId) &&
      nodes.some((n) => n.id === partner.partnerAId) &&
      nodes.some((n) => n.id === partner.partnerBId)
    ) {
      edges.push({
        id: `partner-${partner.partnerAId}-${partner.partnerBId}`,
        source: partner.partnerAId,
        target: partner.partnerBId,
        type: "straight",
        style: {
          stroke: "#b4872a",
          strokeWidth: 2,
          strokeDasharray: "5 4",
        },
      });
    }
  }

  return { nodes, edges };
}

export function getRootId(data: FamilyTreeData): string | null {
  const childIds = new Set(data.childEdges.map((e) => e.childId));
  const roots = data.persons
    .filter((p) => !childIds.has(p.id))
    .sort(
      (a, b) => (a.generationLevel ?? 999) - (b.generationLevel ?? 999),
    );
  return roots[0]?.id ?? null;
}