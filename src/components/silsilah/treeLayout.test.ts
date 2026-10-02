import assert from "node:assert/strict";
import test from "node:test";
import type { Edge } from "@xyflow/react";
import { buildTreeGraph, getRootId, NODE_MIN_GAP, type FamilyTreeData } from "./treeLayout";
import type { PublicPerson } from "@/lib/data";

// ── fixture: 16 orang tanpa orang tua + 6 anak ──────────────────────────
function person(id: string, generationLevel: number | null): PublicPerson {
  return {
    id,
    fullName: `Orang ${id}`,
    nickname: null,
    namaPanggilan: null,
    gender: "MALE",
    birthDate: null,
    deathDate: null,
    birthPlace: null,
    isDeceased: false,
    bio: null,
    photoUrl: null,
    generationLevel,
    isMarriedInto: false,
    branch: null,
    socialLinks: [],
  };
}

const ROOT_IDS = Array.from({ length: 16 }, (_, i) => `A${String(i + 1).padStart(2, "0")}`);
const CHILD_IDS = ["B1", "B2", "B3", "B4", "B5", "B6"];
// A07..A16 tidak muncul di relasi mana pun.
const DISCONNECTED_IDS = ROOT_IDS.slice(6);

// generationLevel sengaja campur (termasuk null) supaya urutan akar
// ditentukan oleh tiebreaker id, bukan urutan input.
const ROOT_LEVELS = new Map<string, number | null>([
  ...ROOT_IDS.map((id, i) => [id, i < 8 ? 1 : i < 12 ? 2 : null] as const),
]);

const PERSONS: PublicPerson[] = [
  // urutan input diacak supaya sortiran akar benar-benar menentukan layout
  ...ROOT_IDS.map((id) => person(id, ROOT_LEVELS.get(id) ?? null)).reverse(),
  ...CHILD_IDS.map((id) => person(id, null)),
];

const CHILD_EDGES = [
  { parentId: "A01", childId: "B1" },
  { parentId: "A01", childId: "B2" },
  { parentId: "A02", childId: "B3" },
  { parentId: "A03", childId: "B4" },
  { parentId: "A04", childId: "B5" },
  { parentId: "A04", childId: "B6" },
].map((e) => ({ ...e, parentRole: "FATHER", isStep: false, isAdopted: false }));

const PARTNER_EDGES = [
  {
    partnerAId: "A05",
    partnerBId: "A06",
    status: "MARRIED",
    marriageDate: null,
    divorceDate: null,
    orderIndex: 0,
  },
];

const CONNECTED_IDS = ["A01", "A02", "A03", "A04", "A05", "A06", "B1", "B2", "B3", "B4", "B5", "B6"];

function fixture(): FamilyTreeData {
  return {
    persons: PERSONS,
    childEdges: CHILD_EDGES,
    partnerEdges: PARTNER_EDGES,
  };
}

// ── fixture: satu orang tua dengan dua anak ─────────────────────────────
function singleParentFixture(): FamilyTreeData {
  return {
    persons: [person("X", 0), person("Y1", 1), person("Y2", 1)],
    childEdges: [
      { parentId: "X", childId: "Y1", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "X", childId: "Y2", parentRole: "FATHER", isStep: false, isAdopted: false },
    ],
    partnerEdges: [],
  };
}

// ── fixture: sepasang orang tua dengan dua anak ─────────────────────────
function coupleChildrenFixture(): FamilyTreeData {
  return {
    persons: [person("A", 0), person("B", 0), person("Y1", 1), person("Y2", 1)],
    childEdges: [
      { parentId: "A", childId: "Y1", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "B", childId: "Y1", parentRole: "MOTHER", isStep: false, isAdopted: false },
      { parentId: "A", childId: "Y2", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "B", childId: "Y2", parentRole: "MOTHER", isStep: false, isAdopted: false },
    ],
    partnerEdges: [
      { partnerAId: "A", partnerBId: "B", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 0 },
    ],
  };
}

