import assert from "node:assert/strict";
import test from "node:test";
import {
  computeKinship,
  findLowestCommonAncestor,
  type KinshipContext,
  type KinshipPerson,
} from "./kinship";

function p(
  id: string,
  gender: string,
  birthDate: string | null = null,
  fullName?: string,
): KinshipPerson {
  return { id, fullName: fullName ?? `Orang ${id}`, gender, birthDate };
}

/**
 * Fixture pohon keluarga kecil:
 *
 *   K (kakek) — N (nenek)
 *       |
 *    ┌──┴──┐
 *    A      B — D (istri)
 *    |      |
 *    C      E
 *
 * Relasi yang diuji: orang tua, kakek/nenek, saudara, paman/bibi (Pakdhe/
 * Budhe/Om/Tante), keponakan, sepupu, pasangan, anak angkat, edge tiri,
 * tanpa hubungan, dan LCA langsung.
 */
function baseCtx(): KinshipContext {
  return {
    persons: [
      p("K", "MALE", "1940-01-01", "Kakek Karta"),
      p("N", "FEMALE", "1942-01-01", "Nenek Ningsih"),
      p("A", "MALE", "1965-01-01", "Bapak Andi"),
      p("B", "MALE", "1968-01-01", "Om Budi"),
      p("D", "FEMALE", "1970-01-01", "Ibu Dewi"),
      p("C", "FEMALE", "1990-01-01", "Citra"),
      p("E", "MALE", "1995-01-01", "Eko"),
    ],
    parentEdges: [
      { parentId: "K", childId: "A", isStep: false, isAdopted: false },
      { parentId: "N", childId: "A", isStep: false, isAdopted: false },
      { parentId: "K", childId: "B", isStep: false, isAdopted: false },
      { parentId: "N", childId: "B", isStep: false, isAdopted: false },
      { parentId: "A", childId: "C", isStep: false, isAdopted: false },
      { parentId: "B", childId: "E", isStep: false, isAdopted: false },
      { parentId: "D", childId: "E", isStep: false, isAdopted: false },
    ],
    partnerEdges: [{ partnerAId: "B", partnerBId: "D" }],
  };
}

const find = (ctx: KinshipContext, id: string) =>
  ctx.persons.find((x) => x.id === id)!;

test("orang yang sama → Diri sendiri", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "K"), find(ctx, "K"), ctx)!;
  assert.equal(r.kind, "SELF");
  assert.equal(r.label, "Diri sendiri");
});

test("pasangan → Suami / Istri", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "B"), find(ctx, "D"), ctx)!;
  assert.equal(r.kind, "SPOUSE");
  assert.equal(r.label, "Suami");
  assert.equal(r.reverseLabel, "Istri");
});

test("orang tua laki-laki → Ayah / Anak", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "A"), find(ctx, "C"), ctx)!;
  assert.equal(r.kind, "ANCESTOR");
  assert.equal(r.label, "Ayah");
  assert.equal(r.reverseLabel, "Anak");
});

test("orang tua perempuan → Ibu", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "D"), find(ctx, "E"), ctx)!;
  assert.equal(r.kind, "ANCESTOR");
  assert.equal(r.label, "Ibu");
});

test("kakek → Kakek / Cucu", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "K"), find(ctx, "C"), ctx)!;
  assert.equal(r.kind, "ANCESTOR");
  assert.equal(r.label, "Kakek");
  assert.equal(r.reverseLabel, "Cucu");
});

test("nenek → Nenek", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "N"), find(ctx, "E"), ctx)!;
  assert.equal(r.kind, "ANCESTOR");
  assert.equal(r.label, "Nenek");
});

test("saudara kandung → Kakak / Adik (berdasar tanggal lahir)", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "A"), find(ctx, "B"), ctx)!;
  assert.equal(r.kind, "SIBLING");
  assert.equal(r.label, "Kakak"); // A 1965 < B 1968
  assert.equal(r.reverseLabel, "Adik");
});

test("deskripsi saudara tidak mengulang kata 'saudara kandung'", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "A"), find(ctx, "B"), ctx)!;
  assert.equal((r.description.match(/saudara kandung/gi) ?? []).length, 0);
  assert.match(r.description, /^Bapak Andi adalah kakak dari Om Budi\.$/);
});

test("paman lebih muda dari orang tua → Om", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "B"), find(ctx, "C"), ctx)!;
  assert.equal(r.kind, "UNCLE_AUNT");
  assert.equal(r.label, "Om"); // B 1968 > A 1965
  assert.equal(r.reverseLabel, "Keponakan");
});

test("paman lebih tua dari orang tua → Pakdhe", () => {
  const ctx = baseCtx();
  const ctx2: KinshipContext = {
    ...ctx,
    persons: [...ctx.persons, p("S", "MALE", "1960-01-01", "Pakdhe Sutar")],
    parentEdges: [
      ...ctx.parentEdges,
      { parentId: "K", childId: "S", isStep: false, isAdopted: false },
      { parentId: "N", childId: "S", isStep: false, isAdopted: false },
    ],
  };
  const r = computeKinship(find(ctx2, "S"), find(ctx2, "C"), ctx2)!;
  assert.equal(r.kind, "UNCLE_AUNT");
  assert.equal(r.label, "Pakdhe");
});

