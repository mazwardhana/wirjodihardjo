import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";

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

type ReviewState = {
  type: string;
  payload: Record<string, unknown>;
  targetBranchId: string | null;
  parent: { id: string; branchId: string | null } | null;
  submitterGender: string | null;
  partners: Array<{ partnerAId: string; partnerBId: string }>;
  childEdges: Array<{ parentId: string; childId: string }>;
  personCreate: Array<Record<string, any>>;
  personChildCreate: Array<Record<string, any>>;
  personChildUpdate: Array<Record<string, any>>;
  personChildDelete: Array<string>;
  personPartnerCreate: Array<Record<string, any>>;
  personPartnerUpdate: Array<Record<string, any>>;
  personPartnerDelete: Array<string>;
};

function reviewFixture(type: string, payload: Record<string, unknown>): ReviewState {
  return {
    type,
    payload,
    targetBranchId: "cabang-1",
    parent: { id: "orang-tua", branchId: "cabang-1" },
    submitterGender: "MALE",
    partners: [],
    childEdges: [],
    personCreate: [],
    personChildCreate: [],
    personChildUpdate: [],
    personChildDelete: [],
    personPartnerCreate: [],
    personPartnerUpdate: [],
    personPartnerDelete: [],
  };
}

function loadReviewRoute(state: ReviewState): { POST?: Handler } {
  const abs = resolve("src/app/api/pengajuan/review/route.ts");
  const nodeRequire = createRequire(abs);

  const prismaModule = {
    prisma: {
      user: {
        findUnique: async () => ({ id: "admin-1", role: "SUPER_ADMIN", branchAdminOf: null }),
      },
      submission: {
        findUnique: async (args: { where: { id: string } }) => {
          if (args.where.id !== "submission-1") return null;
          return {
            id: "submission-1",
            type: state.type,
            status: "PENDING",
            payload: state.payload,
            targetPerson: state.targetBranchId === null
              ? null
              : { id: "orang-tua", branchId: state.targetBranchId },
            submitter: { id: "u1", person: { gender: state.submitterGender } },
          };
        },
        update: async () => ({ id: "submission-1" }),
      },
      person: {
        findFirst: async () => null,
        findUnique: async () => state.parent,
        create: async (args: Record<string, any>) => {
          state.personCreate.push(args);
          return { id: "person-baru" };
        },
      },
      personChild: {
        findFirst: async () => null,
        findMany: async () => state.childEdges,
        count: async () => state.childEdges.length,
        create: async (args: Record<string, any>) => {
          state.personChildCreate.push(args);
          return { id: "edge-baru" };
        },
        update: async (args: Record<string, any>) => {
          state.personChildUpdate.push(args);
          return { id: "edge-baru" };
        },
        findUnique: async (args: { where: { id: string } }) =>
          args.where.id === "edge-ada" ? { id: "edge-ada", parentId: "orang-tua", childId: "anak" } : null,
        delete: async (args: { where: { id: string } }) => {
          state.personChildDelete.push(args.where.id);
          return { id: args.where.id };
        },
      },
      personPartner: {
        findFirst: async () => null,
        findMany: async () => state.partners,
        count: async () => state.partners.length,
        create: async (args: Record<string, any>) => {
          state.personPartnerCreate.push(args);
          return { id: "partner-baru" };
        },
        update: async (args: Record<string, any>) => {
          state.personPartnerUpdate.push(args);
          return { id: "partner-baru" };
        },
        findUnique: async (args: { where: { id: string } }) =>
          args.where.id === "partner-ada"
            ? { id: "partner-ada", partnerAId: "orang-tua", partnerBId: "pasangan" }
            : null,
        delete: async (args: { where: { id: string } }) => {
          state.personPartnerDelete.push(args.where.id);
          return { id: args.where.id };
        },
      },
    },
  };
  const authModule = { auth: async () => ({ user: { id: "admin-1" } }) };
  const auditModule = { logAudit: async () => undefined };
  const notificationsModule = { notifySubmissionStatus: async () => undefined };
  const genealogyModule = { recalculateGenerationLevel: async () => null };

  return loadModule(abs, (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return prismaModule;
    if (id === "@/lib/audit") return auditModule;
    if (id === "@/lib/notifications") return notificationsModule;
    if (id === "@/lib/genealogy") return genealogyModule;
    return nodeRequire(id);
  }) as { POST?: Handler };
}

function approveRequest() {
  return new Request("http://localhost/api/pengajuan/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "submission-1", action: "APPROVE" }),
  });
}

