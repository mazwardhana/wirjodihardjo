import assert from "node:assert/strict";
import test from "node:test";
import {
  PENGURUS_PLACEHOLDER_DESCRIPTION,
  PENGURUS_PLACEHOLDER_NAME,
  buildPengurusPlaceholderData,
} from "./pengurus-placeholder";

test("kerangka kepengurusan mengikuti urutan jabatan yang diminta", () => {
  const data = buildPengurusPlaceholderData([]);
  const names = data.levels.map((level) => level.positions.map((p) => p.name));
  assert.deepEqual(names, [
    ["Dewan Pertimbangan"],
    ["Ketua"],
    ["Sekretaris"],
    ["Bendahara"],
    [
      "Bidang Teknologi",
      "Bidang Dokumentasi dan Publikasi",
      "Bidang Kreatif dan Kepemudaan",
    ],
  ]);
});

test("setiap jabatan placeholder kosong tanpa penugasan", () => {
  const data = buildPengurusPlaceholderData([]);
  for (const level of data.levels) {
    for (const position of level.positions) {
      assert.equal(
        position.assignments.length,
        0,
        `${position.name} harus kosong`,
      );
    }
  }
});

test("cabang keluarga menjadi dewan perwakilan dengan slot kosong", () => {
  const data = buildPengurusPlaceholderData([
    { id: "b1", name: "Cabang Satu", branchNumber: 1 },
    { id: "b2", name: "Cabang Dua", branchNumber: 2 },
  ]);
  assert.equal(data.branches.length, 2);
  assert.equal(data.branches[0].name, "Cabang Satu");
  assert.equal(data.branches[0].branchNumber, 1);
  assert.equal(data.branches[0].slot1, null);
  assert.equal(data.branches[0].slot2, null);
});

test("Dewan Pertimbangan menjelaskan bahwa slotnya untuk para sesepuh", () => {
  const data = buildPengurusPlaceholderData([]);
  const pertimbangan = data.levels
    .flatMap((level) => level.positions)
    .find((p) => p.name === "Dewan Pertimbangan");
  assert.ok(pertimbangan, "Dewan Pertimbangan harus ada");
  assert.ok(
    pertimbangan!.description?.toLowerCase().includes("sesepuh"),
    "deskripsi harus menyebut sesepuh",
  );
});

test("struktur placeholder memakai nama dan deskripsi yang jelas", () => {
  const data = buildPengurusPlaceholderData([]);
  assert.equal(data.structure?.name, PENGURUS_PLACEHOLDER_NAME);
  assert.equal(data.structure?.description, PENGURUS_PLACEHOLDER_DESCRIPTION);
});
