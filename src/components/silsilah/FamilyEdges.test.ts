import assert from "node:assert/strict";
import test from "node:test";
import { familyChildPath } from "./FamilyEdges";

/** Ambil semua koordinat y dari path SVG. */
function ys(path: string): number[] {
  return [...path.matchAll(/[MLQ]\s+(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) =>
    Number(m[2]),
  );
}

test("familyChildPath menggambar garis lurus saat anak tepat di bawah asal", () => {
  const path = familyChildPath(100, 200, 260, 100, 300);
  assert.equal(path, "M 100 200 L 100 300");
});

test("familyChildPath melewati bus pada busY saat anak bergeser", () => {
  const path = familyChildPath(100, 200, 260, 400, 300);
  assert.ok(ys(path).includes(260), `path harus menyentuh busY=260: ${path}`);
  // Mulai dari asal, berakhir di atas kartu anak.
  assert.ok(path.startsWith("M 100 200"), `awal path salah: ${path}`);
  assert.ok(path.endsWith("L 400 300"), `akhir path salah: ${path}`);
});

test("familyChildPath punya dua sudut membulat untuk anak bergeser", () => {
  const path = familyChildPath(100, 200, 260, 400, 300);
  assert.equal(
    (path.match(/Q/g) ?? []).length,
    2,
    `harus ada dua sudut membulat: ${path}`,
  );
});

test("familyChildPath tetap valid saat jarak sangat sempit", () => {
  // busY nyaris menyentuh asal dan tujuan: jari-jari harus mengecil, bukan
  // menghasilkan koordinat terbalik.
  const path = familyChildPath(100, 200, 201, 101, 202);
  assert.ok(!path.includes("NaN"), `tidak boleh ada NaN: ${path}`);
  const coords = ys(path);
  assert.ok(coords.every((y) => Number.isFinite(y)), `y harus berhingga: ${path}`);
});
