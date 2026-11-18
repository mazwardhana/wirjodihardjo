import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";

type Session = { user: { id: string } } | null;

function loadRoute(state: { session: Session; people: unknown[] }) {
  const filename = resolve("src/app/api/export/csv/route.ts");
  const nativeRequire = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    {
      exports,
      URL,
      Request,
      Response,
      console,
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              user: { findUnique: async () => ({ isActive: true }) },
              person: { findMany: async () => state.people },
            },
          };
        }
        if (id === "./serialize") {
          const mod: Record<string, unknown> = {};
          runInNewContext(
            ts.transpileModule(readFileSync(resolve("src/app/api/export/csv/serialize.ts"), "utf8"), {
              compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
            }).outputText,
            { exports: mod, module: { exports: mod }, require: nativeRequire },
            { filename: resolve("src/app/api/export/csv/serialize.ts") },
          );
          return mod;
        }
        return nativeRequire(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );
  return exports.GET as () => Promise<Response>;
}

function person(i: number) {
  return {
    fullName: `Anggota ${i}`,
    birthDate: new Date("1985-05-10T00:00:00.000Z"),
    deathDate: null,
    isDeceased: false,
    generationLevel: i % 5,
    parents: [],
    children: [],
    partnershipsA: [],
    partnershipsB: [],
  };
}

test("GET /api/export/csv menolak tamu (401)", async () => {
  const get = loadRoute({ session: null, people: [] });
  const res = await get();
  assert.equal(res.status, 401);
});

test("GET /api/export/csv mengembalikan CSV nyata >=95 baris utk anggota aktif", async () => {
  const people = Array.from({ length: 109 }, (_, i) => person(i));
  const get = loadRoute({ session: { user: { id: "u1" } }, people });
  const res = await get();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^text\/csv/);
  const text = await res.text();
  const lines = text.replace(/\r\n$/, "").split("\r\n");
  assert.equal(lines[0], "nama,umur,hubungan,usia,kelas");
  assert.ok(lines.length - 1 >= 95, "minimal 95 baris data");
  assert.equal(lines.length - 1, 109);
});