// ── fixture: urutan anak menurut orderIndex, urutan masukan diacak ──────
// orderIndex sengaja terbalik dari nama anak (C3=0, C2=1, C1=2) dan urutan
// baris diacak, supaya urutan array masukan tidak menentukan posisi.
function orderedSingleChildrenFixture(): FamilyTreeData {
  return {
    persons: [person("C2", 1), person("P", 0), person("C3", 1), person("C1", 1)],
    childEdges: [
      { parentId: "P", childId: "C2", parentRole: "FATHER", isStep: false, isAdopted: false, orderIndex: 1 },
      { parentId: "P", childId: "C1", parentRole: "FATHER", isStep: false, isAdopted: false, orderIndex: 2 },
      { parentId: "P", childId: "C3", parentRole: "FATHER", isStep: false, isAdopted: false, orderIndex: 0 },
    ],
    partnerEdges: [],
  };
}

function orderedCoupleChildrenFixture(): FamilyTreeData {
  const edge = (parentId: string, childId: string, parentRole: string, orderIndex: number) => ({
    parentId,
    childId,
    parentRole,
    isStep: false,
    isAdopted: false,
    orderIndex,
  });
  return {
    persons: [person("B", 0), person("C1", 1), person("A", 0), person("C3", 1), person("C2", 1)],
    childEdges: [
      edge("B", "C2", "MOTHER", 1),
      edge("A", "C1", "FATHER", 2),
      edge("B", "C1", "MOTHER", 2),
      edge("A", "C3", "FATHER", 0),
      edge("B", "C3", "MOTHER", 0),
      edge("A", "C2", "FATHER", 1),
    ],
    partnerEdges: [
      { partnerAId: "A", partnerBId: "B", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 0 },
    ],
  };
}

// ── fixture: anak tanpa orderIndex harus tetap deterministik ────────────
function noOrderIndexFixture(): FamilyTreeData {
  return {
    persons: [person("C3", 1), person("P", 0), person("C1", 1), person("C2", 1)],
    childEdges: [
      { parentId: "P", childId: "C2", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "P", childId: "C1", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "P", childId: "C3", parentRole: "FATHER", isStep: false, isAdopted: false },
    ],
    partnerEdges: [],
  };
}

// ── fixture: urutan anak lintas pernikahan harus global ─────────────────
// P menikah P1 (orderIndex 0) lalu P2 (orderIndex 1). C1 anak (P,P1) order 0,
// C2 anak (P,P2) order 0, C3 anak (P,P1) order 1. C2 dibuat lebih dulu dari C1,
// jadi urutan global (orderIndex, createdAt) = C2, C1, C3. Pengelompokan lama
// per pernikahan justru menghasilkan C1, C3, C2.
function crossMarriageOrderFixture(): FamilyTreeData {
  const early = "2024-01-01T00:00:00.000Z";
  const late = "2024-06-01T00:00:00.000Z";
  const edge = (
    parentId: string,
    childId: string,
    parentRole: string,
    orderIndex: number,
    createdAt: string,
  ) => ({ parentId, childId, parentRole, isStep: false, isAdopted: false, orderIndex, createdAt });
  return {
    persons: [
      person("P", 0),
      person("P1", 1),
      person("P2", 1),
      person("C1", 1),
      person("C2", 1),
      person("C3", 1),
    ],
    childEdges: [
      edge("P", "C1", "FATHER", 0, late),
      edge("P1", "C1", "MOTHER", 0, late),
      edge("P", "C2", "FATHER", 0, early),
      edge("P2", "C2", "MOTHER", 0, early),
      edge("P", "C3", "FATHER", 1, late),
      edge("P1", "C3", "MOTHER", 1, late),
    ],
    partnerEdges: [
      { partnerAId: "P", partnerBId: "P1", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 0 },
      { partnerAId: "P", partnerBId: "P2", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 1 },
    ],
  };
}

