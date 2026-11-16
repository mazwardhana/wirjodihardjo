import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/**
 * Tes moderasi memori oleh admin.
 * Cakupan: autentikasi, penolakan non-admin, pembatasan cabang, daftar
 * moderasi, setujui, tolak wajib alasan, dan hapus berkas fisik.
 */

type Row = Record<string, unknown>;

type State = {
  session: { user: { id: string; role: string } } | null;
  list: Row[];
  memory: Row | null;
  updates: Row[];
  deletes: string[];
  unlinks: string[];
  audit: Row[];
  queries: Row[];
};

function fixture(): State {
  return {
    session: null,
    list: [],
    memory: null,
    updates: [],
    deletes: [],
    unlinks: [],
    audit: [],
    queries: [],
  };
}

type RouteExports = {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
};

function loadRoute(state: State): RouteExports {
  const filename = resolve("src/app/api/admin/memories/route.ts");
  const nodeRequire = createRequire(filename);
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
      module: { exports },
      URL,
      Request,
      Response,
      Buffer,
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/rbac") {
          return {
            requireAdminScope: async (userId: string) => {
              if (!state.session || state.session.user.id !== userId) {
                throw new Error("Tidak terautentikasi");
              }
              const role = state.session.user.role;
              if (role === "SUPER_ADMIN") return { role, branchId: null };
              if (role === "BRANCH_ADMIN") return { role, branchId: "branch-A" };
              throw new Error("Akses admin ditolak");
            },
          };
        }
        if (id === "@/lib/audit") return { logAudit: async (params: Row) => { state.audit.push(params); } };
        if (id === "@/lib/upload") return { UPLOAD_DIR: "/uploads-uji" };
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              personMemory: {
                findMany: async (args: Row) => {
                  state.queries.push(args);
                  return state.list;
                },
                findUnique: async (args: Row) => {
                  state.queries.push(args);
                  return state.memory;
                },
                update: async ({ data }: { data: Row }) => {
                  state.updates.push(data);
                  return { ...state.memory, ...data };
                },
                delete: async ({ where }: { where: { id: string } }) => {
                  state.deletes.push(where.id);
                  return state.memory;
                },
              },
            },
          };
        }
        if (id === "next/server") {
          return {
            NextResponse: {
              json: (payload: unknown, init?: { status?: number }) =>
                new Response(JSON.stringify(payload), {
                  status: init?.status ?? 200,
                  headers: { "Content-Type": "application/json" },
                }),
            },
          };
        }
        if (id === "fs/promises") {
          return { unlink: async (path: string) => { state.unlinks.push(path); } };
        }
        return nodeRequire(id);
      },
    },
    { filename },
  );

  return exports as RouteExports;
}

const memoryRow = (overrides: Partial<Row> = {}): Row => ({
  id: "m1",
  kind: "STORY",
  title: "Kenangan",
  content: "Cerita",
  fileUrl: null,
  thumbnailUrl: null,
  status: "PENDING",
  rejectionReason: null,
  createdAt: new Date("2026-01-01"),
  personId: "p1",
  uploader: { username: "budi", person: { branchId: "branch-A" } },
  person: { id: "p1", fullName: "Budi", branchId: "branch-A" },
  ...overrides,
});

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// Objek yang dibuat di dalam konteks vm punya prototipe berbeda dari objek
// Node (Date pun termasuk), jadi perbandingan struktur dilakukan lewat salinan
// JSON. Pola sama dengan route.test.ts milik admin/reuni/registrations.
function plain<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("GET /api/admin/memories", () => {
  test("401 untuk tamu", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/admin/memories"));
    assert.equal(res.status, 401);
  });

  test("403 untuk anggota biasa", async () => {
    const state = fixture();
    state.session = { user: { id: "u1", role: "MEMBER" } };
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/admin/memories"));
    assert.equal(res.status, 403);
  });

  test("SUPER_ADMIN melihat PENDING dan REJECTED maksimal 30 hari", async () => {
    const state = fixture();
    state.session = { user: { id: "root", role: "SUPER_ADMIN" } };
    state.list = [memoryRow()];
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/admin/memories"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { memories: Row[] };
    assert.equal(body.memories.length, 1);
    const where = (state.queries[0].where ?? {}) as Row;
    const and = where.AND as Row[];
    assert.ok(Array.isArray(and));
    const statusOr = and[0].OR as Row[];
    assert.equal(statusOr[0].status, "PENDING");
    assert.equal(statusOr[1].status, "REJECTED");
    assert.ok(statusOr[1].moderatedAt);
    assert.equal(and.length, 1, "SUPER_ADMIN tidak dibatasi cabang");
  });

  test("BRANCH_ADMIN hanya melihat cabangnya", async () => {
    const state = fixture();
    state.session = { user: { id: "adminA", role: "BRANCH_ADMIN" } };
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/admin/memories"));
    assert.equal(res.status, 200);
    const where = (state.queries[0].where ?? {}) as Row;
    const branchOr = (where.AND as Row[])[1].OR as Row[];
    // Objek where dibuat di dalam konteks vm sehingga prototipenya berbeda
    // dari objek Node; salin lewat JSON agar perbandingan struktur jujur
    // (pola sama dengan route.test.ts milik admin/reuni/registrations).
    assert.deepEqual(plain(branchOr[0]), { uploader: { person: { branchId: "branch-A" } } });
    assert.deepEqual(plain(branchOr[1]), { person: { branchId: "branch-A" } });
  });
});

