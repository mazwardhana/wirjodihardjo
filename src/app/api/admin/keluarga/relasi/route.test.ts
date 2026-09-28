import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";

type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

type Edge = {
  parentId: string;
  childId: string;
  parentRole?: string;
  isStep?: boolean;
  isAdopted?: boolean;
};

type Row = Record<string, unknown>;

function personRow(id: string, fullName: string, gender: string, branchId: string): Row {
  return {
    id,
    fullName,
    nickname: null,
    photoUrl: null,
    gender,
    generationLevel: 1,
    isDeceased: false,
    branchId,
    branch: { id: branchId, name: `Cabang ${branchId}`, branchNumber: 1 },
    birthDate: new Date("1991-04-02T00:00:00.000Z"),
    birthPlace: "Sleman",
    deathDate: null,
    occupation: "Guru",
    status: null,
    bio: null,
    isMarriedInto: false,
    private: {
      visibleToMembers: true,
      city: "Sleman",
      province: "DI Yogyakarta",
      addressLine: "Jl. Kaliurang 1",
      postalCode: "55581",
      phone: "081234567890",
      whatsapp: "6281234567890",
      email: "c@x.id",
      maritalStatus: null,
    },
    education: [],
    socialLinks: [],
    parents: [],
    children: [],
  };
}

function relasiFixture() {
  const state = {
    session: { user: { id: "u1", role: "SUPER_ADMIN" as Role } } as
      | { user: { id: string; role: Role } }
      | null,
    users: {
      u1: { role: "SUPER_ADMIN" as Role, branchAdminOf: null as { id: string } | null },
      u2: { role: "BRANCH_ADMIN" as Role, branchAdminOf: { id: "b1" } },
      u3: { role: "MEMBER" as Role, branchAdminOf: null as { id: string } | null },
    } as Record<string, { role: Role; branchAdminOf: { id: string } | null }>,
    persons: {
      C: personRow("C", "Anak Cahya", "FEMALE", "b1"),
      A: personRow("A", "Ayah Budi", "MALE", "b1"),
      K: personRow("K", "Kakek Slamet", "MALE", "b1"),
      N: personRow("N", "Nenek Siti", "FEMALE", "b1"),
      S1: personRow("S1", "Saudara Dedi", "MALE", "b1"),
      S2: personRow("S2", "Saudara Rina", "FEMALE", "b1"),
      X: personRow("X", "Orang Cabang 2", "MALE", "b2"),
    } as Record<string, Row>,
    edges: [
      { parentId: "K", childId: "A", parentRole: "FATHER" },
      { parentId: "N", childId: "A", parentRole: "MOTHER" },
      { parentId: "A", childId: "C", parentRole: "FATHER" },
      { parentId: "N", childId: "C", parentRole: "MOTHER" },
      { parentId: "A", childId: "S1", parentRole: "FATHER" },
      { parentId: "N", childId: "S1", parentRole: "MOTHER" },
      { parentId: "A", childId: "S2", parentRole: "FATHER" },
      { parentId: "N", childId: "S2", parentRole: "MOTHER" },
    ] as Edge[],
  };

  const prisma: Record<string, unknown> = {
    user: {
      findUnique: async (args: { where: { id: string } }) => state.users[args.where.id] ?? null,
    },
    person: {
      findUnique: async (args: { where: { id: string } }) => state.persons[args.where.id] ?? null,
      findMany: async (args: { where?: { id?: { in?: string[] } } }) => {
        const ids: string[] = args?.where?.id?.in ?? [];
        return ids
          .filter((id) => state.persons[id])
          .map((id) => ({ ...state.persons[id] }));
      },
    },
    personChild: {
      findMany: async (args: {
        where?: {
          childId?: { in?: string[]; not?: string } | string;
          parentId?: { in?: string[] } | string;
        };
      }) => {
        const where = args?.where ?? {};
        const childId = where.childId;
        const parentId = where.parentId;
        let rows = state.edges;
        if (typeof childId === "string") {
          rows = rows.filter((e) => e.childId === childId);
        } else if (childId && typeof childId === "object" && childId.in) {
          rows = rows.filter((e) => childId.in!.includes(e.childId));
        }
        if (childId && typeof childId === "object" && childId.not) {
          rows = rows.filter((e) => e.childId !== childId.not);
        }
        if (typeof parentId === "string") {
          rows = rows.filter((e) => e.parentId === parentId);
        } else if (parentId && typeof parentId === "object" && parentId.in) {
          rows = rows.filter((e) => parentId.in!.includes(e.parentId));
        }
        return rows.map((e) => ({ ...e }));
      },
    },
  };

  return { state, prisma };
}

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

