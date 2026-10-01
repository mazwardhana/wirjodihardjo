import assert from "node:assert/strict";
import test from "node:test";
import { buildTreeGraph, getRootId, type FamilyTreeData } from "./treeLayout";
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
    branch: null,
    socialLinks: [],
  };
}

const ROOT_IDS = Array.from({ length: 16 }, (_, i) => `A${String(i + 1).padStart(2, "0")}`);
const CHILD_IDS = ["B1", "B2", "B3", "B4", "B5", "B6"];

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

function fixture(): FamilyTreeData {
  return {
    persons: PERSONS,
    childEdges: CHILD_EDGES,
    partnerEdges: PARTNER_EDGES,
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

// ── layout grid: akar tidak lagi berbaris pada satu y ────────────────────

test("buildTreeGraph menyebar akar ke beberapa baris grid", () => {
  const { nodes } = buildTreeGraph(fixture(), new Set());
  const rootIds = new Set(ROOT_IDS);

  const rootNodes = nodes.filter((n) => rootIds.has(n.id));
  assert.equal(rootNodes.length, 16, "semua orang tanpa orang tua tetap tampil");

  const distinctY = new Set(rootNodes.map((n) => n.position.y));
  assert.ok(
    distinctY.size >= 2,
    `akar harus tersebar di >= 2 baris, dapat ${distinctY.size} y berbeda`,
  );

  const distinctRows = [...distinctY].sort((a, b) => a - b);
  assert.ok(
    distinctRows[1] - distinctRows[0] > 100,
    `baris grid harus punya jarak vertikal jelas, y = ${distinctRows.join(", ")}`,
  );
});

test("buildTreeGraph memancarkan tepat satu node per orang", () => {
  const { nodes } = buildTreeGraph(fixture(), new Set());

  const ids = nodes.map((n) => n.id);
  assert.equal(ids.length, PERSONS.length, "jumlah node = jumlah orang");
  assert.equal(new Set(ids).size, ids.length, "tidak ada node ganda");

  for (const p of PERSONS) {
    assert.equal(
      ids.filter((id) => id === p.id).length,
      1,
      `orang ${p.id} harus muncul tepat satu kali`,
    );
  }
  for (const n of nodes) {
    assert.equal(n.type, "person");
    assert.equal(n.draggable, false);
    assert.ok(n.position && typeof n.position.x === "number" && typeof n.position.y === "number");
  }
});

test("buildTreeGraph memancarkan semua edge orang tua-anak dan pasangan", () => {
  const { nodes, edges } = buildTreeGraph(fixture(), new Set());
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edgeIds = new Set(edges.map((e) => e.id));

  for (const e of CHILD_EDGES) {
    const id = `${e.parentId}->${e.childId}`;
    assert.ok(edgeIds.has(id), `edge ${id} hilang`);
    const edge = edges.find((x) => x.id === id)!;
    assert.ok(nodeIds.has(edge.source), `sumber ${id} bukan node yang dipancarkan`);
    assert.ok(nodeIds.has(edge.target), `tujuan ${id} bukan node yang dipancarkan`);
  }

  assert.ok(edgeIds.has("partner-A05+A06"), "edge pasangan A05+A06 hilang");
  const partnerEdge = edges.find((e) => e.id === "partner-A05+A06")!;
  assert.ok(nodeIds.has(partnerEdge.source) && nodeIds.has(partnerEdge.target));

  // pasangan tetap bersebelahan pada y yang sama
  const a05 = nodes.find((n) => n.id === "A05")!;
  const a06 = nodes.find((n) => n.id === "A06")!;
  assert.equal(a05.position.y, a06.position.y, "pasangan harus sejajar horizontal");
  assert.notEqual(a05.position.x, a06.position.x, "pasangan harus terpisah horizontal");

  assert.equal(ROOT_IDS.includes(getRootId(fixture()) ?? ""), true);
});

test("buildTreeGraph deterministik pada pemanggilan berulang", () => {
  const first = buildTreeGraph(fixture(), new Set());
  const second = buildTreeGraph(fixture(), new Set());

  assert.deepEqual(second.nodes, first.nodes);
  assert.deepEqual(second.edges, first.edges);
});

test("buildTreeGraph menyembunyikan anak saat induknya collapsed", () => {
  const { nodes, edges } = buildTreeGraph(fixture(), new Set(["A01"]));

  const ids = nodes.map((n) => n.id);
  assert.ok(!ids.includes("B1") && !ids.includes("B2"), "anak A01 disembunyikan");
  assert.ok(!edges.some((e) => e.id === "A01->B1"), "edge anak A01 disembunyikan");
  assert.ok(ids.includes("A02"), "induk yang lain tetap tampil");

  const a01 = nodes.find((n) => n.id === "A01")!;
  assert.equal((a01.data as { collapsed: boolean }).collapsed, true);
  assert.equal((a01.data as { hasHiddenChildren: boolean }).hasHiddenChildren, true);
});
