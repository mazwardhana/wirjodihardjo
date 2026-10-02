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
type ChildEdge = { id?: string; parentId: string; childId: string; orderIndex: number };

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
  personChildUpdateFull: Array<{ where: unknown; data: Record<string, unknown> }>;
  childEdges: ChildEdge[];
  personPartnerCreate: Array<{
    data: { partnerAId: string; partnerBId: string; status: string; orderIndex: number };
  }>;
  partnerEdges: Array<{
    id: string;
    partnerAId: string;
    partnerBId: string;
    status: string;
    marriageDate?: Date | null;
    divorceDate?: Date | null;
    notes?: string | null;
  }>;
  partnerUpdate: Array<{ where: { id: string }; data: Record<string, unknown> }>;
  userRole: "SUPER_ADMIN" | "BRANCH_ADMIN";
  branchAdminOf: { id: string } | null;
  moveChildCalls: Array<{ childId: string; direction: string }>;
  moveChildResult: boolean;
  auditCalls: Array<{ action: string; entityId: string; actorUserId: string }>;
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
    personChildUpdateFull: [],
    childEdges: [],
    personPartnerCreate: [],
    partnerEdges: [],
    partnerUpdate: [],
    userRole: "SUPER_ADMIN" as "SUPER_ADMIN" | "BRANCH_ADMIN",
    branchAdminOf: null as { id: string } | null,
    moveChildCalls: [],
    moveChildResult: true,
    auditCalls: [],
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
      // Anggota yang tidak disemai dianggap ada di cabang yang sama supaya
      // `assertPersonAccess` tidak menggagalkan tes yang hanya menguji logika
      // relasi; tes akses tetap menyemai `person`/`persons` eksplisit.
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (state.person && where.id === state.person.id) return state.person;
        return (
          state.persons[where.id] ?? { id: where.id, branchId: "cabang-1", gender: "MALE" }
        );
      },
      create: async (args: { data: { fullName: string; branchId?: string; isMarriedInto?: boolean } }) => {
        state.personCreate.push(args);
        return { id: "person-baru", fullName: args.data.fullName };
      },
    },
    personChild: {
      // `state.parentCount` tetap dipakai tes lama sebagai override; graf
      // `childEdges` ikut dihitung supaya tes edit relasi melihat jumlah nyata.
      count: async (args?: { where?: { parentId?: string; childId?: string } }) => {
        const where = args?.where;
        const matching = state.childEdges.filter(
          (row) =>
            (where?.parentId === undefined || row.parentId === where.parentId) &&
            (where?.childId === undefined || row.childId === where.childId),
        ).length;
        return state.parentCount + matching;
      },
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
        where: { id?: string; parentId_childId?: { parentId: string; childId: string } };
        data: Record<string, unknown>;
      }) => {
        // Jalur `edit-relation` mengubah baris lewat `where.id`; jalur order
        // memakai kunci unik `parentId_childId`. Keduanya dibedakan di sini.
        if (args.where.id !== undefined) {
          state.personChildUpdateFull.push(args);
          return { id: args.where.id };
        }
        const unique = args.where.parentId_childId!;
        state.personChildUpdate.push({
          where: { parentId_childId: unique },
          data: { orderIndex: args.data.orderIndex as number },
        });
        const row = state.childEdges.find(
          (edge) => edge.parentId === unique.parentId && edge.childId === unique.childId,
        );
        if (row) row.orderIndex = args.data.orderIndex as number;
        return { id: "pc-baru" };
      },
      findUnique: async (args: { where: { id: string } }) =>
        state.childEdges.find((row) => row.id === args.where.id) ?? null,
    },
    personPartner: {
      count: async () => state.partnerCount,
      create: async (args: {
        data: { partnerAId: string; partnerBId: string; status: string; orderIndex: number };
      }) => {
        state.personPartnerCreate.push(args);
        return { id: "pp-baru" };
      },
      findUnique: async (args: { where: { id: string } }) =>
        state.partnerEdges.find((row) => row.id === args.where.id) ?? null,
      findMany: async (args: { where?: { OR?: Array<Record<string, string>> } }) => {
        const or = args?.where?.OR ?? [];
        return state.partnerEdges.filter((row) =>
          or.some(
            (clause) =>
              (clause.partnerAId === undefined || clause.partnerAId === row.partnerAId) &&
              (clause.partnerBId === undefined || clause.partnerBId === row.partnerBId),
          ),
        );
      },
      findFirst: async (args: { where?: { OR?: Array<Record<string, string>> } }) => {
        const or = args?.where?.OR ?? [];
        return (
          state.partnerEdges.find((row) =>
            or.some(
              (clause) =>
                (clause.partnerAId === undefined || clause.partnerAId === row.partnerAId) &&
                (clause.partnerBId === undefined || clause.partnerBId === row.partnerBId),
            ),
          ) ?? null
        );
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        state.partnerUpdate.push(args);
        return { id: args.where.id };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<string>) => fn(prismaPalsu),
  };

  const prismaModule = { prisma: prismaPalsu };
  const authModule = { auth: async () => ({ user: { id: "u1" } }) };
  const auditModule = {
    logAudit: async (args: { action: string; entityId: string; actorUserId: string }) => {
      state.auditCalls.push(args);
    },
  };
  const genealogyModule = { recalculateGenerationLevel: async () => null };
  // Bungkus modul asli: fungsi bantu lain tetap nyata, `moveChild` diganti
  // spy supaya tes dapat mengamati pemanggilan dan mengatur hasilnya.
  const childOrderModule = {
    ...(nodeRequire("@/lib/child-order") as Record<string, unknown>),
    moveChild: async (childId: string, direction: string) => {
      state.moveChildCalls.push({ childId, direction });
      return state.moveChildResult;
    },
  };

  const rbac = loadModule("src/lib/rbac.ts", (id) =>
    id === "@/lib/prisma" ? prismaModule : nodeRequire(id),
  );

  return loadModule("src/app/api/admin/relasi/route.ts", (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return prismaModule;
    if (id === "@/lib/audit") return auditModule;
    if (id === "@/lib/genealogy") return genealogyModule;
    if (id === "@/lib/child-order") return childOrderModule;
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

test("reorder-child memanggil moveChild, menulis audit, dan membalas ok (200)", async () => {
  const state = relasiFixture();
  state.person = { id: "C", branchId: "cabang-1", gender: "MALE" };
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({ action: "reorder-child", childId: "C", direction: "up" }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(state.moveChildCalls, [{ childId: "C", direction: "up" }]);
  assert.equal(state.auditCalls.length, 1);
  assert.equal(state.auditCalls[0].action, "RELATION_REORDER_CHILD");
  assert.equal(state.auditCalls[0].entityId, "C");
  assert.equal(state.auditCalls[0].actorUserId, "u1");
});

test("reorder-child dengan direction tidak valid ditolak dan moveChild tidak dipanggil (400)", async () => {
  const state = relasiFixture();
  state.person = { id: "C", branchId: "cabang-1", gender: "MALE" };
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({ action: "reorder-child", childId: "C", direction: "kiri" }),
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "childId dan direction (\"up\" atau \"down\") diperlukan");
  assert.equal(state.moveChildCalls.length, 0);
  assert.equal(state.auditCalls.length, 0);
});

test("reorder-child saat moveChild mengembalikan false dibalas 409 (409)", async () => {
  const state = relasiFixture();
  state.person = { id: "C", branchId: "cabang-1", gender: "MALE" };
  state.moveChildResult = false;
  const route = loadRelasiRoute(state);

  const response = await route.POST!(
    postRequest({ action: "reorder-child", childId: "C", direction: "down" }),
  );

  assert.equal(response.status, 409);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Anak tidak ditemukan atau sudah berada di urutan paling ujung.");
  assert.deepEqual(state.moveChildCalls, [{ childId: "C", direction: "down" }]);
  assert.equal(state.auditCalls.length, 0);
});

// ── harness `edit-relation` & `edit-partner` ─────────────────────────────

test("edit-relation menolak ganti anak yang membentuk siklus (409)", async () => {
  const state = relasiFixture();
  state.childEdges.push({ id: "e1", parentId: "fokus", childId: "anak", orderIndex: 0 });
  // "anak" adalah leluhur "cucu"; jadikan cucu anak baru fokus -> siklus
  state.childEdges.push({ id: "e2", parentId: "anak", childId: "cucu", orderIndex: 0 });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "edit-relation", edgeId: "e1", relationType: "child", newTargetPersonId: "cucu",
  }));
  assert.equal(res.status, 409);
});

