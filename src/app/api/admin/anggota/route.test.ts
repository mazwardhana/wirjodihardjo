import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";

type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

type CreateArgs = {
  data: {
    fullName: string;
    branch?: { connect: { id: string } } | { disconnect: boolean };
  };
};

type Handler = (request: Request) => Promise<Response>;
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

function anggotaFixture() {
  const state = {
    session: { user: { id: "u1", role: "SUPER_ADMIN" as Role } } as
      | { user: { id: string; role: Role } }
      | null,
    users: {
      u1: { role: "SUPER_ADMIN" as Role, branchAdminOf: null as { id: string } | null },
      u2: { role: "BRANCH_ADMIN" as Role, branchAdminOf: { id: BRANCH_A } },
      u3: { role: "MEMBER" as Role, branchAdminOf: null as { id: string } | null },
    } as Record<string, { role: Role; branchAdminOf: { id: string } | null }>,
    createCalls: [] as CreateArgs[],
  };

  const prisma = {
    user: {
      findUnique: async (args: { where: { id: string } }) => state.users[args.where.id] ?? null,
    },
    person: {
      create: async (args: CreateArgs) => {
        state.createCalls.push(args);
        return { id: "person-baru", fullName: args.data.fullName };
      },
      findUnique: async () => null,
    },
  };

  const audit = {
    logAudit: async () => undefined,
  };

  return { state, prisma, audit };
}

// Memuat route asli dengan auth, persistence, dan audit diganti mock.
function loadAnggotaRoute(fixture: ReturnType<typeof anggotaFixture>) {
  const abs = resolve("src/app/api/admin/anggota/route.ts");
  const nodeRequire = createRequire(abs);

  const submission = loadModule("src/server/validations/submission.ts", (id) => nodeRequire(id));
  const validations = loadModule("src/server/validations/index.ts", (id) =>
    id === "./submission" ? submission : nodeRequire(id),
  );

  const prismaModule = { prisma: fixture.prisma };
  const authModule = { auth: async () => fixture.state.session };

  const rbac = loadModule("src/lib/rbac.ts", (id) =>
    id === "@/lib/prisma" ? prismaModule : nodeRequire(id),
  );

  return loadModule("src/app/api/admin/anggota/route.ts", (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return prismaModule;
    if (id === "@/lib/audit") return fixture.audit;
    if (id === "@/lib/rbac") return rbac;
    if (id === "@/server/validations") return validations;
    return nodeRequire(id);
  }) as { POST?: Handler };
}

const POST_URL = "http://localhost/api/admin/anggota";

function postRequest(body: Record<string, unknown>) {
  return new Request(POST_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function bodyWithoutBranch(fullName = "Anggota Baru") {
  return { fullName, gender: "MALE" };
}

test("POST menolak permintaan tanpa sesi (401)", async () => {
  const f = anggotaFixture();
  f.state.session = null;
  const route = loadAnggotaRoute(f);
  const response = await route.POST!(postRequest(bodyWithoutBranch()));
  assert.equal(response.status, 401);
  assert.equal(f.state.createCalls.length, 0);
});

test("BRANCH_ADMIN tanpa branchId ditolak dan tidak menulis (400)", async () => {
  const f = anggotaFixture();
  f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
  const route = loadAnggotaRoute(f);
  const response = await route.POST!(postRequest(bodyWithoutBranch()));
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Cabang wajib dipilih");
  assert.equal(f.state.createCalls.length, 0);
});

test("BRANCH_ADMIN dengan branchId kosong tetap ditolak (400)", async () => {
  const f = anggotaFixture();
  f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
  const route = loadAnggotaRoute(f);
  const response = await route.POST!(postRequest({ ...bodyWithoutBranch(), branchId: "" }));
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Cabang wajib dipilih");
  assert.equal(f.state.createCalls.length, 0);
});

test("BRANCH_ADMIN dengan cabangnya sendiri membuat anggota (201)", async () => {
  const f = anggotaFixture();
  f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
  const route = loadAnggotaRoute(f);
  const response = await route.POST!(
    postRequest({ ...bodyWithoutBranch(), branchId: BRANCH_A }),
  );
  assert.equal(response.status, 201);
  assert.equal(f.state.createCalls.length, 1);
  const branch = f.state.createCalls[0].data.branch as { connect: { id: string } };
  assert.equal(branch.connect.id, BRANCH_A);
});

test("BRANCH_ADMIN dengan cabang lain ditolak dan tidak menulis (403)", async () => {
  const f = anggotaFixture();
  f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
  const route = loadAnggotaRoute(f);
  const response = await route.POST!(
    postRequest({ ...bodyWithoutBranch(), branchId: BRANCH_B }),
  );
  assert.equal(response.status, 403);
  assert.equal(f.state.createCalls.length, 0);
});

test("SUPER_ADMIN boleh membuat anggota tanpa cabang (201)", async () => {
  const f = anggotaFixture();
  const route = loadAnggotaRoute(f);
  const response = await route.POST!(postRequest(bodyWithoutBranch("Anggota Yatim")));
  assert.equal(response.status, 201);
  assert.equal(f.state.createCalls.length, 1);
  assert.equal(f.state.createCalls[0].data.branch, undefined);
});
