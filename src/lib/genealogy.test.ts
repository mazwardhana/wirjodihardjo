import assert from "node:assert/strict";
import test from "node:test";
import { computeGenerationLevels } from "./generation-levels";

function run(
  personIds: string[],
  edges: Array<{ parentId: string; childId: string }> = [],
  branchRootIds: string[] = [],
) {
  return computeGenerationLevels({ personIds, edges, branchRootIds });
}

test("rantai kakek-anak-cucu mendapat level 0, 1, 2", () => {
  const levels = run(
    ["a", "b", "c"],
    [
      { parentId: "a", childId: "b" },
      { parentId: "b", childId: "c" },
    ],
  );
  assert.equal(levels.get("a"), 0);
  assert.equal(levels.get("b"), 1);
  assert.equal(levels.get("c"), 2);
});

test("akar cabang tanpa leluhur mendapat 1 dan anaknya 2", () => {
  const levels = run(
    ["akar", "anak"],
    [{ parentId: "akar", childId: "anak" }],
    ["akar"],
  );
  assert.equal(levels.get("akar"), 1);
  assert.equal(levels.get("anak"), 2);
});

test("pendiri yang punya anak tetapi bukan akar cabang tetap 0", () => {
  const levels = run(
    ["pendiri", "anak"],
    [{ parentId: "pendiri", childId: "anak" }],
  );
  assert.equal(levels.get("pendiri"), 0);
  assert.equal(levels.get("anak"), 1);
});

test("orang tanpa relasi sama sekali mendapat null", () => {
  const levels = run(["yayat"]);
  assert.equal(levels.get("yayat"), null);
});

test("relasi yang hilang mengembalikan level, termasuk kembali null", () => {
  const withEdge = run(["yayat", "anak"], [{ parentId: "yayat", childId: "anak" }]);
  assert.equal(withEdge.get("yayat"), 0);
  assert.equal(withEdge.get("anak"), 1);

  const withoutEdge = run(["yayat", "anak"]);
  assert.equal(withoutEdge.get("yayat"), null);
  assert.equal(withoutEdge.get("anak"), null);
});

test("anak dari dua orang tua berbeda tingkat memakai level maksimum", () => {
  const levels = run(
    ["a", "b", "c", "d", "e"],
    [
      { parentId: "a", childId: "b" },
      { parentId: "b", childId: "c" },
      { parentId: "a", childId: "d" },
      { parentId: "c", childId: "e" },
      { parentId: "d", childId: "e" },
    ],
  );
  assert.equal(levels.get("c"), 2);
  assert.equal(levels.get("d"), 1);
  assert.equal(levels.get("e"), 3);
});

test("siklus tidak menggantung dan anggotanya mendapat null", () => {
  const levels = run(
    ["x", "y", "z"],
    [
      { parentId: "x", childId: "y" },
      { parentId: "y", childId: "x" },
      { parentId: "x", childId: "z" },
    ],
  );
  assert.equal(levels.get("x"), null);
  assert.equal(levels.get("y"), null);
  assert.equal(levels.get("z"), null);
});

test("edge yang menunjuk node di luar daftar diabaikan", () => {
  const levels = run(["a"], [{ parentId: "luar", childId: "a" }]);
  assert.equal(levels.get("a"), null);
});

test("leluhur baru di atas anak yang dalam mendapat level tepat di bawah anak", () => {
  // `p` adalah orang tua kedua `f` yang baru dibuat dan tidak punya orang tua.
  const levels = run(
    ["pendiri", "g1", "g2", "g3", "g4", "f", "p"],
    [
      { parentId: "pendiri", childId: "g1" },
      { parentId: "g1", childId: "g2" },
      { parentId: "g2", childId: "g3" },
      { parentId: "g3", childId: "g4" },
      { parentId: "g4", childId: "f" },
      { parentId: "p", childId: "f" },
    ],
  );
  assert.equal(levels.get("pendiri"), 0);
  assert.equal(levels.get("g4"), 4);
  assert.equal(levels.get("f"), 5);
  assert.equal(levels.get("p"), 4);
});

test("pasangan pendiri tetap 0 meski keduanya tanpa orang tua", () => {
  const levels = run(
    ["pendiri1", "pendiri2", "anak"],
    [
      { parentId: "pendiri1", childId: "anak" },
      { parentId: "pendiri2", childId: "anak" },
    ],
  );
  assert.equal(levels.get("pendiri1"), 0);
  assert.equal(levels.get("pendiri2"), 0);
  assert.equal(levels.get("anak"), 1);
});

test("leluhur dengan anak di dua tingkat memakai anak paling rendah", () => {
  // Bila memakai max, `x` akan menjadi 1 dan menyamai anaknya `a` (salah).
  const levels = run(
    ["x", "a", "b", "c"],
    [
      { parentId: "x", childId: "a" },
      { parentId: "x", childId: "b" },
      { parentId: "a", childId: "b" },
      { parentId: "b", childId: "c" },
    ],
  );
  assert.equal(levels.get("x"), 0);
  assert.equal(levels.get("a"), 1);
  assert.equal(levels.get("b"), 2);
  assert.equal(levels.get("c"), 3);
});

test("akar cabang tanpa anak tetap 1", () => {
  const levels = run(["akar"], [], ["akar"]);
  assert.equal(levels.get("akar"), 1);
});