// ── fixture: subtree berat sebelah ──────────────────────────────────────
// X punya dua anak: Y1 (daun) dan Y2 (punya lima anak). Bentang subtree Y2
// jauh lebih lebar dari kartu Y2 sendiri, sehingga pusat bentang subtree tidak
// sama dengan pusat kartu anak-anak langsungnya.
function lopsidedSubtreeFixture(): FamilyTreeData {
  const leafIds = ["Z1", "Z2", "Z3", "Z4", "Z5"];
  return {
    persons: [
      person("X", 0),
      person("Y1", 1),
      person("Y2", 1),
      ...leafIds.map((id) => person(id, 2)),
    ],
    childEdges: [
      { parentId: "X", childId: "Y1", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "X", childId: "Y2", parentRole: "FATHER", isStep: false, isAdopted: false },
      ...leafIds.map((id) => ({
        parentId: "Y2",
        childId: id,
        parentRole: "FATHER",
        isStep: false,
        isAdopted: false,
      })),
    ],
    partnerEdges: [],
  };
}

// ── fixture: saudara dengan subtree lebar dan daun ──────────────────────
// P punya dua anak: A (menikah AP, punya lima anak) dan B (daun). Subtree A
// sangat lebar. B harus dipak di baris yang sama dekat kontur A, bukan
// dilempar ke kanan setelah seluruh subtree A.
function wideSiblingFixture(): FamilyTreeData {
  const grandchildIds = ["K1", "K2", "K3", "K4", "K5"];
  return {
    persons: [
      person("P", 0),
      person("A", 1),
      person("AP", 1),
      person("B", 1),
      ...grandchildIds.map((id) => person(id, 2)),
    ],
    childEdges: [
      { parentId: "P", childId: "A", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "P", childId: "B", parentRole: "FATHER", isStep: false, isAdopted: false },
      ...grandchildIds.map((id) => ({
        parentId: "A",
        childId: id,
        parentRole: "FATHER",
        isStep: false,
        isAdopted: false,
      })),
      ...grandchildIds.map((id) => ({
        parentId: "AP",
        childId: id,
        parentRole: "MOTHER",
        isStep: false,
        isAdopted: false,
      })),
    ],
    partnerEdges: [
      { partnerAId: "A", partnerBId: "AP", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 0 },
    ],
  };
}

// ── fixture: banyak pernikahan (Yossi dengan 3 pasangan) ────────────────
// M adalah orang primary, P1..P3 pasangan berurutan orderIndex, C1..C3
// masing-masing anak dari satu pernikahan berbeda.
function yossiFixture(): FamilyTreeData {
  const persons = [
    person("M", 0),
    person("P1", 1),
    person("P2", 1),
    person("P3", 1),
    person("C1", 1),
    person("C2", 1),
    person("C3", 1),
  ];
  const partnerEdges = [
    { partnerAId: "M", partnerBId: "P1", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 0 },
    { partnerAId: "M", partnerBId: "P2", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 1 },
    { partnerAId: "M", partnerBId: "P3", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 2 },
  ];
  const childEdges = [
    { parentId: "M", childId: "C1", parentRole: "FATHER", isStep: false, isAdopted: false },
    { parentId: "P1", childId: "C1", parentRole: "MOTHER", isStep: false, isAdopted: false },
    { parentId: "M", childId: "C2", parentRole: "FATHER", isStep: false, isAdopted: false },
    { parentId: "P2", childId: "C2", parentRole: "MOTHER", isStep: false, isAdopted: false },
    { parentId: "M", childId: "C3", parentRole: "FATHER", isStep: false, isAdopted: false },
    { parentId: "P3", childId: "C3", parentRole: "MOTHER", isStep: false, isAdopted: false },
  ];
  return { persons, childEdges, partnerEdges };
}

// ── helper ──────────────────────────────────────────────────────────────

/** Komponen terhubung berdasarkan relasi orang tua-anak dan pasangan. */
function connectedComponents(data: FamilyTreeData): string[][] {
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
  for (const e of data.partnerEdges) {
    if (parent.has(e.partnerAId) && parent.has(e.partnerBId)) union(e.partnerAId, e.partnerBId);
  }
  const groups = new Map<string, string[]>();
  for (const p of data.persons) {
    const root = find(p.id);
    const arr = groups.get(root) ?? [];
    arr.push(p.id);
    groups.set(root, arr);
  }
  return [...groups.values()];
}

type FamilyChildEdgeData = {
  kind: "child";
  originX: number;
  originY: number;
  busY: number;
};

