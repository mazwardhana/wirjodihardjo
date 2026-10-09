import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createRateLimiter } from "@/lib/rate-limit";

type Handler = (request: Request) => Promise<Response>;

const filename = resolve("src/app/api/reuni/buku-tamu/lookup/route.ts");
const nativeRequire = createRequire(filename);

type LookupParams = { reunionId: string; branchId: string; q: string };

// Muat route asli dengan prisma dan modul buku-tamu diganti mock.
// Pembatas laju memakai algoritma asli lewat instance terpisah agar tes tidak
// saling memengaruhi state singleton.
function loadRoute(fixture: {
  state: { reunion: { id: string } | null; rows: unknown[]; throwMessage: string | null; lastLookup: LookupParams | null };
  limiter: { consume(key: string, limit: number, windowMs: number): boolean };
}) {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: Record<string, unknown> = {};
  const requireMap = (id: string) => {
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
    if (id === "@/lib/prisma") {
      return {
        prisma: {
          reunion: {
            findUnique: async () => fixture.state.reunion,
          },
        },
      };
    }
    if (id === "@/lib/registrasi") return { REUNI_2027_SLUG: "reuni-uji" };
    if (id === "@/lib/rate-limit") return { consumeRateLimit: fixture.limiter.consume };
    if (id === "@/lib/buku-tamu") {
      return {
        MIN_QUERY_LENGTH: 2,
        lookupCandidates: async (_db: unknown, params: LookupParams) => {
          fixture.state.lastLookup = params;
          if (fixture.state.throwMessage) throw new Error(fixture.state.throwMessage);
          return fixture.state.rows;
        },
      };
    }
    return nativeRequire(id);
  };

  runInNewContext(
    output,
    // Route memakai `error instanceof Error`; samakan realm Error agar mock
    // yang dilempar dari host tetap lolos pemeriksaan.
    { exports, Error, URL, Request, Response, console, require: requireMap },
    { filename },
  );
  return exports.GET as Handler;
}

function makeFixture() {
  const state = {
    reunion: { id: "r-1" } as { id: string } | null,
    rows: [] as unknown[],
    throwMessage: null as string | null,
    lastLookup: null as LookupParams | null,
  };
  const limiter = createRateLimiter();
  const GET = loadRoute({ state, limiter });
  return { GET, state };
}

function getRequest(query: string, headers?: Record<string, string>) {
  return new Request(`http://x/api/reuni/buku-tamu/lookup?${query}`, { headers });
}

test("lookup menolak kata kunci satu huruf", async () => {
  const { GET, state } = makeFixture();
  const res = await GET(getRequest("q=a&branchId=b1"));
  assert.equal(res.status, 400);
  assert.equal(state.lastLookup, null, "DB tidak boleh disentuh");
});

test("lookup menolak tanpa branchId", async () => {
  const { GET, state } = makeFixture();
  const res = await GET(getRequest("q=wi"));
  assert.equal(res.status, 400);
  assert.equal(state.lastLookup, null, "DB tidak boleh disentuh");
});

test("lookup mengembalikan daftar kandidat", async () => {
  const { GET, state } = makeFixture();
  state.rows = [{ personId: "p1", fullName: "Budi", alreadyRegistered: false, checkedIn: false }];
  const res = await GET(getRequest("q=bu&branchId=b1", { "x-forwarded-for": "1.1.1.1" }));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { rows: unknown[] };
  assert.equal(body.rows.length, 1);
  assert.equal(state.lastLookup?.reunionId, "r-1");
  assert.equal(state.lastLookup?.branchId, "b1");
  assert.equal(state.lastLookup?.q, "bu");
});

test("lookup tetap melayani bila reuni belum ada (reunionId kosong)", async () => {
  const { GET, state } = makeFixture();
  state.reunion = null;
  const res = await GET(getRequest("q=bu&branchId=b1", { "x-forwarded-for": "1.1.1.2" }));
  assert.equal(res.status, 200);
  assert.equal(state.lastLookup?.reunionId, "");
});

test("lookup menerjemahkan QUERY_TOO_SHORT menjadi 400", async () => {
  const { GET, state } = makeFixture();
  state.throwMessage = "QUERY_TOO_SHORT";
  const res = await GET(getRequest("q=bu&branchId=b1", { "x-forwarded-for": "1.1.1.3" }));
  assert.equal(res.status, 400);
});

test("lookup menerjemahkan BRANCH_ID_REQUIRED menjadi 400", async () => {
  const { GET, state } = makeFixture();
  state.throwMessage = "BRANCH_ID_REQUIRED";
  const res = await GET(getRequest("q=bu&branchId=b1", { "x-forwarded-for": "1.1.1.4" }));
  assert.equal(res.status, 400);
});

test("lookup mengembalikan 429 setelah batas per IP", async () => {
  const { GET } = makeFixture();
  for (let i = 0; i < 30; i++) {
    await GET(getRequest("q=wi&branchId=b1", { "x-forwarded-for": "9.9.9.9" }));
  }
  const res = await GET(getRequest("q=wi&branchId=b1", { "x-forwarded-for": "9.9.9.9" }));
  assert.equal(res.status, 429);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, "Terlalu banyak permintaan. Coba lagi sebentar.");
});

test("IP lain tetap dilayani setelah satu IP mencapai batas", async () => {
  const { GET } = makeFixture();
  const res = await GET(getRequest("q=wi&branchId=b1", { "x-forwarded-for": "8.8.8.8" }));
  assert.equal(res.status, 200);
});
