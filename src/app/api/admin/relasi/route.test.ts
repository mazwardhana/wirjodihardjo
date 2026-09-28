import assert from "node:assert/strict";
import test from "node:test";
import { assertPersonAccess, AuthorizationError } from "../../../../lib/rbac";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type PersonRow = { branchId: string | null };

function makePersonDb(persons: Record<string, PersonRow>) {
  return {
    person: {
      findUnique: async ({ where }: { where: { id: string } }) => persons[where.id] ?? null,
    },
  };
}

test("relation removal rejects a parent-child edge when either endpoint is out of scope", async () => {
  const db = makePersonDb({
    parent: { branchId: "branch-1" },
    child: { branchId: "branch-2" },
  });
  const scope = { role: "BRANCH_ADMIN" as const, branchId: "branch-1" };
  let deleted = false;

  await assert.rejects(
    async () => {
      await assertPersonAccess(scope, "parent", db as never);
      await assertPersonAccess(scope, "child", db as never);
      deleted = true;
    },
    (error: unknown) => error instanceof AuthorizationError && error.status === 403,
  );

  assert.equal(deleted, false);
});

test("relation removal rejects a partner edge when either endpoint is out of scope", async () => {
  const db = makePersonDb({
    partnerA: { branchId: "branch-1" },
    partnerB: { branchId: "branch-2" },
  });
  const scope = { role: "BRANCH_ADMIN" as const, branchId: "branch-1" };
  let deleted = false;

  await assert.rejects(
    async () => {
      await assertPersonAccess(scope, "partnerA", db as never);
      await assertPersonAccess(scope, "partnerB", db as never);
      deleted = true;
    },
    (error: unknown) => error instanceof AuthorizationError && error.status === 403,
  );

  assert.equal(deleted, false);
});

// ── harness `add-new` ────────────────────────────────────────────────────

type Handler = (request: Request) => Promise<Response>;
type RequireMap = (id: string) => unknown;