/** Semua edge keturunan (bukan pernikahan). */
function childEdgesOf(edges: Edge[]) {
  return edges.filter((e) => e.type === "familyChild");
}

function childData(e: Edge): FamilyChildEdgeData {
  return e.data as unknown as FamilyChildEdgeData;
}

/** Setiap relasi orang tua-anak yang tampil harus menurun ke bawah. */
function assertChildrenBelowParents(data: FamilyTreeData) {
  const { nodes, edges } = buildTreeGraph(data, new Set());
  const yById = new Map(nodes.map((n) => [n.id, n.position.y]));
  const children = childEdgesOf(edges);
  assert.ok(children.length > 0, "harus ada garis keturunan");
  for (const e of children) {
    const childY = yById.get(e.target);
    if (childY === undefined) continue;
    const { originY, busY } = childData(e);
    assert.ok(originY < busY, `titik asal harus di atas bus untuk anak ${e.target}`);
    assert.ok(busY < childY, `bus harus di atas anak ${e.target}`);
  }
}

// ── tes ─────────────────────────────────────────────────────────────────

test("buildTreeGraph menampilkan semua pasangan dan semua anak dari tiap pernikahan", () => {
  const data = yossiFixture();
  const { nodes, edges } = buildTreeGraph(data, new Set());
  const ids = new Set(nodes.map((n) => n.id));
  for (const id of ["M", "P1", "P2", "P3", "C1", "C2", "C3"]) {
    assert.ok(ids.has(id), `node ${id} hilang`);
  }
  for (const c of ["C1", "C2", "C3"]) {
    assert.ok(edges.some((e) => e.target === c), `edge ke ${c} hilang`);
  }
  // tiga garis pernikahan
  const partnerEdges = edges.filter((e) => e.id.startsWith("partner-"));
  assert.equal(partnerEdges.length, 3, "harus ada 3 garis pernikahan");
});

test("buildTreeGraph menumbuhkan anak ke bawah dari orang tuanya", () => {
  assertChildrenBelowParents(fixture());
  assertChildrenBelowParents(yossiFixture());
  assertChildrenBelowParents(coupleChildrenFixture());
});

test("buildTreeGraph menaruh orang tua di tengah rentang anak-anaknya", () => {
  const xOf = (nodes: { id: string; position: { x: number } }[], id: string) =>
    nodes.find((n) => n.id === id)!.position.x;

  const single = buildTreeGraph(singleParentFixture(), new Set());
  const parentX = xOf(single.nodes, "X");
  const singleKids = ["Y1", "Y2"].map((id) => xOf(single.nodes, id));
  const singleMid = (Math.min(...singleKids) + Math.max(...singleKids)) / 2;
  assert.ok(
    Math.abs(parentX - singleMid) <= NODE_MIN_GAP,
    `orang tua X harus di tengah anak, x=${parentX} titik tengah anak=${singleMid}`,
  );

  const couple = buildTreeGraph(coupleChildrenFixture(), new Set());
  const coupleMid = (xOf(couple.nodes, "A") + xOf(couple.nodes, "B")) / 2;
  const coupleKids = ["Y1", "Y2"].map((id) => xOf(couple.nodes, id));
  const coupleKidsMid = (Math.min(...coupleKids) + Math.max(...coupleKids)) / 2;
  assert.ok(
    Math.abs(coupleMid - coupleKidsMid) <= NODE_MIN_GAP,
    `pasangan A/B harus di tengah anak, titik tengah pasangan=${coupleMid} anak=${coupleKidsMid}`,
  );
});

