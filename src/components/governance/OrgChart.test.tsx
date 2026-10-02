import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { OrgChartData } from "./OrgChart";

const filename = resolve("src/components/governance/OrgChart.tsx");
const require = createRequire(filename);

function render(data: OrgChartData): string {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: { OrgChart?: (props: { data: OrgChartData }) => React.ReactNode } = {};
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "next/link") {
          return {
            __esModule: true,
            default: (props: Record<string, unknown>) =>
              React.createElement(
                "a",
                { href: props.href },
                props.children as React.ReactNode,
              ),
          };
        }
        if (id === "@/components/ui/Avatar") {
          return {
            Avatar: (props: { name?: string }) =>
              React.createElement("span", null, props.name ?? ""),
          };
        }
        return require(id);
      },
    },
    { filename },
  );

  return renderToStaticMarkup(
    React.createElement(exports.OrgChart!, { data }) as React.ReactElement,
  );
}

function data(): OrgChartData {
  return {
    structure: { name: "Kepengurusan", description: null },
    levels: [
      {
        level: 0,
        positions: [
          { id: "p1", name: "Ketua", description: null, assignments: [] },
        ],
      },
    ],
    branches: [
      { id: "b1", name: "Cabang Satu", branchNumber: 1, slot1: null, slot2: null },
    ],
  };
}

test("bagian perwakilan cabang berjudul Dewan Perwakilan Keluarga Cabang", () => {
  const html = render(data());
  assert.ok(
    html.includes("Dewan Perwakilan Keluarga Cabang"),
    "judul dewan perwakilan harus tampil",
  );
});

test("deskripsi jabatan ditampilkan pada bagan", () => {
  const withDescription = data();
  withDescription.levels[0].positions[0].description = "Diisi para sesepuh keluarga.";
  const html = render(withDescription);
  assert.ok(html.includes("Diisi para sesepuh keluarga."), "deskripsi jabatan harus tampil");
});
