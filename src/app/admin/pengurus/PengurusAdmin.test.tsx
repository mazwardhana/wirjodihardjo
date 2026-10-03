import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const filename = resolve("src/app/admin/pengurus/PengurusAdmin.tsx");
const nativeRequire = createRequire(filename);

type Structure = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  positions: Array<{
    id: string;
    name: string;
    description: string | null;
    level: number;
    capacity: number | null;
    assignments: Array<{
      id: string;
      startDate: string;
      endDate: string | null;
      notes: string | null;
      person: {
        id: string;
        fullName: string;
        branchName: string | null;
        branchNumber: number | null;
      };
    }>;
  }>;
};

function render(props: {
  structures: Structure[];
  branches: Array<{ id: string; name: string; branchNumber: number }>;
  representatives: Array<{
    id: string;
    branchId: string;
    slot: number;
    person: { id: string; fullName: string; branchName: string | null; branchNumber: number | null };
  }>;
}): string {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "next/navigation") return { useRouter: () => ({ refresh: () => {} }) };
        if (id === "@/components/ui/Toast") return { toast: () => {} };
        if (id === "@/components/ui/ConfirmDialog")
          return { ConfirmDialog: () => null };
        return nativeRequire(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  const Component = exports.PengurusAdmin as (p: typeof props) => React.ReactNode;
  return renderToStaticMarkup(React.createElement(Component, props));
}

function activeStructure(): Structure {
  return {
    id: "s1",
    name: "Kepengurusan 2026",
    description: "Susunan resmi",
    isActive: true,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: null,
    positions: [
      {
        id: "p1",
        name: "Dewan Pertimbangan",
        description: "Diisi para sesepuh.",
        level: 0,
        capacity: null,
        assignments: [],
      },
      {
        id: "p2",
        name: "Ketua",
        description: null,
        level: 1,
        capacity: null,
        assignments: [
          {
            id: "a1",
            startDate: "2026-01-01T00:00:00.000Z",
            endDate: null,
            notes: null,
            person: { id: "x1", fullName: "Budi Santoso", branchName: "Cabang Satu", branchNumber: 1 },
          },
        ],
      },
    ],
  };
}

test("tanpa struktur, tampil ajakan membuat struktur bawaan", () => {
  const html = render({ structures: [], branches: [], representatives: [] });
  assert.ok(html.includes("Belum ada struktur kepengurusan"));
  assert.ok(html.includes("Buat struktur kepengurusan"));
});

test("dengan struktur, jabatan, dan pengurus dirender", () => {
  const html = render({
    structures: [activeStructure()],
    branches: [{ id: "b1", name: "Cabang Satu", branchNumber: 1 }],
    representatives: [
      {
        id: "r1",
        branchId: "b1",
        slot: 1,
        person: { id: "x2", fullName: "Siti Aminah", branchName: "Cabang Satu", branchNumber: 1 },
      },
    ],
  });
  assert.ok(html.includes("Kepengurusan 2026"));
  assert.ok(html.includes("Dewan Pertimbangan"));
  assert.ok(html.includes("Ketua"));
  assert.ok(html.includes("Budi Santoso"), "pengurus yang sudah ditetapkan tampil");
  assert.ok(html.includes("Tambah pengurus"));
  assert.ok(html.includes("Dewan Perwakilan Keluarga Cabang"));
  assert.ok(html.includes("Siti Aminah"), "perwakilan cabang tampil");
});