test("buildTreeGraph memusatkan orang tua pada bentang penuh subtree anak", () => {
  // X punya anak Y1 (daun) dan Y2 (subtree lebar berisi 5 anak). Pusat kartu
  // Y1/Y2 akan membuat X bergeser, padahal X harus di tengah bentang penuh
  // kedua subtree anaknya.
  const { nodes } = buildTreeGraph(lopsidedSubtreeFixture(), new Set());
  const xOf = (id: string) => nodes.find((n) => n.id === id)!.position.x;

  const x = xOf("X");
  const leftEdge = Math.min(xOf("Y1"), xOf("Y2"), ...["Z1", "Z2", "Z3", "Z4", "Z5"].map(xOf));
  const rightEdge = Math.max(
    xOf("Y1") + 260,
    xOf("Y2") + 260,
    ...["Z1", "Z2", "Z3", "Z4", "Z5"].map((id) => xOf(id) + 260),
  );
  const subtreeCenter = (leftEdge + rightEdge) / 2;
  const parentCenter = x + 260 / 2;

  assert.ok(
    Math.abs(parentCenter - subtreeCenter) <= NODE_MIN_GAP,
    `X harus di tengah bentang subtree anak, pusat X=${parentCenter} pusat subtree=${subtreeCenter}`,
  );
});

test("buildTreeGraph memak saudara daun di kontur baris, bukan setelah subtree lebar", () => {
  // A menikah AP dan punya lima anak (subtree lebar). B adalah daun. B harus
  // dipak di baris anak P yang sama, tepat di kanan kartu A, bukan terlempar
  // ke kanan setelah seluruh subtree A.
  const { nodes } = buildTreeGraph(wideSiblingFixture(), new Set());
  const xOf = (id: string) => nodes.find((n) => n.id === id)!.position.x;
  const yOf = (id: string) => nodes.find((n) => n.id === id)!.position.y;

  // B sebaris dengan A (sesama anak P); AP berada di baris bawah A.
  assert.equal(yOf("B"), yOf("A"), "B harus sebaris dengan A");
  assert.notEqual(yOf("AP"), yOf("A"), "pasangan AP harus di baris bawah, bukan sebaris");

  const aRowRight = xOf("A") + 260;
  const gap = xOf("B") - aRowRight;
  const GAP_X = 60;
  const COUPLE_SPACING = 260 + 40;
  assert.ok(
    gap >= GAP_X && gap <= GAP_X + COUPLE_SPACING,
    `B harus dekat kontur baris A, jarak=${Math.round(gap)} (harus ${GAP_X}..${GAP_X + COUPLE_SPACING})`,
  );
});

test("buildTreeGraph menyebar anak ke kiri dan kanan orang tua", () => {
  const { nodes } = buildTreeGraph(singleParentFixture(), new Set());
  const parentX = nodes.find((n) => n.id === "X")!.position.x;
  const kids = ["Y1", "Y2"].map((id) => nodes.find((n) => n.id === id)!.position.x);
  assert.ok(kids.some((x) => x < parentX), "harus ada anak di kiri orang tua");
  assert.ok(kids.some((x) => x > parentX), "harus ada anak di kanan orang tua");
});

test("buildTreeGraph menaruh pasangan di baris bawah, bukan menyelip di antara anak", () => {
  const { nodes } = buildTreeGraph(fixture(), new Set());
  const a05 = nodes.find((n) => n.id === "A05")!;
  const a06 = nodes.find((n) => n.id === "A06")!;
  assert.notEqual(a05.position.y, a06.position.y, "pasangan harus di baris terpisah");
  assert.notEqual(a05.position.x, a06.position.x, "pasangan harus terpisah horizontal");

  // Deretan anak orang tua berpasangan harus bersih: semua anak langsung
  // berada di satu baris yang sama, tanpa kartu pasangan menyelip.
  const couple = buildTreeGraph(coupleChildrenFixture(), new Set());
  const yOf = (id: string) => couple.nodes.find((n) => n.id === id)!.position.y;
  assert.equal(yOf("Y1"), yOf("Y2"), "semua anak harus sebaris");
  assert.notEqual(yOf("A"), yOf("Y1"), "pasangan tidak sebaris dengan anak");
  assert.notEqual(yOf("B"), yOf("Y1"), "pasangan tidak sebaris dengan anak");
});

test("buildTreeGraph menyembunyikan orang tanpa relasi secara default", () => {
  const { nodes, edges } = buildTreeGraph(fixture(), new Set());
  const ids = new Set(nodes.map((n) => n.id));
  assert.equal(nodes.length, CONNECTED_IDS.length, "hanya orang terhubung yang tampil");
  for (const id of DISCONNECTED_IDS) {
    assert.ok(!ids.has(id), `${id} tanpa relasi harus disembunyikan`);
  }
  for (const e of edges) {
    assert.ok(ids.has(e.source) && ids.has(e.target), `edge ${e.id} menyentuh node tersembunyi`);
  }
});

