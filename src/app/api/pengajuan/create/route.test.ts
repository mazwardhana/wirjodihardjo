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

type CreateState = {
  created: Array<Record<string, unknown>>;
  targetExists: boolean;
};

function createFixture(): CreateState {
  return { created: [], targetExists: true };
}

// `@/server/validations` dimuat asli supaya skema yang diuji memang skema
// produksi; `@/lib/prisma` dan sekutunya dipalsukan.
function loadCreateRoute(state: CreateState): { POST?: Handler } {
  const abs = resolve("src/app/api/pengajuan/create/route.ts");
  const nodeRequire = createRequire(abs);

  const prismaModule = {
    prisma: {
      user: {
        findUnique: async () => ({ id: "u1", personId: "person-1" }),
      },
      person: {
        findUnique: async () => (state.targetExists ? { id: "person-1" } : null),
      },
      submission: {
        create: async (args: { data: Record<string, unknown> }) => {
          state.created.push(args.data);
          return { id: "submission-1" };
        },
      },
    },
  };
  const authModule = { auth: async () => ({ user: { id: "u1" } }) };
  const auditModule = { logAudit: async () => undefined };
  const notificationsModule = { notifyAdminsOfNewSubmission: async () => undefined };

  // `submission.ts` diekstrak dulu lalu dipetakan: barrel `index.ts` memuat
  // `export ... from "./submission"`, dan pemetaan relatif adalah perangkap
  // yang sudah diketahui pada loader VM ini.
  const submissionModule = loadModule("src/server/validations/submission.ts", (id) =>
    nodeRequire(id),
  );
  const validations = loadModule("src/server/validations/index.ts", (id) =>
    id === "./submission" ? submissionModule : nodeRequire(id),
  );

  const routeModule = loadModule(abs, (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return prismaModule;
    if (id === "@/lib/audit") return auditModule;
    if (id === "@/lib/notifications") return notificationsModule;
    if (id === "@/server/validations") return validations;
    return nodeRequire(id);
  }) as { POST?: Handler };

  return routeModule;
}

test("ADD_PERSON diterima schemaByType dan tersimpan sebagai pengajuan", async () => {
  const state = createFixture();
  const route = loadCreateRoute(state);

  const response = await route.POST!(
    new Request("http://localhost/api/pengajuan/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "ADD_PERSON",
        fullName: "Anggota Baru",
        gender: "FEMALE",
      }),
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(state.created.length, 1);
  assert.equal(state.created[0].type, "ADD_PERSON");
  assert.equal(state.created[0].targetPersonId, null);
});

test("ADD_PERSON tanpa nama lengkap ditolak dan tidak menyimpan (400)", async () => {
  const state = createFixture();
  const route = loadCreateRoute(state);

  const response = await route.POST!(
    new Request("http://localhost/api/pengajuan/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "ADD_PERSON", gender: "FEMALE" }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(state.created.length, 0);
});

test("tipe pengajuan yang masih tidak dikenal tetap ditolak (400)", async () => {
  const state = createFixture();
  const route = loadCreateRoute(state);

  const response = await route.POST!(
    new Request("http://localhost/api/pengajuan/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "ADD_MYSTERY", fullName: "X", gender: "MALE" }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(state.created.length, 0);
});
