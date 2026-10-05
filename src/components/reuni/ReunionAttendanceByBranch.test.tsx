import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

/* Tabel rekap kehadiran adalah komponen server murni: angka sudah dihitung di
   `statistik.ts`, jadi yang diuji benar-benar HTML yang dirender. Pola muat
   lewat transpile + vm mengikuti `MemberRegistry.test.tsx`. */

const COMPONENT_FILE = resolve("src/components/reuni/ReunionAttendanceByBranch.tsx");

function transpile(filename: string): string {
  return ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}

type BranchRow = {
  branchId: string | null;
  branchName: string;
  branchNumber: number | null;
  attending: number;
};

function loadComponent() {
  const nativeRequire = createRequire(COMPONENT_FILE);
  const exports: Record<string, unknown> = {};
  runInNewContext(
    transpile(COMPONENT_FILE),
    {
      exports,
      // `@/lib/statistik` hanya bring type: yang diuji bukan runtime-nya.
      require: (id: string) =>
        id === "@/lib/statistik" ? {} : nativeRequire(id),
    },
    { filename: COMPONENT_FILE },
  );
  return exports as {
    ReunionAttendanceByBranch: (props: {
      attendanceByBranch: { rows: BranchRow[]; total: number };
    }) => React.ReactElement;
  };
}

const component = loadComponent();

function render(rows: BranchRow[], total?: number): string {
  return renderToStaticMarkup(
    React.createElement(component.ReunionAttendanceByBranch, {
      attendanceByBranch: {
        rows,
        total: total ?? rows.reduce((sum, r) => sum + r.attending, 0),
      },
    }),
  );
}

const BRANCHES: BranchRow[] = [
  { branchId: "b1", branchName: "Keluarga Soedjinah", branchNumber: 1, attending: 12 },
  { branchId: "b2", branchName: "Keluarga Suwito", branchNumber: 2, attending: 3 },
];

test("kepala tabel memuat kolom keluarga cabang dan hadir", () => {
  const html = render(BRANCHES);
  assert.ok(html.includes("Keluarga cabang"));
  assert.ok(html.includes("Hadir"));
  assert.ok(html.includes('scope="col"'), "kepala kolom memakai scope");
  assert.ok(html.includes('scope="row"'), "nama cabang memakai scope row");
  assert.ok(html.includes("<caption"), "tabel punya caption");
  assert.ok(html.includes("sr-only"), "caption disembunyikan secara visual");
});

test("setiap cabang tampil dengan angka hadirnya", () => {
  const html = render(BRANCHES);
  assert.ok(html.includes("Keluarga Soedjinah") && html.includes("12"));
  assert.ok(html.includes("Keluarga Suwito") && html.includes(">3<"));
  assert.ok(html.includes("tabular-nums"), "angka memakai tabular-nums");
});

test("baris total menjumlahkan seluruh cabang", () => {
  const html = render(BRANCHES, 15);
  assert.ok(html.includes("Total"));
  assert.ok(html.includes(">15<"), "total Dirender");
});

test("nomor cabang ditampilkan sebagai penomoran daftar", () => {
  const html = render(BRANCHES);
  assert.ok(html.includes(">1.<"), "cabang pertama diberi nomor 1");
  assert.ok(html.includes(">2.<"), "cabang kedua diberi nomor 2");
});

test("baris tanpa cabang ditulis belum ditugaskan dan tanpa nomor", () => {
  const html = render([
    ...BRANCHES,
    { branchId: null, branchName: "Belum ditugaskan", branchNumber: null, attending: 2 },
  ]);
  assert.ok(html.includes("Belum ditugaskan"));
  const unassignedCell = html.slice(html.indexOf("Belum ditugaskan"));
  assert.ok(!/unassigned/gi.test(unassignedCell), "baris ini bukan placeholder internal");
});

test("tanpa cabang, tampilkan keadaan kosong yang jujur", () => {
  const html = render([]);
  assert.ok(html.includes("rekap kehadiran belum bisa disusun"));
  assert.ok(!html.includes("<table"), "tidak ada tabel kosong tanpa isi");
});

test("cabang tanpa peserta tetap tampil dengan angka nol", () => {
  const html = render([{ branchId: "b1", branchName: "Keluarga Suwito", branchNumber: 1, attending: 0 }]);
  assert.ok(html.includes("Keluarga Suwito"));
  assert.ok(html.includes(">0<"));
});