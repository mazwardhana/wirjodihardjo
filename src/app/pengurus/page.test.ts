import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Position = {
  id: string;
  name: string;
  description: string | null;
  level: number;
  assignments: unknown[];
};

type ChartLevel = { level: number; positions: Position[] };

type BranchSlot = { id: string; person: null; notes: null } | null;

type BranchRow = {
  id: string;
  name: string;
  branchNumber: number;
  slot1: BranchSlot;
  slot2: BranchSlot;
};

type ChartData = {
  structure: { name: string; description: string | null } | null;
  levels: ChartLevel[];
  branches: BranchRow[];
};

type Rendered = {
  type?: unknown;
  props: { data?: ChartData; children?: unknown };
};

type StructureRow = {
  name: string;
  description: string | null;
  positions: Position[];
};

type State = {
  structure: StructureRow | null;
  branches: Array<{ id: string; name: string; branchNumber: number }>;
  branchReps: unknown[];
  expiredReps: unknown[];
};

function fixture(): State {
  return {
    structure: null,
    branches: [
      { id: "b1", name: "Cabang Satu", branchNumber: 1 },
      { id: "b2", name: "Cabang Dua", branchNumber: 2 },
    ],
    branchReps: [],
    expiredReps: [],
  };
}

function loadPage(state: State) {
  const filename = resolve("src/app/pengurus/page.tsx");
  const nativeRequire = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    {
      exports,
      module: { exports },
      require: (id: string) => {
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              governanceStructure: { findFirst: async () => state.structure },
              branch: { findMany: async () => state.branches },
              branchRepresentative: {
                findMany: async (args: { where?: { endDate?: unknown } }) => {
                  const end = args?.where?.endDate;
                  if (end && typeof end === "object" && "lt" in end) {
                    return state.expiredReps;
                  }
                  return state.branchReps;
                },
              },
            },
          };
        }
        if (id === "@/components/governance/OrgChart") {
          return {
            OrgChart: "OrgChart",
          };
        }
        if (id === "@/components/governance/OrgChartMobile") {
          return {
            OrgChartMobile: "OrgChartMobile",
          };
        }
        if (id === "react/jsx-runtime") {
          return {
            jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
            jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
            Fragment: "fragment",
          };
        }
        return nativeRequire(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  return exports.default as () => Promise<Rendered>;
}

function findChild(rendered: Rendered, type: string): Rendered | undefined {
  const children = rendered.props?.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child && child.type === type) return child;
  }
  return undefined;
}

describe("/pengurus placeholder", () => {
  test("tanpa struktur aktif, halaman memakai kerangka jabatan placeholder", async () => {
    const rendered = await loadPage(fixture())();
    const chart = findChild(rendered, "OrgChart");
    assert.ok(chart, "OrgChart harus dirender");

    const data = chart!.props.data!;
    assert.equal(
      data.levels.map((l) => l.positions.map((p) => p.name)).flat()[0],
      "Dewan Pertimbangan",
    );
    assert.ok(
      data.levels.some((l) =>
        l.positions.some((p) => p.name === "Bidang Kreatif dan Kepemudaan"),
      ),
      "bidang kreatif dan kepemudaan harus ada",
    );
    assert.equal(data.branches.length, 2, "dewan perwakilan mengikuti cabang");
    assert.equal(data.branches[0].slot1, null);
  });

  test("dengan struktur aktif, data nyata yang dipakai (bukan placeholder)", async () => {
    const state = fixture();
    state.structure = {
      name: "Kepengurusan 2026",
      description: "Susunan resmi",
      positions: [
        {
          id: "pos-1",
          name: "Ketua",
          description: null,
          level: 0,
          assignments: [],
        },
      ],
    };
    const rendered = await loadPage(state)();
    const chart = findChild(rendered, "OrgChart");
    assert.ok(chart, "OrgChart harus dirender");
    assert.equal(chart!.props.data!.structure!.name, "Kepengurusan 2026");
    assert.equal(chart!.props.data!.levels[0].positions[0].name, "Ketua");
  });
});
