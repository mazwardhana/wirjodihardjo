import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const filename = resolve("src/app/api/registrasi/route.ts");
const nativeRequire = createRequire(filename);

type Captured = { kind: string; data: Record<string, unknown> };

let captured: Captured[];
let reunionExists: boolean;
let branchValid: boolean;
let POST: (request: Request) => Promise<Response>;

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/registrasi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    namaPanggilan: "Budi",
    namaLengkap: "Budi Santoso",
    gender: "L",
    status: "ALIVE",
    hadir: true,
    ...overrides,
  };
}

before(() => {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const tx = {
    user: {
      findMany: async () => [],
      create: async (args: { data: Record<string, unknown> }) => {
        captured.push({ kind: "user", data: args.data });
        return { id: `u-${captured.length}` };
      },
    },
    person: {
      create: async (args: { data: Record<string, unknown> }) => {
        captured.push({ kind: "person", data: args.data });
        return { id: `p-${captured.length}` };
      },
    },
    reunionRegistration: {
      create: async (args: { data: Record<string, unknown> }) => {
        captured.push({ kind: "registration", data: args.data });
        return { id: "r-1" };
      },
    },
    registrationBatch: {
      create: async (args: { data: Record<string, unknown> }) => {
        captured.push({ kind: "batch", data: args.data });
        return { id: "batch-1" };
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.push({ kind: "batch-update", data: args.data });
        return { id: args.where.id };
      },
    },
  };

  const prisma = {
    reunion: {
      findUnique: async () => (reunionExists ? { id: "reunion-1" } : null),
    },
    branch: {
      findUnique: async () =>
        branchValid ? { id: "b1", slug: "keluarga-soedjinah", isActive: true } : null,
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const exports: Record<string, unknown> = {};
  const errors: string[] = [];
  const originalError = console.error;
  runInNewContext(
    output,
    {
      exports,
      // Route memeriksa `error instanceof Error`. Modul diimpor lewat
      // nativeRequire berjalan di realm host, jadi global Error bawaan VM
      // akan membuat instanceof selalu false. Samakan realm-nya.
      Error,
      require: (id: string) => {
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
        if (id === "@/lib/prisma") return { prisma };
        return nativeRequire(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
      console: { ...console, error: (...args: unknown[]) => errors.push(String(args[0])) },
    },
    { filename },
  );
  void originalError;

  POST = exports.POST as typeof POST;
});

after(() => {
  captured = [];
});

test("kiriman valid membuat anggota, akun, dan peserta reuni", async () => {
  captured = [];
  reunionExists = true;
  branchValid = true;

  const res = await POST(jsonRequest({ branchId: "b1", rows: [row()] }));
  const body = (await res.json()) as { ok: boolean; accountsMade: number; attendees: number };

  assert.equal(res.status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.accountsMade, 1);
  assert.equal(body.attendees, 1);
  assert.equal(captured.filter((c) => c.kind === "person").length, 1);
  assert.equal(captured.filter((c) => c.kind === "user").length, 1);
  assert.equal(captured.filter((c) => c.kind === "registration").length, 1);
});

test("branchId kosong ditolak sebelum menyentuh basis data", async () => {
  captured = [];
  reunionExists = true;
  branchValid = true;

  const res = await POST(jsonRequest({ rows: [row()] }));
  assert.equal(res.status, 400);
  assert.ok(captured.length === 0);
});

test("baris tidak valid ditolak dan tidak ada data tersimpan", async () => {
  captured = [];
  reunionExists = true;
  branchValid = true;

  const res = await POST(jsonRequest({ branchId: "b1", rows: [row({ gender: "" })] }));
  const body = (await res.json()) as { errors: Array<{ field: string }> };

  assert.equal(res.status, 400);
  assert.ok(body.errors.some((e) => e.field === "gender"));
  assert.equal(captured.length, 0);
});

test("branch tidak valid dijawab 400 bukan 500", async () => {
  captured = [];
  reunionExists = true;
  branchValid = false;

  const res = await POST(jsonRequest({ branchId: "b1", rows: [row()] }));
  assert.equal(res.status, 400);
});

test("event reuni belum ada: anggota tetap tersimpan tanpa pendaftaran", async () => {
  captured = [];
  reunionExists = false;
  branchValid = true;

  const res = await POST(jsonRequest({ branchId: "b1", rows: [row()] }));
  const body = (await res.json()) as { attendees: number };

  assert.equal(res.status, 201);
  assert.equal(captured.filter((c) => c.kind === "person").length, 1);
  assert.equal(captured.filter((c) => c.kind === "registration").length, 0);
  assert.equal(body.attendees, 0);
});

test("IP pengirim dicatat di batch", async () => {
  captured = [];
  reunionExists = true;
  branchValid = true;

  const request = new Request("http://localhost/api/registrasi", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    body: JSON.stringify({ branchId: "b1", rows: [row()] }),
  });
  await POST(request);

  const batch = captured.find((c) => c.kind === "batch");
  assert.equal(batch?.data.submitterIp, "203.0.113.9");
});