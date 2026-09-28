import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { test } from "node:test";

export type Row = Record<string, unknown>;
export function fixture() {
  const state = {
    session: { user: { id: "u1", role: "MEMBER" } } as { user: { id: string; role: string } } | null,
    user: { personId: "p1" } as { personId: string; id?: string; mustChangeCredentials?: boolean } | null,
    existing: { id: "r1", personId: "p1" } as Row | null,
    writes: [] as Row[],
    queries: [] as Row[],
    platform: { id: "11111111-1111-4111-8111-111111111111", name: "GitHub", baseUrl: "https://github.com" } as Row | null,
  };
  const model = {
    findMany: async (args: Row) => { state.queries.push(args); return [state.existing]; },
    findUnique: async () => state.existing,
    create: async (args: { data: Row }) => { state.writes.push(args.data); return { id: "r1", ...args.data }; },
    update: async (args: { data: Row }) => { state.writes.push(args.data); return { ...state.existing, ...args.data }; },
    delete: async () => { state.writes.push({ deleted: true }); return state.existing; },
    upsert: async (args: Row) => { state.writes.push(args); return args; },
  };
  const prisma = {
    user: {
      findUnique: async () => state.user,
      update: async (args: { data: Row }) => { state.writes.push(args.data); return { ...state.user, ...args.data }; },
    },
    education: model, socialLink: model, person: model, personPrivate: model,
    socialPlatform: { findUnique: async () => state.platform },
    auditLog: { create: async (args: Row) => { state.writes.push(args); return args; } },
  };
  // Rute memanggil `prisma.$transaction(async (tx) => ...)`. Mock mengeksekusi
  // callback dengan objek prisma yang sama sehingga semua tulisan tetap terekam.
  Object.assign(prisma, {
    $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  });
  return { state, prisma };
}

// Load real route source with only authentication and persistence replaced.
// Node 20 does not support mock.module; keep this adapter confined to tests.
export function loadRoute(path: string, f: ReturnType<typeof fixture>) {
  const filename = resolve(path);
  const require = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports: Record<string, (request: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>> = {};
  runInNewContext(output, {
    exports, URL, Request, Response,
    require: (id: string) => id === "@/lib/auth" ? { auth: async () => f.state.session }
      : id === "@/lib/prisma" ? { prisma: f.prisma } : require(id),
  }, { filename });
  return exports;
}

export const context = () => ({ params: Promise.resolve({ id: "r1" }) });
export const request = (method: string, body?: unknown) => new Request("http://localhost/api/profil", {
  method, ...(body !== undefined && { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
});

export function crudTests(kind: "education" | "social", valid: Row, invalid: Row[]) {
  const base = `src/app/api/profil/${kind}`;
  for (const method of ["GET", "POST", "PUT", "DELETE"]) {
    test(`${method} rejects unauthenticated requests without writes`, async () => {
      const f = fixture(); f.state.session = null;
      const route = loadRoute(`${base}/${["PUT", "DELETE"].includes(method) ? "[id]/" : ""}route.ts`, f);
      assert.equal((await route[method](request(method, method === "GET" ? undefined : valid), context())).status, 401);
      assert.equal(f.state.writes.length, 0);
    });
  }
  test("GET filters by resolved account personId", async () => {
    const f = fixture(); const route = loadRoute(`${base}/route.ts`, f);
    const response = await route.GET(request("GET"), context());
    assert.equal(response.status, 200);
    assert.equal((f.state.queries[0].where as Row).personId, "p1");
    assert.ok(await response.json());
  });
  test("POST binds ownership to account, not body", async () => {
    const f = fixture(); const route = loadRoute(`${base}/route.ts`, f);
    const response = await route.POST(request("POST", { ...valid, personId: "p2" }), context());
    assert.equal(response.status, 201);
    assert.equal(f.state.writes[0].personId, "p1");
  });
  for (const method of ["POST", "PUT"]) {
    for (const body of invalid) test(`${method} rejects ${JSON.stringify(body)}`, async () => {
      const f = fixture(); const route = loadRoute(`${base}/${method === "PUT" ? "[id]/" : ""}route.ts`, f);
      assert.equal((await route[method](request(method, { ...valid, ...body }), context())).status, 400);
      assert.equal(f.state.writes.length, 0);
    });
    test(`${method} returns 400 for malformed JSON`, async () => {
      const f = fixture(); const route = loadRoute(`${base}/${method === "PUT" ? "[id]/" : ""}route.ts`, f);
      const response = await route[method](new Request("http://localhost", { method, body: "{", headers: { "Content-Type": "application/json" } }), context());
      assert.equal(response.status, 400);
      assert.equal(f.state.writes.length, 0);
    });
  }
  for (const method of ["PUT", "DELETE"]) {
    for (const [existing, status] of [[null, 404], [{ id: "r1", personId: "p2" }, 403]] as const) {
      test(`${method} returns ${status} without writes`, async () => {
        const f = fixture(); f.state.existing = existing;
        const route = loadRoute(`${base}/[id]/route.ts`, f);
        assert.equal((await route[method](request(method, valid), context())).status, status);
        assert.equal(f.state.writes.length, 0);
      });
    }
    test(`${method} succeeds for own record and audits`, async () => {
      const f = fixture(); const route = loadRoute(`${base}/[id]/route.ts`, f);
      assert.equal((await route[method](request(method, valid), context())).status, 200);
      assert.equal(f.state.writes.length, 2);
      assert.equal((f.state.writes[1].data as Row).actorUserId, "u1");
    });
  }
}