function loadModule(filename: string, requireMap: RequireMap) {
  const abs = resolve(filename);
  const output = ts.transpileModule(readFileSync(abs, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    { exports, URL, Request, Response, console, require: requireMap },
    { filename: abs },
  );
  return exports;
}

type RelasiState = {
  person: { id: string; branchId: string | null; gender: string } | null;
  parentCount: number;
  partnerCount: number;
  personCreate: Array<{ data: { fullName: string; branchId?: string; isMarriedInto?: boolean } }>;
  personChildCreate: Array<{ data: { parentId: string; childId: string; parentRole: string } }>;
  personPartnerCreate: Array<{
    data: { partnerAId: string; partnerBId: string; status: string; orderIndex: number };
  }>;
};

function relasiFixture(): RelasiState {
  return {
    person: { id: "fokus", branchId: "cabang-1", gender: "MALE" },
    parentCount: 0,
    partnerCount: 0,
    personCreate: [],
    personChildCreate: [],
    personPartnerCreate: [],
  };
}

// Memuat route asli dengan auth, persistence, audit, dan genealogy diganti mock.
// `@/lib/rbac` memakai file asli dengan `@/lib/prisma` dipetakan ke fake.
function loadRelasiRoute(state: RelasiState): { POST?: Handler } {
  const abs = resolve("src/app/api/admin/relasi/route.ts");
  const nodeRequire = createRequire(abs);

  const prismaPalsu = {
    user: { findUnique: async () => ({ id: "u1", role: "SUPER_ADMIN", branchAdminOf: null }) },
    person: {
      findUnique: async () => state.person,
      create: async (args: { data: { fullName: string; branchId?: string; isMarriedInto?: boolean } }) => {
        state.personCreate.push(args);
        return { id: "person-baru", fullName: args.data.fullName };
      },
    },
    personChild: {
      count: async () => state.parentCount,
      create: async (args: { data: { parentId: string; childId: string; parentRole: string } }) => {
        state.personChildCreate.push(args);
        return { id: "pc-baru" };
      },
    },
    personPartner: {
      count: async () => state.partnerCount,
      create: async (args: {
        data: { partnerAId: string; partnerBId: string; status: string; orderIndex: number };
      }) => {
        state.personPartnerCreate.push(args);
        return { id: "pp-baru" };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<string>) => fn(prismaPalsu),
  };

  const prismaModule = { prisma: prismaPalsu };
  const authModule = { auth: async () => ({ user: { id: "u1" } }) };
  const auditModule = { logAudit: async () => undefined };
  const genealogyModule = { recalculateGenerationLevel: async () => null };

  const rbac = loadModule("src/lib/rbac.ts", (id) =>
    id === "@/lib/prisma" ? prismaModule : nodeRequire(id),
  );

  return loadModule("src/app/api/admin/relasi/route.ts", (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return prismaModule;
    if (id === "@/lib/audit") return auditModule;
    if (id === "@/lib/genealogy") return genealogyModule;
    if (id === "@/lib/rbac") return rbac;
    return nodeRequire(id);
  }) as { POST?: Handler };
}

const POST_URL = "http://localhost/api/admin/relasi";

function postRequest(body: Record<string, unknown>) {
  return new Request(POST_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("add-new parent ditolak saat orang fokus sudah punya dua orang tua (409)", async () => {
  const state = relasiFixture();
  state.parentCount = 2;
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({
      action: "add-new",
      relationType: "parent",
      personId: "fokus",
      fullName: "Orang Tua Baru",
      gender: "FEMALE",
    }),
  );

  assert.equal(response.status, 409);
  const body = (await response.json()) as { error: string };
  assert.equal(
    body.error,
    "Anggota ini sudah memiliki 2 orang tua. Hapus salah satu relasi terlebih dahulu.",
  );
  assert.equal(state.personCreate.length, 0);
});

test("add-new child menyimpan cabang dan peran orang tua sesuai gender fokus (201)", async () => {
  const state = relasiFixture();
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({
      action: "add-new",
      relationType: "child",
      personId: "fokus",
      fullName: "Anak Baru",
      gender: "FEMALE",
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(state.personCreate.length, 1);
  assert.equal(state.personCreate[0].data.branchId, "cabang-1");
  assert.equal(state.personCreate[0].data.isMarriedInto, false);
  assert.equal(state.personChildCreate.length, 1);
  assert.equal(state.personChildCreate[0].data.parentId, "fokus");
  assert.equal(state.personChildCreate[0].data.childId, "person-baru");
  assert.equal(state.personChildCreate[0].data.parentRole, "FATHER");
});

test("add-new tanpa nama lengkap ditolak dan tidak menulis (400)", async () => {
  const state = relasiFixture();
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({
      action: "add-new",
      relationType: "child",
      personId: "fokus",
      gender: "MALE",
    }),
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Nama lengkap wajib diisi");
  assert.equal(state.personCreate.length, 0);
});

test("add-new partner menandai menikah masuk dan menyimpan relasi pasangan (201)", async () => {
  const state = relasiFixture();
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({
      action: "add-new",
      relationType: "partner",
      personId: "fokus",
      fullName: "Pasangan Baru",
      gender: "FEMALE",
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(state.personCreate.length, 1);
  assert.equal(state.personCreate[0].data.isMarriedInto, true);
  assert.equal(state.personPartnerCreate.length, 1);
  assert.equal(state.personPartnerCreate[0].data.partnerAId, "fokus");
  assert.equal(state.personPartnerCreate[0].data.partnerBId, "person-baru");
  assert.equal(state.personPartnerCreate[0].data.status, "MARRIED");
});

test("add-new dengan tanggal lahir tidak valid ditolak dan tidak menulis (400)", async () => {
  const state = relasiFixture();
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({
      action: "add-new",
      relationType: "child",
      personId: "fokus",
      fullName: "Anak Baru",
      gender: "FEMALE",
      birthDate: "bukan-tanggal",
    }),
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Tanggal lahir tidak valid");
  assert.equal(state.personCreate.length, 0);
});