test("buildTreeGraph menampilkan orang tanpa relasi bila showDisconnected true", () => {
  const { nodes } = buildTreeGraph(fixture(), new Set(), { showDisconnected: true });
  const ids = new Set(nodes.map((n) => n.id));
  assert.equal(nodes.length, PERSONS.length, "semua orang tampil");
  for (const p of PERSONS) assert.ok(ids.has(p.id), `${p.id} harus tampil`);
});

test("buildTreeGraph menumpuk komponen terhubung dari atas ke bawah tanpa wrap", () => {
  const data = fixture();
  const { nodes } = buildTreeGraph(data, new Set());
  const pos = new Map(nodes.map((n) => [n.id, n.position]));
  const groups = connectedComponents(data).filter((g) => g.some((id) => pos.has(id)));
  assert.ok(groups.length >= 2, "fixture harus punya beberapa komponen terhubung");

  const ranges = groups
    .map((g) => {
      const ys = g.filter((id) => pos.has(id)).map((id) => pos.get(id)!.y);
      return { min: Math.min(...ys), max: Math.max(...ys) };
    })
    .sort((a, b) => a.min - b.min);

  for (let i = 1; i < ranges.length; i++) {
    assert.ok(
      ranges[i].min >= ranges[i - 1].max,
      `komponen ke-${i} harus berada di bawah komponen sebelumnya, ${ranges[i].min} < ${ranges[i - 1].max}`,
    );
  }
});

test("kartu pada baris yang sama tidak bertumpuk", () => {
  for (const data of [fixture(), yossiFixture(), coupleChildrenFixture()]) {
    const { nodes } = buildTreeGraph(data, new Set());
    const byRow = new Map<number, { id: string; x: number }[]>();
    for (const n of nodes) {
      const row = byRow.get(n.position.y) ?? [];
      row.push({ id: n.id, x: n.position.x });
      byRow.set(n.position.y, row);
    }
    for (const [y, row] of byRow) {
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) {
        assert.ok(
          row[i].x - row[i - 1].x >= NODE_MIN_GAP,
          `kartu ${row[i - 1].id} dan ${row[i].id} bertumpuk di y=${y}`,
        );
      }
    }
  }
});

test("buildTreeGraph memancarkan tepat satu node per orang terhubung", () => {
  const { nodes } = buildTreeGraph(fixture(), new Set());

  const ids = nodes.map((n) => n.id);
  assert.equal(ids.length, CONNECTED_IDS.length, "jumlah node = jumlah orang terhubung");
  assert.equal(new Set(ids).size, ids.length, "tidak ada node ganda");

  for (const id of CONNECTED_IDS) {
    assert.equal(
      ids.filter((x) => x === id).length,
      1,
      `orang ${id} harus muncul tepat satu kali`,
    );
  }
  for (const n of nodes) {
    assert.equal(n.type, "person");
    assert.equal(n.draggable, false);
    assert.ok(n.position && typeof n.position.x === "number" && typeof n.position.y === "number");
  }
});

test("buildTreeGraph memancarkan satu garis keturunan per anak dan garis pasangan", () => {
  const { nodes, edges } = buildTreeGraph(fixture(), new Set());
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edgeIds = new Set(edges.map((e) => e.id));

  // Satu garis per anak, bukan per orang tua: A04 punya B5 dan B6 (2 anak),
  // bukan 2 garis per anak.
  const children = childEdgesOf(edges);
  const childTargets = children.map((e) => e.target);
  for (const id of ["B1", "B2", "B3", "B4", "B5", "B6"]) {
    assert.equal(
      childTargets.filter((t) => t === id).length,
      1,
      `anak ${id} harus punya tepat satu garis keturunan`,
    );
  }
  for (const e of children) {
    assert.ok(nodeIds.has(e.source), `sumber ${e.id} bukan node yang dipancarkan`);
    assert.ok(nodeIds.has(e.target), `tujuan ${e.id} bukan node yang dipancarkan`);
  }

  assert.ok(edgeIds.has("partner-A05+A06"), "edge pasangan A05+A06 hilang");
  const partnerEdge = edges.find((e) => e.id === "partner-A05+A06")!;
  assert.equal(partnerEdge.type, "familyMarriage");
  assert.ok(nodeIds.has(partnerEdge.source) && nodeIds.has(partnerEdge.target));

  assert.equal(ROOT_IDS.includes(getRootId(fixture()) ?? ""), true);
});

