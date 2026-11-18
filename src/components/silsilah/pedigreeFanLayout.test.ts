import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPedigreeGraph } from "./pedigreeLayout";
import { buildFanGraph } from "./fanLayout";
import type { PublicPerson } from "@/lib/data";

function person(id: string, gender = "MALE"): PublicPerson {
  return {
    id,
    fullName: `Orang ${id}`,
    nickname: null,
    namaPanggilan: null,
    gender,
    birthDate: null,
    deathDate: null,
    birthPlace: null,
    isDeceased: false,
    bio: null,
    photoUrl: null,
    generationLevel: null,
    isMarriedInto: false,
    branch: null,
    socialLinks: [],
  };
}

// Fokus: E1. Orang tua: E2 (ayah) + E3 (ibu). Kakek-nenek: E4+E5 (pihak
// ayah), E6+E7 (pihak ibu). X1 tak terkoneksi (tidak boleh muncul).
const PERSONS: PublicPerson[] = [
  person("E1"),
  person("E2"),
  person("E3", "FEMALE"),
  person("E4"),
  person("E5", "FEMALE"),
  person("E6"),
  person("E7", "FEMALE"),
  person("X1"),
];

const CHILD_EDGES = [
  { parentId: "E2", childId: "E1", parentRole: "FATHER", isStep: false, isAdopted: false },
  { parentId: "E3", childId: "E1", parentRole: "MOTHER", isStep: false, isAdopted: false },
  { parentId: "E4", childId: "E2", parentRole: "FATHER", isStep: false, isAdopted: false },
  { parentId: "E5", childId: "E2", parentRole: "MOTHER", isStep: false, isAdopted: false },
  { parentId: "E6", childId: "E3", parentRole: "FATHER", isStep: false, isAdopted: false },
  { parentId: "E7", childId: "E3", parentRole: "MOTHER", isStep: false, isAdopted: false },
];

test("pedigree: fokus di (0,0), orang tua di atas (y negatif), urut ayah dulu", () => {
  const g = buildPedigreeGraph("E1", PERSONS, CHILD_EDGES, 4);
  const fokus = g.nodes.find((n) => n.id === "E1")!;
  assert.equal(fokus.x, 0);
  assert.equal(fokus.y, 0);
  assert.equal(fokus.depth, 0);

  // Semua node lain harus di atas fokus (y negatif).
  for (const n of g.nodes.filter((n) => n.depth > 0)) {
    assert.ok(n.y < 0, `${n.id} harus di atas fokus (y negatif)`);
  }

  // Ayah (E2) dan ibu (E3) di depth 1; urutan: FATHER dulu → E2 kiri.
  const d1 = g.nodes.filter((n) => n.depth === 1);
  assert.equal(d1.length, 2);
  const ayah = d1.find((n) => n.id === "E2")!;
  const ibu = d1.find((n) => n.id === "E3")!;
  assert.ok(ayah.x < ibu.x, "ayah (FATHER) harus di kiri ibu (MOTHER)");

  // X1 tak terkoneksi tidak muncul.
  assert.equal(g.nodes.some((n) => n.id === "X1"), false);
});

test("pedigree: kedalaman dibatasi maxDepth", () => {
  const g = buildPedigreeGraph("E1", PERSONS, CHILD_EDGES, 1);
  assert.equal(g.nodes.some((n) => n.depth === 2), false, "depth 2 tidak boleh ada saat maxDepth=1");
  assert.equal(g.nodes.some((n) => n.depth === 1), true);
});

test("pedigree: semua node unik (dedup menikah-ke-dalam)", () => {
  // E4 juga jadi orang tua dari E3 (menikah-ke-dalam).
  const edges = [
    ...CHILD_EDGES,
    { parentId: "E4", childId: "E3", parentRole: "FATHER", isStep: false, isAdopted: false },
  ];
  const g = buildPedigreeGraph("E1", PERSONS, edges, 4);
  const ids = g.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "tidak boleh ada id duplikat");
});

test("fan: 7 generasi = fokus + 6 cincin, node unik, radius cukup besar", () => {
  const g = buildFanGraph("E1", PERSONS, CHILD_EDGES, 6);
  const fokus = g.nodes.find((n) => n.id === "E1")!;
  assert.equal(fokus.depth, 0);

  for (const n of g.nodes) {
    assert.ok(n.depth >= 0 && n.depth <= 6);
  }

  // Node unik.
  const ids = g.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);

  // Radius terluar positif dan cukup besar untuk setidaknya satu cincin.
  assert.ok(g.outerRadius >= 88, "radius terluar harus >= satu jarak cincin");
  assert.ok(g.cx > 0 && g.cy > 0, "pusat fan harus digeser ke kanan-bawah");
});

test("fan: graf kosong bila fokus tidak ada di data", () => {
  const g = buildFanGraph("ZZZ", PERSONS, CHILD_EDGES, 6);
  assert.equal(g.nodes.length, 0);
});

test("pedigree: graf kosong bila fokus tidak ada di data", () => {
  const g = buildPedigreeGraph("ZZZ", PERSONS, CHILD_EDGES, 4);
  assert.equal(g.nodes.length, 0);
});