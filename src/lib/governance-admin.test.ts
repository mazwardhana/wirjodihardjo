import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POSITIONS,
  DEFAULT_STRUCTURE_DESCRIPTION,
  DEFAULT_STRUCTURE_NAME,
} from "./governance-admin";

test("susunan jabatan bawaan mengikuti urutan yang diminta", () => {
  assert.deepEqual(
    DEFAULT_POSITIONS.map((p) => p.name),
    [
      "Dewan Pertimbangan",
      "Ketua",
      "Sekretaris",
      "Bendahara",
      "Bidang Teknologi",
      "Bidang Dokumentasi dan Publikasi",
      "Bidang Kreatif dan Kepemudaan",
    ],
  );
});

test("tingkat jabatan menurun dari dewan pertimbangan ke bidang", () => {
  const level = (name: string) =>
    DEFAULT_POSITIONS.find((p) => p.name === name)!.level;
  assert.equal(level("Dewan Pertimbangan"), 0);
  assert.equal(level("Ketua"), 1);
  assert.equal(level("Sekretaris"), 2);
  assert.equal(level("Bendahara"), 3);
  assert.equal(level("Bidang Teknologi"), 4);
  assert.equal(level("Bidang Dokumentasi dan Publikasi"), 4);
  assert.equal(level("Bidang Kreatif dan Kepemudaan"), 4);
});

test("Dewan Pertimbangan menyebut sesepuh pada deskripsinya", () => {
  const pertimbangan = DEFAULT_POSITIONS.find((p) => p.name === "Dewan Pertimbangan")!;
  assert.ok(pertimbangan.description.toLowerCase().includes("sesepuh"));
});

test("nama dan deskripsi struktur bawaan terisi", () => {
  assert.ok(DEFAULT_STRUCTURE_NAME.length > 0);
  assert.ok(DEFAULT_STRUCTURE_DESCRIPTION.length > 0);
});
