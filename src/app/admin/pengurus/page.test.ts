import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Row = Record<string, unknown>;

type State = {
  session: { user: { id: string } } | null;
  role: "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER" | null;
  structures: Row[];
  branches: Row[];
  representatives: Row[];
};

function fixture(): State {
  return {
    session: { user: { id: "u1" } },
    role: "SUPER_ADMIN",
    structures: [],
    branches: [{ id: "b1", name: "Cabang Satu", branchNumber: 1 }],
    representatives: [],
  };
}

function loadPage(state: State) {
  const filename = resolve("src/app/admin/pengurus/page.tsx");
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
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              user: {
                findUnique: async () => (state.role ? { role: state.role } : null),
              },
              governanceStructure: { findMany: async () => state.structures },
              branch: { findMany: async () => state.branches },
              branchRepresentative: { findMany: async () => state.representatives },
            },
          };
        }
        if (id === "next/navigation") {
          return {
            redirect: (path: string) => {
              throw new Error(`REDIRECT:${path}`);
            },
          };
        }
        if (id === "./PengurusAdmin") {
          return { PengurusAdmin: (props: Row) => ({ type: "admin", props }) };
        }
        if (id === "react/jsx-runtime") {
          return {
            jsx: (type: unknown, props: Row) => ({ type, props }),
            jsxs: (type: unknown, props: Row) => ({ type, props }),
            Fragment: "fragment",
          };
        }
        return nativeRequire(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  return exports.default as () => Promise<Row>;
}

function adminProps(rendered: Row): Row {
  const children = (rendered.props as Row).children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child && typeof (child as Row).type === "function") {
      return (child as Row).props as Row;
    }
  }
  throw new Error("PengurusAdmin tidak dirender");
}

describe("/admin/pengurus gate", () => {
  test("SUPER_ADMIN melihat data struktur, cabang, dan perwakilan", async () => {
    const state = fixture();
    state.structures = [
      {
        id: "s1",
        name: "Kepengurusan 2026",
        description: "Susunan resmi",
        isActive: true,
        startDate: new Date("2026-01-01"),
        endDate: null,
        positions: [
          {
            id: "p1",
            name: "Ketua",
            description: null,
            level: 0,
            capacity: null,
            assignments: [
              {
                id: "a1",
                startDate: new Date("2026-01-01"),
                endDate: null,
                notes: null,
                person: { id: "x1", fullName: "Budi", branch: { name: "Cabang Satu", branchNumber: 1 } },
                branch: null,
              },
            ],
          },
        ],
      },
    ];
    state.representatives = [
      {
        id: "r1",
        branchId: "b1",
        slot: 1,
        person: { id: "x2", fullName: "Siti", branch: { name: "Cabang Satu", branchNumber: 1 } },
      },
    ];

    const rendered = await loadPage(state)();
    const props = adminProps(rendered);
    const structures = props.structures as Row[];
    assert.equal(structures.length, 1);
    assert.equal(structures[0].name, "Kepengurusan 2026");
    assert.equal((structures[0].positions as Row[])[0].name, "Ketua");
    assert.equal(
      (((structures[0].positions as Row[])[0].assignments as Row[])[0].person as Row).fullName,
      "Budi",
    );
    assert.equal((props.branches as Row[]).length, 1);
    assert.equal(((props.representatives as Row[])[0].person as Row).fullName, "Siti");
  });

  test("BRANCH_ADMIN dialihkan keluar dari halaman kepengurusan", async () => {
    const state = fixture();
    state.role = "BRANCH_ADMIN";
    await assert.rejects(loadPage(state)(), /REDIRECT:\/dashboard/);
  });

  test("tanpa sesi dialihkan ke login", async () => {
    const state = fixture();
    state.session = null;
    await assert.rejects(loadPage(state)(), /REDIRECT:\/login/);
  });
});