test("edit-relation menolak anak yang sudah punya 2 orang tua (409)", async () => {
  const state = relasiFixture();
  state.childEdges.push({ id: "e1", parentId: "fokus", childId: "anak", orderIndex: 0 });
  state.childEdges.push({ id: "e2", parentId: "lain", childId: "target", orderIndex: 0 });
  state.childEdges.push({ id: "e3", parentId: "lain2", childId: "target", orderIndex: 0 });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "edit-relation", edgeId: "e1", relationType: "child", newTargetPersonId: "target",
  }));
  assert.equal(res.status, 409);
});

test("edit-relation memperbarui atribut relasi tanpa ganti orang", async () => {
  const state = relasiFixture();
  state.childEdges.push({ id: "e1", parentId: "fokus", childId: "anak", orderIndex: 0 });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "edit-relation", edgeId: "e1", relationType: "child", parentRole: "FATHER", isStep: true, isAdopted: false,
  }));
  assert.equal(res.status, 200);
  assert.equal(state.personChildUpdateFull.length, 1);
  assert.ok(state.auditCalls.some((c) => c.action === "RELATION_UPDATE_CHILD"));
});

test("edit-partner memperbarui status dan tanggal", async () => {
  const state = relasiFixture();
  state.partnerEdges.push({ id: "p1", partnerAId: "fokus", partnerBId: "pasangan", status: "MARRIED" });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "edit-partner", edgeId: "p1", status: "DIVORCED", divorceDate: "2024-05-01", notes: "pisah",
  }));
  assert.equal(res.status, 200);
  assert.equal(state.partnerUpdate.length, 1);
  assert.equal((state.partnerUpdate[0].data as { status: string }).status, "DIVORCED");
  assert.ok(state.auditCalls.some((c) => c.action === "RELATION_UPDATE_PARTNER"));
});