describe("POST /api/admin/memories", () => {
  test("APPROVE menyetel status dan moderator", async () => {
    const state = fixture();
    state.session = { user: { id: "root", role: "SUPER_ADMIN" } };
    state.memory = memoryRow();
    const route = loadRoute(state);
    const res = await route.POST(jsonRequest({ id: "m1", action: "APPROVE" }));
    assert.equal(res.status, 200);
    assert.equal(state.updates[0].status, "APPROVED");
    assert.equal(state.updates[0].moderatedByUserId, "root");
    // moderatedAt dibuat di realm vm, jadi divalidasi sebagai stempel waktu,
    // bukan lewat instanceof Date milik realm Node.
    const moderatedAt = plain<{ moderatedAt: string }>(state.updates[0]).moderatedAt;
    assert.ok(!Number.isNaN(Date.parse(moderatedAt)));
    assert.equal(state.audit[0].action, "MEMORY_MODERATE");
  });

  test("REJECT tanpa alasan 400 dan tidak menulis", async () => {
    const state = fixture();
    state.session = { user: { id: "root", role: "SUPER_ADMIN" } };
    state.memory = memoryRow();
    const route = loadRoute(state);
    const res = await route.POST(jsonRequest({ id: "m1", action: "REJECT" }));
    assert.equal(res.status, 400);
    assert.equal(state.updates.length, 0);
  });

  test("REJECT dengan alasan tersimpan", async () => {
    const state = fixture();
    state.session = { user: { id: "root", role: "SUPER_ADMIN" } };
    state.memory = memoryRow();
    const route = loadRoute(state);
    const res = await route.POST(jsonRequest({ id: "m1", action: "REJECT", reason: "Bukan anggota keluarga" }));
    assert.equal(res.status, 200);
    assert.equal(state.updates[0].status, "REJECTED");
    assert.equal(state.updates[0].rejectionReason, "Bukan anggota keluarga");
  });

  test("403 BRANCH_ADMIN di luar cabang", async () => {
    const state = fixture();
    state.session = { user: { id: "adminA", role: "BRANCH_ADMIN" } };
    state.memory = memoryRow({ person: { id: "p2", fullName: "Lain", branchId: "branch-B" }, uploader: { username: "x", person: { branchId: "branch-B" } } });
    const route = loadRoute(state);
    const res = await route.POST(jsonRequest({ id: "m1", action: "APPROVE" }));
    assert.equal(res.status, 403);
    assert.equal(state.updates.length, 0);
  });

  test("404 bila memori tidak ada", async () => {
    const state = fixture();
    state.session = { user: { id: "root", role: "SUPER_ADMIN" } };
    const route = loadRoute(state);
    const res = await route.POST(jsonRequest({ id: "hilang", action: "APPROVE" }));
    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/admin/memories", () => {
  test("hapus row dan berkas fisik", async () => {
    const state = fixture();
    state.session = { user: { id: "root", role: "SUPER_ADMIN" } };
    state.memory = memoryRow({ fileUrl: "/api/memory-file/abc.mp3" });
    const route = loadRoute(state);
    const res = await route.DELETE(new Request("http://localhost/api/admin/memories?id=m1"));
    assert.equal(res.status, 200);
    assert.deepEqual(state.deletes, ["m1"]);
    assert.equal(state.unlinks.length, 1);
    assert.ok(state.unlinks[0].endsWith("abc.mp3"));
  });

  test("403 BRANCH_ADMIN di luar cabang tidak menghapus", async () => {
    const state = fixture();
    state.session = { user: { id: "adminA", role: "BRANCH_ADMIN" } };
    state.memory = memoryRow({ person: { id: "p2", fullName: "Lain", branchId: "branch-B" }, uploader: { username: "x", person: { branchId: "branch-B" } } });
    const route = loadRoute(state);
    const res = await route.DELETE(new Request("http://localhost/api/admin/memories?id=m1"));
    assert.equal(res.status, 403);
    assert.equal(state.deletes.length, 0);
    assert.equal(state.unlinks.length, 0);
  });
});
