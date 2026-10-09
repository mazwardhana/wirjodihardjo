import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createRateLimiter } from "@/lib/rate-limit";

type Handler = (request: Request) => Promise<Response>;

const filename = resolve("src/app/api/reuni/buku-tamu/route.ts");
const nativeRequire = createRequire(filename);

type CheckInParams = {
  reunionId: string;
  branchId: string;
  rows: unknown[];
  source: string;
  actorUserId: string | null;
};

function loadRoute(fixture: {
  state: {
    branch: { id: string; slug: string; isActive: boolean } | null;
    reunion: { id: string } | null;
    lastCheckIn: CheckInParams | null;
    throwMessage: string | null;
    result: { groupId: string; checkedIn: string[]; alreadyCheckedIn: string[]; created: string[] };
  };
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
          branch: { findUnique: async () => fixture.state.branch },
          reunion: { findUnique: async () => fixture.state.reunion },
        },
      };
    }
    if (id === "@/lib/registrasi") {
      return { REUNI_2027_SLUG: "reuni-uji", EXCLUDED_BRANCH_SLUG: "keluarga-suwito" };
    }
    if (id === "@/lib/rate-limit") return { consumeRateLimit: fixture.limiter.consume };
    if (id === "@/lib/buku-tamu") {
      return {
        MAX_ROWS_PER_GROUP: 20,
        checkIn: async (_db: unknown, params: CheckInParams) => {
          fixture.state.lastCheckIn = params;
          if (fixture.state.throwMessage) throw new Error(fixture.state.throwMessage);
          return fixture.state.result;
        },
      };
    }
    return nativeRequire(id);
  };

  runInNewContext(
    output,
    { exports, Error, URL, Request, Response, console, require: requireMap },
    { filename },
  );
  return exports.POST as Handler;
}

function makeFixture() {
  const state = {
    branch: { id: "b1", slug: "keluarga-soedjinah", isActive: true } as {
      id: string;
      slug: string;
      isActive: boolean;
    } | null,
    reunion: { id: "r-1" } as { id: string } | null,
    lastCheckIn: null as CheckInParams | null,
    throwMessage: null as string | null,
    result: {
      groupId: "g-1",
      checkedIn: ["p1"],
      alreadyCheckedIn: ["p2"],
      created: [],
    },
  };
  const limiter = createRateLimiter();
  const POST = loadRoute({ state, limiter });
  return { POST, state };
}

function json(body: unknown, headers?: Record<string, string>) {
  return new Request("http://x/api/reuni/buku-tamu", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("POST menolak kiriman tanpa baris", async () => {
  const { POST, state } = makeFixture();
  const res = await POST(json({ branchId: "b1", rows: [] }));
  assert.equal(res.status, 400);
  assert.equal(state.lastCheckIn, null);
});

test("POST menolak cabang yang tidak ada", async () => {
  const { POST, state } = makeFixture();
  state.branch = null;
  const res = await POST(json({ branchId: "b-tidak-ada", rows: [{ personId: "p1" }] }));
  assert.equal(res.status, 400);
  assert.equal(state.lastCheckIn, null);
});

test("POST menolak cabang tidak aktif", async () => {
  const { POST, state } = makeFixture();
  state.branch = { id: "b1", slug: "keluarga-soedjinah", isActive: false };
  const res = await POST(json({ branchId: "b1", rows: [{ personId: "p1" }] }));
  assert.equal(res.status, 400);
  assert.equal(state.lastCheckIn, null);
});

test("POST menolak cabang yang dikecualikan", async () => {
  const { POST, state } = makeFixture();
  state.branch = { id: "b1", slug: "keluarga-suwito", isActive: true };
  const res = await POST(json({ branchId: "b1", rows: [{ personId: "p1" }] }));
  assert.equal(res.status, 400);
  assert.equal(state.lastCheckIn, null);
});

test("POST menolak baris dengan bentuk salah", async () => {
  const { POST, state } = makeFixture();
  const res = await POST(json({ branchId: "b1", rows: [{ fullName: "Budi" }] }));
  assert.equal(res.status, 400);
  assert.equal(state.lastCheckIn, null);
});

test("POST menolak gender di luar enum", async () => {
  const { POST, state } = makeFixture();
  const res = await POST(
    json({
      branchId: "b1",
      rows: [{ fullName: "Budi", namaPanggilan: "Bud", gender: "L" }],
    }),
  );
  assert.equal(res.status, 400);
  assert.equal(state.lastCheckIn, null);
});

test("POST mengembalikan groupId dan pemisahan checkedIn", async () => {
  const { POST, state } = makeFixture();
  const res = await POST(
    json({ branchId: "b1", rows: [{ personId: "p1" }, { personId: "p2" }] }),
  );
  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    ok: boolean;
    groupId: string;
    checkedIn: string[];
    alreadyCheckedIn: string[];
  };
  assert.equal(body.ok, true);
  assert.equal(typeof body.groupId, "string");
  assert.equal(body.checkedIn.length + body.alreadyCheckedIn.length, 2);
  assert.equal(state.lastCheckIn?.source, "QR_SELF");
  assert.equal(state.lastCheckIn?.actorUserId, null);
  assert.equal(state.lastCheckIn?.reunionId, "r-1");
});

test("POST tetap memproses bila reuni belum ada (reunionId kosong)", async () => {
  const { POST, state } = makeFixture();
  state.reunion = null;
  const res = await POST(json({ branchId: "b1", rows: [{ personId: "p1" }] }));
  assert.equal(res.status, 201);
  assert.equal(state.lastCheckIn?.reunionId, "");
});

test("POST menolak lebih dari dua puluh baris", async () => {
  const { POST, state } = makeFixture();
  const rows = Array.from({ length: 21 }, (_, i) => ({ personId: `p${i}` }));
  const res = await POST(json({ branchId: "b1", rows }));
  assert.equal(res.status, 400);
  assert.equal(state.lastCheckIn, null);
});

test("POST mengembalikan 429 setelah batas per IP", async () => {
  const { POST } = makeFixture();
  for (let i = 0; i < 10; i++) {
    await POST(json({ branchId: "b1", rows: [{ personId: "p1" }] }, { "x-forwarded-for": "7.7.7.7" }));
  }
  const res = await POST(
    json({ branchId: "b1", rows: [{ personId: "p1" }] }, { "x-forwarded-for": "7.7.7.7" }),
  );
  assert.equal(res.status, 429);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, "Terlalu banyak permintaan. Coba lagi sebentar.");
});