test("edit-partner menolak status tidak valid (400)", async () => {
  const state = relasiFixture();
  state.partnerEdges.push({ id: "p1", partnerAId: "fokus", partnerBId: "pasangan", status: "MARRIED" });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({ action: "edit-partner", edgeId: "p1", status: "PACARAN" }));
  assert.equal(res.status, 400);
});

test("edit-partner menolak pasangan duplikat (409)", async () => {
  const state = relasiFixture();
  state.partnerEdges.push({ id: "p1", partnerAId: "fokus", partnerBId: "pasangan", status: "MARRIED" });
  state.partnerEdges.push({ id: "p2", partnerAId: "fokus", partnerBId: "lain", status: "MARRIED" });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "edit-partner", edgeId: "p1", newPartnerId: "lain",
  }));
  assert.equal(res.status, 409);
});

// ── auto-link anak <-> pasangan pada `add` & `add-new` ───────────────────

test("add child menautkan anak ke pasangan tunggal orang tuanya", async () => {
  const state = relasiFixture();
  state.persons["pasangan"] = { id: "pasangan", branchId: "cabang-1", gender: "FEMALE" };
  state.partnerEdges.push({ id: "p1", partnerAId: "fokus", partnerBId: "pasangan", status: "MARRIED" });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "add", relationType: "child", personId: "fokus", targetPersonId: "anak",
  }));
  assert.equal(res.status, 200);
  assert.equal(state.personChildCreate.length, 2, "fokus->anak dan pasangan->anak");
  const created = state.personChildCreate.map((c) => c.data.parentId).sort();
  assert.deepEqual(created, ["fokus", "pasangan"]);
});

test("add child TIDAK menautkan bila orang tua punya dua pasangan", async () => {
  const state = relasiFixture();
  state.partnerEdges.push({ id: "p1", partnerAId: "fokus", partnerBId: "p1x", status: "MARRIED" });
  state.partnerEdges.push({ id: "p2", partnerAId: "fokus", partnerBId: "p2x", status: "MARRIED" });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "add", relationType: "child", personId: "fokus", targetPersonId: "anak",
  }));
  assert.equal(res.status, 200);
  assert.equal(state.personChildCreate.length, 1);
});

test("add pasangan menautkan anak tunggal orang tua ke pasangan terdaftar", async () => {
  const state = relasiFixture();
  state.persons["pasangan"] = { id: "pasangan", branchId: "cabang-1", gender: "FEMALE" };
  state.childEdges.push({ id: "e1", parentId: "fokus", childId: "anak", orderIndex: 0 });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "add", relationType: "partner", personId: "fokus", targetPersonId: "pasangan",
  }));
  assert.equal(res.status, 200);
  assert.ok(
    state.personChildCreate.some((c) => c.data.parentId === "pasangan" && c.data.childId === "anak"),
    "anak fokus harus ditautkan ke pasangan baru",
  );
});

test("add-new pasangan menautkan anak tunggal orang tua ke pasangan baru", async () => {
  const state = relasiFixture();
  state.childEdges.push({ id: "e1", parentId: "fokus", childId: "anak", orderIndex: 0 });
  const route = loadRelasiRoute(state);
  const res = await route.POST!(postRequest({
    action: "add-new", relationType: "partner", personId: "fokus", fullName: "Pasangan Baru", gender: "FEMALE",
  }));
  assert.equal(res.status, 201);
  assert.ok(
    state.personChildCreate.some((c) => c.data.parentId === "person-baru" && c.data.childId === "anak"),
    "anak fokus harus ditautkan ke pasangan baru",
  );
});
