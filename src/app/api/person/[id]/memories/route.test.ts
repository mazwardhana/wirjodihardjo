import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/**
 * Tes memori per orang (route member).
 * Route asli dimuat dengan hanya batas eksternal yang diganti: auth, prisma,
 * rate-limit, audit, upload, dan fs. Pola sama dengan route.test.ts milik
 * admin/media. Node 20 belum punya mock.module; adapter VM menjaga
 * penggantian tetap di lingkup tes.
 */

type Row = Record<string, unknown>;

type State = {
  session: { user: { id: string; role: string } } | null;
  person: Row | null;
  memories: Row[];
  rateLimitAllowed: boolean;
  rateLimitCalls: { key: string; limit: number; windowMs: number }[];
  queries: Row[];
  writes: Row[];
  files: { name: string; bytes: Buffer }[];
  audit: Row[];
};

function fixture(): State {
  return {
    session: { user: { id: "u1", role: "MEMBER" } },
    person: { id: "p1", isPublicProfile: true, deletedAt: null },
    memories: [],
    rateLimitAllowed: true,
    rateLimitCalls: [],
    queries: [],
    writes: [],
    files: [],
    audit: [],
  };
}

type RouteExports = {
  GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
};

function loadRoute(state: State): RouteExports {
  const filename = resolve("src/app/api/person/[id]/memories/route.ts");
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
      FormData,
      File,
      Blob,
      Buffer,
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/rate-limit") {
          return {
            consumeRateLimit: (key: string, limit: number, windowMs: number) => {
              state.rateLimitCalls.push({ key, limit, windowMs });
              return state.rateLimitAllowed;
            },
          };
        }
        if (id === "@/lib/audit") return { logAudit: async (params: Row) => { state.audit.push(params); } };
        if (id === "@/lib/upload") {
          return {
            UPLOAD_DIR: "/uploads-uji",
            UPLOAD_URL_PREFIX: "/api/media",
            MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
            ACCEPTED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
          };
        }
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              person: {
                // Mock menghormati filter publik agar aturan "tamu hanya
                // person publik" diuji lewat kontrak where, bukan dilewati.
                findFirst: async (args: Row) => {
                  state.queries.push(args);
                  const where = (args.where ?? {}) as Row;
                  if (state.person === null) return null;
                  if (where.isPublicProfile === true && state.person.isPublicProfile !== true) return null;
                  return state.person;
                },
              },
              personMemory: {
                create: async ({ data }: { data: Row }) => {
                  state.writes.push(data);
                  return { id: "mem-1", ...data };
                },
                findMany: async (args: Row) => {
                  state.queries.push(args);
                  return state.memories;
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
          return {
            mkdir: async () => undefined,
            writeFile: async (path: string, bytes: Buffer) => {
              state.files.push({ name: path, bytes });
            },
            unlink: async () => undefined,
          };
        }
        return nodeRequire(id);
      },
    },
    { filename },
  );

  return exports as RouteExports;
}

const context = () => ({ params: Promise.resolve({ id: "p1" }) });

function postForm(fields: Record<string, string | File>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new Request("http://localhost/api/person/p1/memories", { method: "POST", body: form });
}

