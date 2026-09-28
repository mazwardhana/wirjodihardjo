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
