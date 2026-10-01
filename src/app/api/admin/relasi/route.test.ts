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

type AdminPersonRow = { id: string; branchId: string | null; gender: string };
type ChildEdge = { parentId: string; childId: string; orderIndex: number };

type RelasiState = {
  person: AdminPersonRow | null;
  persons: Record<string, AdminPersonRow>;
  parentCount: number;
  partnerCount: number;
  personCreate: Array<{ data: { fullName: string; branchId?: string; isMarriedInto?: boolean } }>;
  personChildCreate: Array<{
    data: { parentId: string; childId: string; parentRole: string; orderIndex?: number };
  }>;
  personChildUpdate: Array<{
    where: { parentId_childId: { parentId: string; childId: string } };
    data: { orderIndex: number };
  }>;
  childEdges: ChildEdge[];
  personPartnerCreate: Array<{
    data: { partnerAId: string; partnerBId: string; status: string; orderIndex: number };
  }>;
  userRole: "SUPER_ADMIN" | "BRANCH_ADMIN";
  branchAdminOf: { id: string } | null;
};

function relasiFixture(): RelasiState {
  return {
    person: { id: "fokus", branchId: "cabang-1", gender: "MALE" },
    persons: {},
    parentCount: 0,
    partnerCount: 0,
    personCreate: [],
    personChildCreate: [],
    personChildUpdate: [],
    childEdges: [],
    personPartnerCreate: [],
    userRole: "SUPER_ADMIN" as "SUPER_ADMIN" | "BRANCH_ADMIN",
    branchAdminOf: null as { id: string } | null,
  };
}

// Memuat route asli dengan auth, persistence, audit, dan genealogy diganti mock.
// `@/lib/rbac` memakai file asli dengan `@/lib/prisma` dipetakan ke fake.
function loadRelasiRoute(state: RelasiState): { POST?: Handler } {
  const abs = resolve("src/app/api/admin/relasi/route.ts");
  const nodeRequire = createRequire(abs);

  const prismaPalsu = {
    user: {
      findUnique: async () => ({
        id: "u1",
        role: state.userRole,
        branchAdminOf: state.branchAdminOf,
      }),
    },
    person: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (state.person && where.id === state.person.id) return state.person;
        return state.persons[where.id] ?? null;
      },
      create: async (args: { data: { fullName: string; branchId?: string; isMarriedInto?: boolean } }) => {
        state.personCreate.push(args);
        return { id: "person-baru", fullName: args.data.fullName };
      },
    },
    personChild: {
      count: async () => state.parentCount,
      findFirst: async (args: { where?: { parentId?: string; childId?: string } }) => {
        const where = args?.where ?? {};
        return (
          state.childEdges.find(
            (row) =>
              (where.parentId === undefined || row.parentId === where.parentId) &&
              (where.childId === undefined || row.childId === where.childId),
          ) ?? null
        );
      },
      // Kembalikan baris PersonChild yang cocok dengan `where` agar jalur
      // tulis membaca himpunan orang tua anak dari graf nyata, bukan kosong.
      findMany: async (args: { where?: { parentId?: unknown; childId?: unknown } }) => {
        const where = args?.where ?? {};
        return state.childEdges.filter((row) => {
          const parentId = where.parentId;
          if (typeof parentId === "string" && row.parentId !== parentId) return false;
          if (parentId && typeof parentId === "object" && !(parentId as { in?: string[] }).in?.includes(row.parentId)) {
            return false;
          }
          const childId = where.childId;
          if (typeof childId === "string" && row.childId !== childId) return false;
          if (childId && typeof childId === "object" && !(childId as { in?: string[] }).in?.includes(row.childId)) {
            return false;
          }
          return true;
        });
      },
      create: async (args: {
        data: { parentId: string; childId: string; parentRole: string; orderIndex?: number };
      }) => {
        state.personChildCreate.push(args);
        state.childEdges.push({
          parentId: args.data.parentId,
          childId: args.data.childId,
          orderIndex: args.data.orderIndex ?? 0,
        });
        return { id: "pc-baru" };
      },
      update: async (args: {
        where: { parentId_childId: { parentId: string; childId: string } };
        data: { orderIndex: number };
      }) => {
        state.personChildUpdate.push(args);
        const { parentId, childId } = args.where.parentId_childId;
        const row = state.childEdges.find((edge) => edge.parentId === parentId && edge.childId === childId);
        if (row) row.orderIndex = args.data.orderIndex;
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

test("add-new ditolak saat orang fokus di luar cabang admin cabang (403)", async () => {
  const state = relasiFixture();
  state.userRole = "BRANCH_ADMIN";
  state.branchAdminOf = { id: "cabang-lain" };
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({
      action: "add-new",
      relationType: "child",
      personId: "fokus",
      fullName: "Anggota Baru",
      gender: "MALE",
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(state.personCreate.length, 0);
});

test("add parent menyamakan orderIndex baris lama dan baru anak yang sudah ada", async () => {
  // Anak C sudah punya orang tua P1 (orderIndex 1) di grup {P1}. Saat P2
  // ditambahkan, himpunan orang tua C menjadi {P1,P2}; kedua baris C wajib
  // bernomor sama.
  const state = relasiFixture();
  state.person = { id: "C", branchId: "cabang-1", gender: "MALE" };
  state.persons = { P2: { id: "P2", branchId: "cabang-1", gender: "FEMALE" } };
  state.childEdges = [{ parentId: "P1", childId: "C", orderIndex: 1 }];
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({
      action: "add",
      relationType: "parent",
      personId: "C",
      targetPersonId: "P2",
      role: "MOTHER",
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(state.personChildCreate.length, 1);
  assert.equal(state.personChildCreate[0].data.orderIndex, 0);

  const barisP1 = state.childEdges.find((edge) => edge.parentId === "P1" && edge.childId === "C");
  const barisP2 = state.childEdges.find((edge) => edge.parentId === "P2" && edge.childId === "C");
  assert.ok(barisP1);
  assert.ok(barisP2);
  assert.equal(barisP1!.orderIndex, 0);
  assert.equal(barisP2!.orderIndex, 0);
  assert.equal(barisP1!.orderIndex, barisP2!.orderIndex);
  assert.equal(state.personChildUpdate.length, 1);
});
