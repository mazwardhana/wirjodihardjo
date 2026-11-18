import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/**
 * Tes penyajian berkas memori (/api/memory-file/[...path]).
 * Berkas PersonMemory tidak tercakup penjagaan /api/media (yang hanya
 * mengenali GalleryMedia), jadi route ini wajib menegakkan aturan akses
 * yang sama: APPROVED + person publik untuk tamu, sisanya pemilik atau
 * admin ber-scope. Route asli dimuat dengan batas eksternal yang diganti:
 * auth, prisma, rbac, upload, dan fs.
 */

type Row = Record<string, unknown>;

type State = {
  session: { user: { id: string; role: string } } | null;
  scope: { role: string; branchId: string | null } | null;
  memory: Row | null;
  queries: Row[];
  reads: string[];
};

function fixture(): State {
  return {
    session: null,
    scope: null,
    memory: {
      id: "m1",
      kind: "AUDIO",
      title: "Rekaman",
      content: null,
      fileUrl: "/api/memory-file/abc.mp3",
      thumbnailUrl: null,
      status: "APPROVED",
      uploadedByUserId: "u1",
      person: { isPublicProfile: true, branchId: "branch-A" },
      uploader: { person: { branchId: "branch-A" } },
    },
    queries: [],
    reads: [],
  };
}

type RouteExports = {
  GET: (request: Request, context: { params: Promise<{ path: string[] }> }) => Promise<Response>;
};

function loadRoute(state: State): RouteExports {
  const filename = resolve("src/app/api/memory-file/[...path]/route.ts");
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
            getActorScope: async () => {
              if (!state.scope) throw new Error("Scope tidak tersedia");
              return state.scope;
            },
          };
        }
        if (id === "@/lib/upload") return { UPLOAD_DIR: "/uploads-uji" };
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              personMemory: {
                findFirst: async (args: Row) => {
                  state.queries.push(args);
                  return state.memory;
                },
              },
            },
          };
        }
        if (id === "fs/promises") {
          return {
            readFile: async (path: string) => {
              state.reads.push(path);
              return Buffer.from("isi-berkas");
            },
          };
        }
        return nodeRequire(id);
      },
    },
    { filename },
  );

  return exports as RouteExports;
}

const context = (segments: string[]) => ({ params: Promise.resolve({ path: segments }) });

describe("GET /api/memory-file/[...path]", () => {
  test("404 untuk upaya keluar dari direktori", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/memory-file/sub/abc.mp3"), context(["sub", "abc.mp3"]));
    assert.equal(res.status, 404);
    assert.equal(state.reads.length, 0);
  });

  test("400 untuk ekstensi yang tidak diizinkan", async () => {
    const state = fixture();
    state.memory = { ...state.memory!, fileUrl: "/api/memory-file/abc.exe" };
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/memory-file/abc.exe"), context(["abc.exe"]));
    assert.equal(res.status, 400);
    assert.equal(state.reads.length, 0);
  });

  test("404 bila tidak ada memori dengan berkas itu", async () => {
    const state = fixture();
    state.memory = null;
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/memory-file/hilang.mp3"), context(["hilang.mp3"]));
    assert.equal(res.status, 404);
  });

  test("memori APPROVED di person publik: tamu dapat berkas dengan cache publik", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/memory-file/abc.mp3"), context(["abc.mp3"]));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "audio/mpeg");
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=86400");
    assert.equal(res.headers.get("Content-Disposition"), "inline");
    assert.equal(state.reads[0].endsWith("abc.mp3"), true);
    // Query pencarian memakai akhiran "/<nama>" agar abc.jpg tidak cocok
    // dengan xyzabc.jpg.
    const where = (state.queries[0].where ?? {}) as Row;
    assert.ok(Array.isArray(where.OR));
  });

  test("memori PENDING ditolak untuk tamu", async () => {
    const state = fixture();
    state.memory = { ...state.memory!, status: "PENDING" };
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/memory-file/abc.mp3"), context(["abc.mp3"]));
    assert.equal(res.status, 403);
    assert.equal(state.reads.length, 0);
  });

  test("memori PENDING boleh dilihat pengunggahnya dengan cache privat", async () => {
    const state = fixture();
    state.memory = { ...state.memory!, status: "PENDING" };
    state.session = { user: { id: "u1", role: "MEMBER" } };
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/memory-file/abc.mp3"), context(["abc.mp3"]));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Cache-Control"), "private, max-age=0");
  });

  test("memori PENDING: BRANCH_ADMIN satu cabang boleh, cabang lain ditolak", async () => {
    const state = fixture();
    state.memory = { ...state.memory!, status: "PENDING" };
    state.session = { user: { id: "adminA", role: "BRANCH_ADMIN" } };
    state.scope = { role: "BRANCH_ADMIN", branchId: "branch-A" };
    const route = loadRoute(state);
    const ok = await route.GET(new Request("http://localhost/api/memory-file/abc.mp3"), context(["abc.mp3"]));
    assert.equal(ok.status, 200);

    const stateLain = fixture();
    stateLain.memory = { ...stateLain.memory!, status: "PENDING" };
    stateLain.session = { user: { id: "adminB", role: "BRANCH_ADMIN" } };
    stateLain.scope = { role: "BRANCH_ADMIN", branchId: "branch-B" };
    const routeLain = loadRoute(stateLain);
    const tolak = await routeLain.GET(new Request("http://localhost/api/memory-file/abc.mp3"), context(["abc.mp3"]));
    assert.equal(tolak.status, 403);
  });

  test("person non-publik: tamu ditolak, anggota login boleh", async () => {
    const state = fixture();
    state.memory = { ...state.memory!, person: { isPublicProfile: false, branchId: "branch-A" } };
    const routeTamu = loadRoute(state);
    const tamu = await routeTamu.GET(new Request("http://localhost/api/memory-file/abc.mp3"), context(["abc.mp3"]));
    assert.equal(tamu.status, 403);

    const stateAnggota = fixture();
    stateAnggota.memory = { ...stateAnggota.memory!, person: { isPublicProfile: false, branchId: "branch-A" } };
    stateAnggota.session = { user: { id: "u2", role: "MEMBER" } };
    stateAnggota.scope = { role: "MEMBER", branchId: null };
    const routeAnggota = loadRoute(stateAnggota);
    const anggota = await routeAnggota.GET(new Request("http://localhost/api/memory-file/abc.mp3"), context(["abc.mp3"]));
    assert.equal(anggota.status, 200);
    assert.equal(anggota.headers.get("Cache-Control"), "private, max-age=0");
  });
});