describe("POST /api/person/[id]/memories", () => {
  test("401 untuk tamu tanpa sesi", async () => {
    const state = fixture();
    state.session = null;
    const route = loadRoute(state);
    const res = await route.POST(postForm({ title: "Kenangan", kind: "STORY", content: "Cerita" }), context());
    assert.equal(res.status, 401);
    assert.equal(state.writes.length, 0);
  });

  test("403 untuk peran di luar anggota", async () => {
    const state = fixture();
    state.session = { user: { id: "u9", role: "TAMU_LUAR" } };
    const route = loadRoute(state);
    const res = await route.POST(postForm({ title: "Kenangan", kind: "STORY", content: "Cerita" }), context());
    assert.equal(res.status, 403);
    assert.equal(state.writes.length, 0);
  });

  test("404 bila person tidak ada", async () => {
    const state = fixture();
    state.person = null;
    const route = loadRoute(state);
    const res = await route.POST(postForm({ title: "Kenangan", kind: "STORY", content: "Cerita" }), context());
    assert.equal(res.status, 404);
    assert.equal(state.writes.length, 0);
  });

  test("201 happy path STORY, row PENDING dan audit tercatat", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const res = await route.POST(postForm({ title: "Kenangan masa kecil", kind: "STORY", content: "Dulu kami bermain di sawah." }), context());
    assert.equal(res.status, 201);
    const body = (await res.json()) as { id: string; status: string };
    assert.equal(body.id, "mem-1");
    assert.equal(body.status, "PENDING");
    const row = state.writes[0];
    assert.equal(row.status, "PENDING");
    assert.equal(row.uploadedByUserId, "u1");
    assert.equal(row.personId, "p1");
    assert.equal(row.kind, "STORY");
    assert.ok(row.fileUrl == null);
    assert.equal(state.audit.length, 1);
    assert.equal(state.audit[0].action, "MEMORY_SUBMIT");
  });

  test("201 happy path berkas audio, ditulis ke disk dengan ekstensi aman", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const file = new File(["audio-data"], "rekaman.mp3", { type: "audio/mpeg" });
    const res = await route.POST(postForm({ title: "Suara beliau", kind: "AUDIO", file }), context());
    assert.equal(res.status, 201);
    assert.equal(state.files.length, 1);
    const row = state.writes[0];
    assert.equal(typeof row.fileUrl, "string");
    assert.ok(String(row.fileUrl).endsWith(".mp3"));
    assert.ok(row.content == null);
  });

  test("400 STORY tanpa content", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const res = await route.POST(postForm({ title: "Kenangan", kind: "STORY" }), context());
    assert.equal(res.status, 400);
    assert.equal(state.writes.length, 0);
  });

  test("400 untuk mime yang tidak diizinkan", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const file = new File(["zip"], "arsip.zip", { type: "application/zip" });
    const res = await route.POST(postForm({ title: "Lampiran", kind: "DOCUMENT", file }), context());
    assert.equal(res.status, 400);
    assert.equal(state.files.length, 0);
    assert.equal(state.writes.length, 0);
  });

  test("400 untuk judul di atas 200 karakter", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const res = await route.POST(postForm({ title: "x".repeat(201), kind: "STORY", content: "Cerita" }), context());
    assert.equal(res.status, 400);
    assert.equal(state.writes.length, 0);
  });

  test("429 bila rate limit habis", async () => {
    const state = fixture();
    state.rateLimitAllowed = false;
    const route = loadRoute(state);
    const res = await route.POST(postForm({ title: "Kenangan", kind: "STORY", content: "Cerita" }), context());
    assert.equal(res.status, 429);
    assert.equal(state.rateLimitCalls[0].key, "memory-upload:u1");
    assert.equal(state.rateLimitCalls[0].limit, 10);
    assert.equal(state.writes.length, 0);
  });
});

describe("GET /api/person/[id]/memories", () => {
  test("tamu hanya meminta APPROVED dan konten dipotong 280 karakter", async () => {
    const state = fixture();
    state.session = null;
    state.memories = [
      {
        id: "m1", kind: "STORY", title: "Cerita panjang", content: "x".repeat(400),
        fileUrl: null, thumbnailUrl: null, status: "APPROVED",
        uploadedByUserId: "u2", createdAt: new Date("2026-01-01"),
      },
    ];
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/person/p1/memories"), context());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { memories: { id: string; status: string; content: string | null }[] };
    assert.equal(body.memories.length, 1);
    const where = (state.queries[1].where ?? {}) as Row;
    assert.equal(where.status, "APPROVED");
    assert.equal(body.memories[0].status, "APPROVED");
    assert.equal(body.memories[0].content?.length, 280);
  });

  test("pemilik melihat miliknya dalam semua status dengan status asli", async () => {
    const state = fixture();
    state.memories = [
      {
        id: "m1", kind: "STORY", title: "Milikku", content: "t".repeat(400),
        fileUrl: null, thumbnailUrl: null, status: "PENDING",
        uploadedByUserId: "u1", createdAt: new Date("2026-01-01"),
      },
    ];
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/person/p1/memories"), context());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { memories: { id: string; status: string; content: string | null }[] };
    assert.equal(body.memories.length, 1);
    assert.equal(body.memories[0].status, "PENDING");
    assert.equal(body.memories[0].content?.length, 400, "anggota tidak dipotong");
    const where = (state.queries[1].where ?? {}) as Row;
    assert.ok(Array.isArray(where.OR), "query anggota memakai OR approved/milik sendiri");
  });

  test("404 untuk tamu pada person non-publik", async () => {
    const state = fixture();
    state.session = null;
    state.person = { id: "p1", isPublicProfile: false, deletedAt: null };
    const route = loadRoute(state);
    const res = await route.GET(new Request("http://localhost/api/person/p1/memories"), context());
    assert.equal(res.status, 404);
  });
});