test("bibi lebih tua dari orang tua → Budhe", () => {
  const ctx = baseCtx();
  const ctx2: KinshipContext = {
    ...ctx,
    persons: [...ctx.persons, p("T", "FEMALE", "1962-01-01", "Budhe Tuti")],
    parentEdges: [
      ...ctx.parentEdges,
      { parentId: "K", childId: "T", isStep: false, isAdopted: false },
      { parentId: "N", childId: "T", isStep: false, isAdopted: false },
    ],
  };
  const r = computeKinship(find(ctx2, "T"), find(ctx2, "C"), ctx2)!;
  assert.equal(r.label, "Budhe");
});

test("bibi lebih muda dari orang tua → Tante", () => {
  const ctx = baseCtx();
  const ctx2: KinshipContext = {
    ...ctx,
    persons: [...ctx.persons, p("U", "FEMALE", "1972-01-01", "Tante Umi")],
    parentEdges: [
      ...ctx.parentEdges,
      { parentId: "K", childId: "U", isStep: false, isAdopted: false },
      { parentId: "N", childId: "U", isStep: false, isAdopted: false },
    ],
  };
  const r = computeKinship(find(ctx2, "U"), find(ctx2, "C"), ctx2)!;
  assert.equal(r.label, "Tante");
});

test("keponakan (arah balik) → Keponakan / Om", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "C"), find(ctx, "B"), ctx)!;
  assert.equal(r.kind, "NIECE_NEPHEW");
  assert.equal(r.label, "Keponakan");
  assert.equal(r.reverseLabel, "Om");
});

test("sepupu (generasi sama) → Sepupu dua arah", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "C"), find(ctx, "E"), ctx)!;
  assert.equal(r.kind, "COUSIN");
  assert.equal(r.label, "Sepupu");
  assert.equal(r.reverseLabel, "Sepupu");
});

test("deskripsi sepupu menyebut nama leluhur, bukan id mentah", () => {
  const ctx = baseCtx();
  const r = computeKinship(find(ctx, "C"), find(ctx, "E"), ctx)!;
  assert.match(r.description, /berbagi kakek Kakek Karta/);
  // Tidak boleh ada id internal satu huruf di teks yang tampil ke pengguna.
  assert.doesNotMatch(r.description, /\bK\b/);
});

test("tanpa hubungan → null", () => {
  const ctx = baseCtx();
  const ctx2: KinshipContext = {
    ...ctx,
    persons: [...ctx.persons, p("Z", "FEMALE", "1991-01-01", "Orang Luar")],
  };
  assert.equal(computeKinship(find(ctx2, "A"), find(ctx2, "Z"), ctx2), null);
});

test("anak angkat tetap dianggap kerabat", () => {
  const ctx = baseCtx();
  const ctx2: KinshipContext = {
    ...ctx,
    persons: [...ctx.persons, p("X", "MALE", "1992-01-01", "Anak Angkat")],
    parentEdges: [
      ...ctx.parentEdges,
      { parentId: "A", childId: "X", isStep: false, isAdopted: true },
    ],
  };
  const r = computeKinship(find(ctx2, "X"), find(ctx2, "E"), ctx2)!;
  assert.equal(r.kind, "COUSIN");
});

test("edge tiri (isStep) tidak dihitung sebagai relasi darah", () => {
  const ctx = baseCtx();
  const ctx2: KinshipContext = {
    ...ctx,
    persons: [...ctx.persons, p("Y", "MALE", "1993-01-01", "Saudara Tiri")],
    parentEdges: [
      ...ctx.parentEdges,
      { parentId: "A", childId: "Y", isStep: true, isAdopted: false },
    ],
  };
  // Y bukan kerabat darah E (edge tiri dilewati) → null.
  assert.equal(computeKinship(find(ctx2, "Y"), find(ctx2, "E"), ctx2), null);
});

test("LCA: A & B → K, jarak 1/1", () => {
  const ctx = baseCtx();
  const parentsOf = new Map<string, string[]>();
  for (const e of ctx.parentEdges) {
    const arr = parentsOf.get(e.childId) ?? [];
    arr.push(e.parentId);
    parentsOf.set(e.childId, arr);
  }
  const r = findLowestCommonAncestor("A", "B", parentsOf)!;
  assert.equal(r.lca, "K");
  assert.equal(r.distA, 1);
  assert.equal(r.distB, 1);
});

test("LCA: A & C → A, jarak 0/1 (leluhur langsung)", () => {
  const ctx = baseCtx();
  const parentsOf = new Map<string, string[]>();
  for (const e of ctx.parentEdges) {
    const arr = parentsOf.get(e.childId) ?? [];
    arr.push(e.parentId);
    parentsOf.set(e.childId, arr);
  }
  const r = findLowestCommonAncestor("A", "C", parentsOf)!;
  assert.equal(r.lca, "A");
  assert.equal(r.distA, 0);
  assert.equal(r.distB, 1);
});

test("LCA: komponen terpisah → null", () => {
  const parentsOf = new Map<string, string[]>([["x", ["y"]]]);
  assert.equal(findLowestCommonAncestor("x", "z", parentsOf), null);
});
