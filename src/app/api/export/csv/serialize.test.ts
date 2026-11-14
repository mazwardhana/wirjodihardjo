import assert from "node:assert/strict";
import test from "node:test";
import { serializePeopleCsv, CSV_HEADERS, type CsvPerson } from "./serialize";

function fixture(i: number): CsvPerson {
  return {
    fullName: i === 0 ? 'Nama, "Keluarga"\nJawa' : `Anggota ${i}`,
    birthDate: new Date("2000-06-15T00:00:00.000Z"),
    deathDate: null,
    isDeceased: false,
    generationLevel: i % 4,
    parents: i === 1 ? [{ parent: { fullName: "Nama Orang Tua" } }] : [],
    children: [],
    partnershipsA: [],
    partnershipsB: [],
  };
}

const NOW = new Date("2026-11-14T00:00:00.000Z");

test("CSV memuat header yang tepat dan minimal 95 baris data", () => {
  const csv = serializePeopleCsv(Array.from({ length: 100 }, (_, i) => fixture(i)), NOW);
  const lines = csv.replace(/\r\n$/, "").split("\r\n");
  assert.equal(lines[0], CSV_HEADERS.join(","));
  assert.equal(lines[0], "nama,umur,hubungan,usia,kelas");
  assert.equal(lines.length - 1, 100);
  assert.ok(lines.length - 1 >= 95);
});

test("CSV mengutip sel sesuai RFC4180 dan mempertahankan isinya", () => {
  const csv = serializePeopleCsv([fixture(0)], NOW);
  const first = csv.replace(/\r\n$/, "").split("\r\n")[1];
  assert.ok(first.startsWith('"Nama, ""Keluarga""\nJawa"'));
});

test("CSV menuliskan relasi orang tua dan usia", () => {
  const csv = serializePeopleCsv([fixture(1)], NOW);
  const row = csv.replace(/\r\n$/, "").split("\r\n")[1];
  assert.match(row, /Orang tua: Nama Orang Tua/);
  assert.match(row, /26/);
  assert.match(row, /Generasi 1/);
});

test("CSV menandai anggota tanpa data relasi dan tanpa tanggal lahir", () => {
  const csv = serializePeopleCsv(
    [{ fullName: "Tanpa Data", birthDate: null, deathDate: null, isDeceased: false, generationLevel: null, parents: [], children: [], partnershipsA: [], partnershipsB: [] }],
    NOW,
  );
  const row = csv.replace(/\r\n$/, "").split("\r\n")[1];
  assert.match(row, /Tidak tercatat/);
  assert.match(row, /Tidak diketahui/);
  assert.match(row, /Belum ditetapkan/);
});