// Memuat route asli dengan hanya auth, persistence, dan relasi diganti mock.
function loadRelasiRoute(fixture: ReturnType<typeof relasiFixture>) {
  const abs = resolve("src/app/api/admin/keluarga/relasi/route.ts");
  const nodeRequire = createRequire(abs);

  const prisma = { prisma: fixture.prisma };
  const authModule = { auth: async () => fixture.state.session };

  const rbac = loadModule("src/lib/rbac.ts", (id) =>
    id === "@/lib/prisma" ? prisma : nodeRequire(id),
  );
  const genealogy = loadModule("src/lib/genealogy.ts", (id) => {
    if (id === "@/lib/prisma") return prisma;
    if (id === "@/lib/rbac") return rbac;
    return nodeRequire(id);
  });
  const generations = loadModule("src/lib/generations.ts", (id) => nodeRequire(id));
  const familyTree = loadModule("src/lib/family-tree.ts", (id) => {
    if (id === "@/lib/prisma") return prisma;
    if (id === "@/lib/rbac") return rbac;
    if (id === "@/lib/genealogy") return genealogy;
    if (id === "@/lib/generations") return generations;
    return nodeRequire(id);
  });

  return loadModule("src/app/api/admin/keluarga/relasi/route.ts", (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/rbac") return rbac;
    if (id === "@/lib/family-tree") return familyTree;
    return nodeRequire(id);
  }) as { GET?: Handler };
}

const GET_URL = (personId?: string) =>
  personId
    ? `http://localhost/api/admin/keluarga/relasi?personId=${encodeURIComponent(personId)}`
    : "http://localhost/api/admin/keluarga/relasi";

test("GET menolak permintaan tanpa sesi (401)", async () => {
  const f = relasiFixture();
  f.state.session = null;
  const route = loadRelasiRoute(f);
  const response = await route.GET!(new Request(GET_URL("C")));
  assert.equal(response.status, 401);
});

test("GET menolak peran non-admin (403)", async () => {
  const f = relasiFixture();
  f.state.session = { user: { id: "u3", role: "MEMBER" } };
  const route = loadRelasiRoute(f);
  const response = await route.GET!(new Request(GET_URL("C")));
  assert.equal(response.status, 403);
});

test("GET meminta personId (400)", async () => {
  const f = relasiFixture();
  const route = loadRelasiRoute(f);
  const response = await route.GET!(new Request(GET_URL()));
  assert.equal(response.status, 400);
});

test("BRANCH_ADMIN ditolak membaca anggota cabang lain (403)", async () => {
  const f = relasiFixture();
  f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
  const route = loadRelasiRoute(f);
  const response = await route.GET!(new Request(GET_URL("X")));
  assert.equal(response.status, 403);
  const body = (await response.json()) as { error?: string };
  assert.match(body.error ?? "", /cabang/i);
});

test("SUPER_ADMIN menerima payload lengkap relasi (200)", async () => {
  const f = relasiFixture();
  const route = loadRelasiRoute(f);
  const response = await route.GET!(new Request(GET_URL("C")));
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    person: { id: string; fullName: string };
    branch: { id: string } | null;
    ancestors: { label: string; members: unknown[] }[];
    siblings: { label: string; members: unknown[] }[];
    descendants: { label: string; members: unknown[] }[];
    parents: unknown[];
    children: unknown[];
  };
  assert.equal(body.person.id, "C");
  assert.equal(body.branch?.id, "b1");
  assert.equal(body.ancestors[0].label, "Orang Tua");
  assert.equal(body.ancestors[1].label, "Kakek/Nenek");
  assert.equal(body.siblings[0].label, "Sedulur");
  assert.equal(body.siblings[0].members.length, 2);
  assert.equal(body.descendants[0].label, "Anak");
  assert.ok(Array.isArray(body.parents));
  assert.ok(Array.isArray(body.children));
});

test("BRANCH_ADMIN dapat membaca anggota cabangnya (200)", async () => {
  const f = relasiFixture();
  f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
  const route = loadRelasiRoute(f);
  const response = await route.GET!(new Request(GET_URL("C")));
  assert.equal(response.status, 200);
});
