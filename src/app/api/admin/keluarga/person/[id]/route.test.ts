import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";

type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

type PersonRow = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: string;
  birthDate: Date | null;
  birthPlace: string | null;
  branchId: string | null;
};

type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
type RequireMap = (id: string) => unknown;

const BRANCH_A = "11111111-1111-4111-8111-111111111111";
const BRANCH_B = "22222222-2222-4222-8222-222222222222";

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

function personFixture(persons: Record<string, PersonRow>) {
  const state = {
    session: { user: { id: "u1", role: "SUPER_ADMIN" as Role } } as
      | { user: { id: string; role: Role } }
      | null,
    users: {
      u1: { role: "SUPER_ADMIN" as Role, branchAdminOf: null as { id: string } | null },
      u2: { role: "BRANCH_ADMIN" as Role, branchAdminOf: { id: BRANCH_A } },
      u3: { role: "MEMBER" as Role, branchAdminOf: null as { id: string } | null },
    } as Record<string, { role: Role; branchAdminOf: { id: string } | null }>,
    findUniqueCalls: [] as string[],
    updateCalls: 0,
    upsertCalls: 0,
    auditCalls: 0,
  };

  const prisma = {
    user: {
      findUnique: async (args: { where: { id: string } }) => state.users[args.where.id] ?? null,
    },
    person: {
      findUnique: async (args: { where: { id: string } }) => {
        state.findUniqueCalls.push(args.where.id);
        return persons[args.where.id] ?? null;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        state.updateCalls += 1;
        return { ...(persons[args.where.id] as PersonRow), ...args.data };
      },
    },
    personPrivate: {
      upsert: async () => {
        state.upsertCalls += 1;
        return {};
      },
    },
  };

  const audit = {
    logAudit: async () => {
      state.auditCalls += 1;
    },
  };

  return { state, prisma, audit };
}

// Memuat route asli dengan auth, persistence, dan audit diganti mock.
function loadPersonRoute(fixture: ReturnType<typeof personFixture>) {
  const abs = resolve("src/app/api/admin/keluarga/person/[id]/route.ts");
  const nodeRequire = createRequire(abs);

  const prismaModule = { prisma: fixture.prisma };
  const authModule = { auth: async () => fixture.state.session };

  const rbac = loadModule("src/lib/rbac.ts", (id) =>
    id === "@/lib/prisma" ? prismaModule : nodeRequire(id),
  );

  return loadModule("src/app/api/admin/keluarga/person/[id]/route.ts", (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return prismaModule;
    if (id === "@/lib/audit") return fixture.audit;
    if (id === "@/lib/rbac") return rbac;
    return nodeRequire(id);
  }) as { PUT?: Handler };
}

function editRequest(fullName = "Anggota Ubah") {
  return new Request("http://localhost/api/admin/keluarga/person/p1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName, gender: "MALE" }),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

test("PUT menolak permintaan tanpa sesi (401)", async () => {
  const f = personFixture({ p1: { id: "p1", fullName: "A", nickname: null, gender: "MALE", birthDate: null, birthPlace: null, branchId: BRANCH_A } });
  f.state.session = null;
  const route = loadPersonRoute(f);
  const response = await route.PUT!(editRequest(), context("p1"));
  assert.equal(response.status, 401);
  assert.equal(f.state.updateCalls, 0);
});

test("PUT menolak orang yang tidak ada tanpa menulis (404)", async () => {
  const f = personFixture({});
  f.state.session = { user: { id: "u1", role: "SUPER_ADMIN" } };
  const route = loadPersonRoute(f);
  const response = await route.PUT!(editRequest(), context("hilang"));
  assert.equal(response.status, 404);
  assert.equal(f.state.updateCalls, 0);
  assert.equal(f.state.upsertCalls, 0);
  assert.equal(f.state.auditCalls, 0);
});

test("PUT menolak BRANCH_ADMIN atas cabang lain tanpa menulis (403)", async () => {
  const f = personFixture({
    px: { id: "px", fullName: "X", nickname: null, gender: "MALE", birthDate: null, birthPlace: null, branchId: BRANCH_B },
  });
  f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
  const route = loadPersonRoute(f);
  const response = await route.PUT!(editRequest(), context("px"));
  assert.equal(response.status, 403);
  assert.equal(f.state.updateCalls, 0);
  assert.equal(f.state.upsertCalls, 0);
  assert.equal(f.state.auditCalls, 0);
});

test("PUT SUPER_ADMIN boleh mengubah orang tanpa cabang (200)", async () => {
  const f = personFixture({
    py: { id: "py", fullName: "Y", nickname: null, gender: "FEMALE", birthDate: null, birthPlace: null, branchId: null },
  });
  const route = loadPersonRoute(f);
  const response = await route.PUT!(editRequest("Y Baru"), context("py"));
  assert.equal(response.status, 200);
  assert.equal(f.state.updateCalls, 1);
  assert.equal(f.state.upsertCalls, 1);
  assert.equal(f.state.auditCalls, 1);
});

test("PUT BRANCH_ADMIN membaca cabangnya hanya satu kali (200)", async () => {
  const f = personFixture({
    p1: { id: "p1", fullName: "A", nickname: null, gender: "MALE", birthDate: null, birthPlace: null, branchId: BRANCH_A },
  });
  f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
  const route = loadPersonRoute(f);
  const response = await route.PUT!(editRequest("A Baru"), context("p1"));
  assert.equal(response.status, 200);
  assert.equal(f.state.findUniqueCalls.length, 1);
  assert.equal(f.state.findUniqueCalls[0], "p1");
  assert.equal(f.state.updateCalls, 1);
  assert.equal(f.state.auditCalls, 1);
});