test("buildTreeGraph mengelompokkan saudara pada satu bus ortogonal", () => {
  // Sepasang orang tua dengan dua anak: kedua garis anak harus berbagi bus yang
  // sama dan titik asal yang sama, sehingga membentuk satu konektor keluarga.
  const { edges } = buildTreeGraph(coupleChildrenFixture(), new Set());
  const kids = childEdgesOf(edges).filter((e) => ["Y1", "Y2"].includes(e.target));
  assert.equal(kids.length, 2, "dua garis anak");
  const first = childData(kids[0]);
  const second = childData(kids[1]);
  assert.equal(first.busY, second.busY, "bus saudara harus sama");
  assert.equal(first.originX, second.originX, "titik asal saudara harus sama");
  assert.equal(first.originY, second.originY, "titik asal saudara harus sama");
});

test("buildTreeGraph menaruh titik asal pasangan di celah antara dua kartu", () => {
  const { nodes, edges } = buildTreeGraph(coupleChildrenFixture(), new Set());
  const xOf = (id: string) => nodes.find((n) => n.id === id)!.position.x;
  const kids = childEdgesOf(edges).filter((e) => ["Y1", "Y2"].includes(e.target));
  const { originX } = childData(kids[0]);
  // Kartu A di x=0, kartu B di x=300 (260 + 40). Titik tengah celah = 280.
  const mid = (xOf("A") + 260 + xOf("B")) / 2;
  assert.ok(
    Math.abs(originX - mid) <= NODE_MIN_GAP,
    `titik asal harus di celah pasangan, origin=${originX} mid=${mid}`,
  );
});

test("buildTreeGraph memberi titik asal berbeda untuk tiap pernikahan", () => {
  // M punya tiga pasangan berurutan; tiap pernikahan harus turun dari celahnya
  // sendiri, bukan semua menumpuk di satu titik.
  const { edges } = buildTreeGraph(yossiFixture(), new Set());
  const kids = childEdgesOf(edges);
  const byTarget = new Map(kids.map((e) => [e.target, childData(e)]));
  for (const c of ["C1", "C2", "C3"]) {
    assert.ok(byTarget.has(c), `garis anak ${c} hilang`);
  }
  const origins = ["C1", "C2", "C3"].map((c) => byTarget.get(c)!.originX);
  assert.equal(new Set(origins).size, 3, `tiap pernikahan titik asal sendiri: ${origins}`);
});

test("buildTreeGraph deterministik pada pemanggilan berulang", () => {
  const first = buildTreeGraph(fixture(), new Set());
  const second = buildTreeGraph(fixture(), new Set());

  assert.deepEqual(second.nodes, first.nodes);
  assert.deepEqual(second.edges, first.edges);
});

test("buildTreeGraph memancarkan edge orang tua dari pasangan yang menikah masuk", () => {
  const data: FamilyTreeData = {
    persons: [
      person("A1", 1), person("A2", 2), person("B1", 1), person("B2", 2),
    ],
    childEdges: [
      { parentId: "A1", childId: "A2", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "B1", childId: "B2", parentRole: "FATHER", isStep: false, isAdopted: false },
    ],
    partnerEdges: [
      { partnerAId: "A2", partnerBId: "B2", status: "MARRIED", marriageDate: null, divorceDate: null, orderIndex: 0 },
    ],
  };
  const { nodes, edges } = buildTreeGraph(data, new Set());
  const ids = new Set(nodes.map((n) => n.id));
  for (const id of ["A1", "A2", "B1", "B2"]) assert.ok(ids.has(id), `node ${id} hilang`);
  assert.ok(edges.some((e) => e.id === "child-A2"), "garis keturunan A2 hilang");
  assert.ok(edges.some((e) => e.id === "child-B2"), "garis keturunan B2 hilang");
});