test("ADD_CHILD mengisi branchId anak dari orang tua (201)", async () => {
  const state = reviewFixture("ADD_CHILD", {
    parentId: "orang-tua",
    fullName: "Anak Baru",
    gender: "MALE",
  });
  const route = loadReviewRoute(state);

  const response = await route.POST!(approveRequest());

  assert.equal(response.status, 200);
  assert.equal(state.personCreate.length, 1);
  assert.equal(state.personCreate[0].data.branchId, "cabang-1");
  assert.equal(state.personChildCreate.length, 1);
  assert.equal(state.personChildCreate[0].data.parentId, "orang-tua");
});

test("ADD_CHILD menambah orang tua kedua bila orang tua punya tepat satu pasangan (201)", async () => {
  const state = reviewFixture("ADD_CHILD", {
    parentId: "orang-tua",
    fullName: "Anak Baru",
    gender: "MALE",
  });
  state.partners = [{ partnerAId: "orang-tua", partnerBId: "ibu" }];
  const route = loadReviewRoute(state);

  const response = await route.POST!(approveRequest());

  assert.equal(response.status, 200);
  assert.equal(state.personChildCreate.length, 2);
  assert.equal(state.personChildCreate[1].data.parentId, "ibu");
  assert.equal(state.personChildCreate[1].data.childId, "person-baru");
});

test("ADD_CHILD memakai gender pengaju untuk peran orang tua lalu membaliknya (201)", async () => {
  const state = reviewFixture("ADD_CHILD", {
    parentId: "orang-tua",
    fullName: "Anak Baru",
    gender: "FEMALE",
  });
  // `parentRole` sengaja tidak dikirim, jadi turun dari gender pengaju.
  state.submitterGender = "FEMALE";
  state.partners = [{ partnerAId: "orang-tua", partnerBId: "ibu" }];
  const route = loadReviewRoute(state);

  const response = await route.POST!(approveRequest());

  assert.equal(response.status, 200);
  assert.equal(state.personChildCreate.length, 2);
  assert.equal(state.personChildCreate[0].data.parentRole, "MOTHER");
  assert.equal(state.personChildCreate[1].data.parentRole, "FATHER");
});

test("ADD_SPOUSE mengisi branchId pasangan dari anggota (201)", async () => {
  const state = reviewFixture("ADD_SPOUSE", {
    personId: "orang-tua",
    fullName: "Pasangan Baru",
    gender: "FEMALE",
  });
  const route = loadReviewRoute(state);

  const response = await route.POST!(approveRequest());

  assert.equal(response.status, 200);
  assert.equal(state.personCreate.length, 1);
  assert.equal(state.personCreate[0].data.branchId, "cabang-1");
  assert.equal(state.personCreate[0].data.isMarriedInto, true);
  assert.equal(state.personPartnerCreate.length, 1);
});

test("EDIT_RELATION add parent membuat edge dan tidak melempar belum diimplementasikan (201)", async () => {
  const state = reviewFixture("EDIT_RELATION", {
    personId: "anak",
    relationType: "parent",
    action: "add",
    targetPersonId: "orang-tua",
  });
  const route = loadReviewRoute(state);

  const response = await route.POST!(approveRequest());

  assert.equal(response.status, 200);
  assert.equal(state.personChildCreate.length, 1);
  assert.equal(state.personChildCreate[0].data.parentId, "orang-tua");
  assert.equal(state.personChildCreate[0].data.childId, "anak");
});

test("EDIT_RELATION remove parent menghapus edge (201)", async () => {
  const state = reviewFixture("EDIT_RELATION", {
    personId: "anak",
    relationType: "parent",
    action: "remove",
    edgeId: "edge-ada",
  });
  const route = loadReviewRoute(state);

  const response = await route.POST!(approveRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(state.personChildDelete, ["edge-ada"]);
});

test("EDIT_RELATION update parent mengubah peran (201)", async () => {
  const state = reviewFixture("EDIT_RELATION", {
    personId: "anak",
    relationType: "parent",
    action: "update",
    edgeId: "edge-ada",
    role: "MOTHER",
  });
  const route = loadReviewRoute(state);

  const response = await route.POST!(approveRequest());

  assert.equal(response.status, 200);
  assert.equal(state.personChildUpdate.length, 1);
  assert.equal(state.personChildUpdate[0].data.parentRole, "MOTHER");
});

test("EDIT_RELATION add parent menolak siklus dengan pesan bahasa Indonesia (500)", async () => {
  const state = reviewFixture("EDIT_RELATION", {
    personId: "orang-tua",
    relationType: "parent",
    action: "add",
    targetPersonId: "anak",
  });
  // `anak` adalah keturunan `orang-tua`, jadi menambahkan `anak` sebagai orang
  // tua `orang-tua` membentuk siklus.
  state.childEdges = [{ parentId: "orang-tua", childId: "anak" }];
  const route = loadReviewRoute(state);

  const response = await route.POST!(approveRequest());

  assert.equal(response.status, 500);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Gagal menerapkan: Relasi ini akan membentuk siklus silsilah yang tidak valid.");
});
