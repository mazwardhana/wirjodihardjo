import type { Edge, Node } from "@xyflow/react";
import type { PublicPerson } from "@/lib/data";

export type ChildEdge = {
  parentId: string;
  childId: string;
  parentRole: string;
  isStep: boolean;
  isAdopted: boolean;
  orderIndex?: number;
  /** Waktu baris relasi dibuat. Pemecah seri bila `orderIndex` sama. */
  createdAt?: Date | string | null;
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

/**
 * Data geometri garis keturunan ortogonal. Semua koordinat absolut (koordinat
 * kanvas React Flow). `originX/originY` adalah titik turun keluarga (celah
 * pasangan atau tengah kartu orang tua tunggal), `busY` adalah garis bus
 * horizontal yang dipakai bersama saudara-saudara.
 */
export type FamilyChildEdgeData = {
  kind: "child";
  originX: number;
  originY: number;
  busY: number;
};

/**
 * Geometri garis pernikahan. Kartu pasangan berada satu baris di bawah kartu
 * darah, jadi garis bisa horizontal (antar pasangan sebaris) atau menurun
 * (dari kartu darah ke pasangan di bawahnya).
 */
export type FamilyMarriageEdgeData = {
  kind: "marriage";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const NODE_W = 260;
const NODE_H = 130; // tinggi kartu orang
const COUPLE_SPACING = NODE_W + 40; // jarak kartu primary ke kartu pasangan
const GAP_X = 60; // spasi horizontal antar blok / anak di dalam baris
const GAP_Y = 80; // spasi vertikal antar baris dan antar komponen

/** Jarak minimum antar kartu pada baris yang sama, dipakai jaminan anti tumpuk. */
export const NODE_MIN_GAP = 16;

type PlacedNode = {
  id: string;
  x: number;
  y: number;
  partnerStatus: PersonNodeData["partnerStatus"];
};

type PartnerLink = { a: string; b: string; edge: PartnerEdge };

/** Konektor satu anak: identitas anak dan orang tuanya. Geometri dihitung
 *  dari posisi final node saat edge dipancarkan. */
type ChildBus = {
  childId: string;
  parentIds: string[];
};

/**
 * Hasil layout satu keluarga, koordinat relatif terhadap kartu primary di (0,0).
 * `left` dan `right` adalah batas kiri/kanan relatif terhadap kartu primary,
 * dipakai saat blok ini ditempel sebagai anak di baris berikutnya.
 */
type FamilyLayout = {
  positions: PlacedNode[];
  partnerLinks: PartnerLink[];
  childBus: ChildBus[];
  left: number;
  right: number;
  height: number;
  /**
   * Kontur kiri/kanan per kedalaman lokal (0 = baris primary blok). Dipakai
   * untuk mengemas blok saudara berdasarkan bentuk tiap baris, bukan lebar
   * penuh subtree, supaya baris yang masih longgar tidak terdorong jauh.
   */
  leftContour: number[];
  rightContour: number[];
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
 * Orang tanpa relasi apa pun disembunyikan secara default. Set
 * `options.showDisconnected` menjadi true untuk menampilkannya kembali.
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
  options: { showDisconnected?: boolean } = {},
): { nodes: Node[]; edges: Edge[] } {
  const showDisconnected = options.showDisconnected ?? false;

  // Orang tanpa satu pun relasi tidak ikut tampil kecuali diminta.
  const allIds = new Set(data.persons.map((p) => p.id));
  const connected = new Set<string>();
  for (const e of data.childEdges) {
    if (allIds.has(e.parentId) && allIds.has(e.childId)) {
      connected.add(e.parentId);
      connected.add(e.childId);
    }
  }
  for (const e of data.partnerEdges) {
    if (allIds.has(e.partnerAId) && allIds.has(e.partnerBId)) {
      connected.add(e.partnerAId);
      connected.add(e.partnerBId);
    }
  }
  const visiblePersons = showDisconnected
    ? data.persons
    : data.persons.filter((p) => connected.has(p.id));
  const visibleData: FamilyTreeData = {
    persons: visiblePersons,
    childEdges: data.childEdges,
    partnerEdges: data.partnerEdges,
  };

  const personById = new Map(visiblePersons.map((p) => [p.id, p]));

  // Map parent → semua ChildEdge dari parent itu
  const childEdgesByParent = new Map<string, ChildEdge[]>();
  // Map child → semua parentId
  const parentIdsByChild = new Map<string, string[]>();

  for (const edge of data.childEdges) {
    if (!personById.has(edge.parentId) || !personById.has(edge.childId)) continue;
    appendTo(childEdgesByParent, edge.parentId, edge);
    appendTo(parentIdsByChild, edge.childId, edge.parentId);
  }

  // Nomor urut anak (terkecil bila ada beberapa baris untuk anak yang sama).
  // Dipakai agar urutan tampil tidak bergantung pada urutan array masukan.
  const orderIndexByChild = new Map<string, number>();
  // Waktu dibuat paling awal per anak. Pemecah seri saat nomor urut sama,
  // supaya urutan seri mengikuti urutan input, bukan kebetulan id.
  const createdAtByChild = new Map<string, number>();
  for (const edge of data.childEdges) {
    if (edge.orderIndex !== undefined) {
      const current = orderIndexByChild.get(edge.childId);
      if (current === undefined || edge.orderIndex < current) {
        orderIndexByChild.set(edge.childId, edge.orderIndex);
      }
    }
    const t = edge.createdAt ? new Date(edge.createdAt).getTime() : Number.NaN;
    if (!Number.isNaN(t)) {
      const current = createdAtByChild.get(edge.childId);
      if (current === undefined || t < current) createdAtByChild.set(edge.childId, t);
    }
  }
  // Urutan anak mengikuti setelan pengguna: orderIndex naik, lalu waktu dibuat
  // (urutan input), lalu childId. Samakan dengan urutan daftar anak di panel
  // admin supaya pohon selalu mencerminkan setelan "Naik/Turun".
  const compareChild = (a: string, b: string) => {
    const oa = orderIndexByChild.get(a) ?? Number.POSITIVE_INFINITY;
    const ob = orderIndexByChild.get(b) ?? Number.POSITIVE_INFINITY;
    if (oa !== ob) return oa - ob;
    const ta = createdAtByChild.get(a) ?? Number.POSITIVE_INFINITY;
    const tb = createdAtByChild.get(b) ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return a < b ? -1 : a > b ? 1 : 0;
  };

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
  // Urutan anak dalam tiap grup ditentukan orderIndex, bukan urutan insersi.
  for (const kids of coupleChildren.values()) kids.sort(compareChild);
  for (const kids of singleChildren.values()) kids.sort(compareChild);

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
    const childBus: ChildBus[] = [];
    const claimed = new Set<string>();

    // Baris kartu: primary di x=0, lalu semua pasangan (termasuk pasangan dari
    // pasangan) berjajar ke kanan mengikuti BFS, sehingga pernikahan berantai
    // tetap satu pohon dan tidak ada pasangan yang hilang.
    const row: { id: string; x: number }[] = [{ id: pid, x: 0 }];
    const queue: string[] = [pid];
    let primaryStatus: PersonNodeData["partnerStatus"] = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const pr of partnerOf(current)) {
        if (seen.has(pr.id)) continue;
        seen.add(pr.id);
        const x = row.length * COUPLE_SPACING;
        row.push({ id: pr.id, x });
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
      parentIds: string[];
      layout: FamilyLayout;
    }[] = [];

    const pushChildBlock = (childId: string, parentIds: string[]) => {
      if (seen.has(childId) || claimed.has(childId)) return;
      // Collapse per individu: bila salah satu orang tua dikuncupkan, anak
      // dari pernikahan itu ikut disembunyikan.
      if (parentIds.some((id) => collapsed.has(id))) {
        markHidden(childId);
        return;
      }
      claimed.add(childId);
      blocks.push({ childId, parentIds, layout: layoutFamily(childId) });
    };

    // Anak dari tiap pernikahan disusun berurutan.
    for (const link of partnerLinks) {
      for (const cid of coupleChildren.get(coupleKey(link.a, link.b)) ?? []) {
        pushChildBlock(cid, [link.a, link.b]);
      }
    }
    // Anak dengan satu orang tua (atau dua orang tua yang bukan pasangan
    // tercatat) digantung di bawah kartu orang tuanya.
    for (const card of row) {
      for (const cid of singleChildren.get(card.id) ?? []) {
        pushChildBlock(cid, [card.id]);
      }
      for (const [key, kids] of coupleChildren) {
        const parents = key.split("|");
        if (!parents.includes(card.id)) continue;
        for (const cid of kids) {
          pushChildBlock(cid, parents);
        }
      }
    }

    // Setelah semua blok anak terkumpul, urutkan sekali secara global mengikuti
    // setelan urutan anak (orderIndex lalu waktu dibuat). Tanpa ini, anak dari
    // pernikahan berbeda tampil berkelompok per pasangan dan urutannya tidak
    // sesuai daftar anak di panel admin.
    blocks.sort((a, b) => compareChild(a.childId, b.childId));

    const childY = NODE_H + GAP_Y;
    const cardsWidth = (row.length - 1) * COUPLE_SPACING + NODE_W;
    const placements: { offset: number; block: (typeof blocks)[number] }[] = [];
    const occupied = new Map<number, number>([[0, cardsWidth]]);
    let childHeight = 0;
    for (const block of blocks) {
      let offset = 0;
      for (let d = 0; d < block.layout.leftContour.length; d++) {
        const limit = occupied.get(d + 1);
        if (limit === undefined) continue;
        const candidate = limit + GAP_X - block.layout.leftContour[d];
        if (candidate > offset) offset = candidate;
      }
      placements.push({ offset, block });
      for (let d = 0; d < block.layout.rightContour.length; d++) {
        const limit = occupied.get(d + 1);
        const right = offset + block.layout.rightContour[d];
        if (limit === undefined || right > limit) occupied.set(d + 1, right);
      }
      childHeight = Math.max(childHeight, block.layout.height);
    }
    const childrenLeft =
      placements.length > 0
        ? Math.min(...placements.map((p) => p.offset + p.block.layout.left))
        : cardsWidth / 2;
    const childrenRight =
      placements.length > 0
        ? Math.max(...placements.map((p) => p.offset + p.block.layout.right))
        : cardsWidth / 2;
    const childrenCenter = (childrenLeft + childrenRight) / 2;
    const shift = cardsWidth / 2 - childrenCenter;

    let left = 0;
    let right = cardsWidth;
    for (const { offset, block } of placements) {
      for (const p of block.layout.positions) {
        const x = p.x + offset + shift;
        const y = p.y + childY;
        positions.push({ ...p, x, y });
        left = Math.min(left, x);
        right = Math.max(right, x + NODE_W);
      }
      partnerLinks.push(...block.layout.partnerLinks);
      childBus.push(...block.layout.childBus);
      childBus.push({ childId: block.childId, parentIds: block.parentIds });
    }

    const height = blocks.length > 0 ? childY + childHeight : NODE_H;

    // Kontur per kedalaman dari seluruh posisi blok ini (sudah termasuk
    // pergeseran `shift`). y semua node blok adalah kelipatan childY, jadi
    // kedalaman lokal = y / childY.
    const leftContour: number[] = [];
    const rightContour: number[] = [];
    for (const p of positions) {
      const d = Math.round(p.y / childY);
      leftContour[d] = Math.min(leftContour[d] ?? Infinity, p.x);
      rightContour[d] = Math.max(rightContour[d] ?? -Infinity, p.x + NODE_W);
    }

    return { positions, partnerLinks, childBus, left, right, height, leftContour, rightContour };
  }

  // === Akar per komponen terhubung (union-find) ===
  const roots = orderedComponentRoots(visibleData, personById, parentIdsByChild);
  if (roots.length === 0) return { nodes: [], edges: [] };

  const blocks: FamilyLayout[] = [];
  for (const rootId of roots) {
    if (!seen.has(rootId)) blocks.push(layoutFamily(rootId));
  }
  // Jaring pengaman: anggota komponen yang belum tersentuh (mis. pernikahan
  // berantai) tetap tampil sebagai blok sendiri, tidak ada orang yang hilang.
  for (const p of visiblePersons) {
    if (!seen.has(p.id) && !hidden.has(p.id)) blocks.push(layoutFamily(p.id));
  }

  // === Tumpuk komponen dari atas ke bawah, rata kiri ===
  // Tidak ada wrap horizontal: setiap komponen menempati pita vertikalnya
  // sendiri, jadi pohon tumbuh ke bawah bukan memanjang ke kanan.
  const offsets: { x: number; y: number }[] = [];
  let cursorY = 0;
  for (const block of blocks) {
    offsets.push({ x: -block.left, y: cursorY });
    cursorY += block.height + GAP_Y;
  }

  // Setiap orang dipancarkan tepat sekali dengan posisi final. Bila kartu
  // berbagi baris yang sama namun terlalu rapat (mis. baris pasangan melintang
  // antar keluarga), geser ke kanan agar selalu ada jarak minimum NODE_MIN_GAP.
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const emitted = new Set<string>();
  const emittedChild = new Set<string>();
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
      const a = nodes.find((n) => n.id === link.a);
      const b = nodes.find((n) => n.id === link.b);
      if (!a || !b) continue;
      // Garis pernikahan menghubungkan kartu darah dan kartu pasangan. Bila
      // sebaris (mis. pasangan dari pasangan), garis horizontal pada tengah
      // kartu; bila beda baris, garis ortogonal dari bawah kartu darah ke
      // atas kartu pasangan.
      const sameRow = Math.abs(a.position.y - b.position.y) < 1;
      const x1 = a.position.x + NODE_W / 2;
      const x2 = b.position.x + NODE_W / 2;
      let y1: number;
      let y2: number;
      if (sameRow) {
        y1 = a.position.y + NODE_H / 2;
        y2 = y1;
      } else {
        const upper = a.position.y < b.position.y ? a : b;
        const lower = a.position.y < b.position.y ? b : a;
        y1 = upper.position.y + NODE_H;
        y2 = lower.position.y;
      }
      edges.push({
        id: `partner-${link.a}+${link.b}`,
        source: link.a,
        target: link.b,
        type: "familyMarriage",
        data: {
          kind: "marriage",
          x1,
          y1,
          x2,
          y2,
        } satisfies FamilyMarriageEdgeData as unknown as Record<string, unknown>,
        style: partnerLineStyle(link.edge.status),
      });
    }

    // Satu garis keturunan per anak. Geometri dihitung dari posisi node final
    // (setelah pergeseran anti-tumpuk) supaya konektor selalu menempel ke kartu.
    for (const cb of block.childBus) {
      if (emittedChild.has(cb.childId)) continue;
      if (cb.parentIds.some((id) => collapsed.has(id))) continue;
      const child = nodes.find((n) => n.id === cb.childId);
      const parents = cb.parentIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is Node => n !== undefined);
      if (!child || parents.length === 0) continue;

      const ce = cb.parentIds
        .flatMap((id) => childEdgesByParent.get(id) ?? [])
        .find((e) => e.childId === cb.childId);
      const originX = familyOriginX(parents);
      const originY = Math.max(...parents.map((p) => p.position.y)) + NODE_H;
      const busY = child.position.y - GAP_Y / 2;
      emittedChild.add(cb.childId);

      edges.push({
        id: `child-${cb.childId}`,
        source: parents[0].id,
        target: cb.childId,
        type: "familyChild",
        data: {
          kind: "child",
          originX,
          originY,
          busY,
        } satisfies FamilyChildEdgeData as unknown as Record<string, unknown>,
        style: childLineStyle(ce),
      });
    }
  }

  // Sapuan: pasangan yang menikah masuk bisa terserap ke baris keluarga lain
  // sehingga garis dari orang tuanya tidak tercatat saat traversal. Pancarkan
  // sisa garis keturunan yang kedua ujungnya tampil, dengan geometri ortogonal
  // dari kartu orang tua yang tersedia.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const ce of data.childEdges) {
    if (emittedChild.has(ce.childId)) continue;
    if (collapsed.has(ce.parentId)) continue;
    const child = nodeById.get(ce.childId);
    const parent = nodeById.get(ce.parentId);
    if (!child || !parent) continue;
    const parents = (parentIdsByChild.get(ce.childId) ?? [])
      .map((id) => nodeById.get(id))
      .filter((n): n is Node => n !== undefined);
    if (parents.length === 0) continue;
    emittedChild.add(ce.childId);
    edges.push({
      id: `child-${ce.childId}`,
      source: parents[0].id,
      target: ce.childId,
      type: "familyChild",
      data: {
        kind: "child",
        originX: familyOriginX(parents),
        originY: Math.max(...parents.map((p) => p.position.y)) + NODE_H,
        busY: child.position.y - GAP_Y / 2,
      } satisfies FamilyChildEdgeData as unknown as Record<string, unknown>,
      style: childLineStyle(ce),
    });
  }

  return { nodes, edges };
}

/**
 * Titik turun keluarga pada koordinat kanvas: tengah celah pasangan, atau
 * tengah kartu orang tua tunggal. Bila titik tengah pasangan jatuh di dalam
 * kartu lain pada baris yang sama (pernikahan beruntun), digeser ke tepi
 * kanan kartu itu agar garis tidak keluar dari tengah kartu orang lain.
 */
function familyOriginX(parents: Node[]): number {
  if (parents.length === 1) return parents[0].position.x + NODE_W / 2;
  const left = Math.min(...parents.map((p) => p.position.x));
  const right = Math.max(...parents.map((p) => p.position.x));
  const mid = (left + right) / 2 + NODE_W / 2;
  for (const p of [...parents].sort((a, b) => a.position.x - b.position.x)) {
    if (mid > p.position.x && mid < p.position.x + NODE_W) {
      return p.position.x + NODE_W;
    }
  }
  return mid;
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
