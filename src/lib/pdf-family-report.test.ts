import assert from "node:assert/strict";
import test from "node:test";
import { buildFamilyReportPdf, type FamilyReport } from "./pdf-family-report";

const report: FamilyReport = {
  title: "Arsip Keluarga Wirjodihardjo",
  generatedAt: "2026-11-14T00:00:00.000Z",
  totalPeople: 120,
  parentChildRelations: 84,
  partnerships: 40,
  couples: 35,
  nodes: 120,
};

test("PDF sah: berawal %PDF dan berakhir %%EOF", () => {
  const bytes = buildFamilyReportPdf(report);
  const text = new TextDecoder("latin1").decode(bytes);
  assert.ok(text.startsWith("%PDF-1.4"), "header PDF");
  assert.ok(text.trimEnd().endsWith("%%EOF"), "penutup PDF");
});

test("PDF memuat judul dan angka ringkasan keluarga", () => {
  const bytes = buildFamilyReportPdf(report);
  const text = new TextDecoder("latin1").decode(bytes);
  assert.ok(text.includes("Arsip Keluarga Wirjodihardjo"));
  assert.ok(text.includes("Total orang: 120"));
  assert.ok(text.includes("Relasi orang tua-anak: 84"));
  assert.ok(text.includes("Pasangan tercatat: 40"));
  assert.ok(text.includes("Pasangan menikah: 35"));
  assert.ok(text.includes("Simpul pohon: 120"));
  assert.ok(text.includes("Total relasi: 124"));
});

test("PDF menyiapkan kedua font standar Times", () => {
  const bytes = buildFamilyReportPdf(report);
  const text = new TextDecoder("latin1").decode(bytes);
  assert.ok(text.includes("/BaseFont /Times-Roman"));
  assert.ok(text.includes("/BaseFont /Times-Bold"));
});