test("buildTreeGraph menyembunyikan anak saat induknya collapsed", () => {
  const { nodes, edges } = buildTreeGraph(fixture(), new Set(["A01"]));

  const ids = nodes.map((n) => n.id);
  assert.ok(!ids.includes("B1") && !ids.includes("B2"), "anak A01 disembunyikan");
  assert.ok(!edges.some((e) => e.id === "child-B1"), "garis anak B1 disembunyikan");
  assert.ok(ids.includes("A02"), "induk yang lain tetap tampil");

  const a01 = nodes.find((n) => n.id === "A01")!;
  assert.equal((a01.data as { collapsed: boolean }).collapsed, true);
  assert.equal((a01.data as { hasHiddenChildren: boolean }).hasHiddenChildren, true);
});

test("buildTreeGraph mengurutkan anak menurut orderIndex, bukan urutan masukan", () => {
  const xOf = (nodes: { id: string; position: { x: number } }[], id: string) =>
    nodes.find((n) => n.id === id)!.position.x;

  for (const [nama, data] of [
    ["satu orang tua", orderedSingleChildrenFixture()],
    ["sepasang orang tua", orderedCoupleChildrenFixture()],
  ] as const) {
    const { nodes } = buildTreeGraph(data, new Set());
    const x3 = xOf(nodes, "C3");
    const x2 = xOf(nodes, "C2");
    const x1 = xOf(nodes, "C1");
    assert.ok(
      x3 < x2 && x2 < x1,
      `${nama}: orderIndex 0,1,2 harus kiri ke kanan, x(C3)=${x3} x(C2)=${x2} x(C1)=${x1}`,
    );
  }
});

test("buildTreeGraph mengurutkan anak lintas pernikahan secara global, bukan per pasangan", () => {
  const xOf = (nodes: { id: string; position: { x: number } }[], id: string) =>
    nodes.find((n) => n.id === id)!.position.x;

  const first = buildTreeGraph(crossMarriageOrderFixture(), new Set());
  const second = buildTreeGraph(crossMarriageOrderFixture(), new Set());

  const x1 = xOf(first.nodes, "C1");
  const x2 = xOf(first.nodes, "C2");
  const x3 = xOf(first.nodes, "C3");
  assert.ok(
    x2 < x1 && x1 < x3,
    `anak lintas pernikahan harus urut global (C2,C1,C3), x(C2)=${x2} x(C1)=${x1} x(C3)=${x3}`,
  );

  // Urutan harus deterministik antar pemanggilan.
  for (const id of ["C1", "C2", "C3"]) {
    assert.equal(xOf(second.nodes, id), xOf(first.nodes, id), `x ${id} harus sama antar pemanggilan`);
  }
  assert.deepEqual(second.nodes, first.nodes);
  assert.deepEqual(second.edges, first.edges);
});

test("buildTreeGraph tetap deterministik saat orderIndex tidak ada", () => {
  const data = noOrderIndexFixture();
  const first = buildTreeGraph(data, new Set());
  const second = buildTreeGraph(data, new Set());
  assert.deepEqual(second.nodes, first.nodes);
  assert.deepEqual(second.edges, first.edges);
});

test("buildTreeGraph berhenti dan memancarkan kedua node saat silsilah melingkar", () => {
  // A orang tua B dan B orang tua A. Traversal tidak boleh berputar tanpa
  // henti; kedua node harus tetap dipancarkan tepat satu kali.
  const data: FamilyTreeData = {
    persons: [person("A", 1), person("B", 1)],
    childEdges: [
      { parentId: "A", childId: "B", parentRole: "FATHER", isStep: false, isAdopted: false },
      { parentId: "B", childId: "A", parentRole: "FATHER", isStep: false, isAdopted: false },
    ],
    partnerEdges: [],
  };
  const { nodes } = buildTreeGraph(data, new Set());
  const ids = nodes.map((n) => n.id).sort();
  assert.deepEqual(ids, ["A", "B"]);
});
