import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";

type Handler = (request: Request) => Promise<Response>;

type PersonRow = {
  id: string;
  fullName: string;
  user: { id: string } | null;
};

type RegistrationRow = {
  id: string;
  status: string;
  attendance: string;
} | null;

const REUNION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function loadModule(filename: string, requireMap: (id: string) => unknown) {
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

function registrationsFixture() {
  const state = {
    session: { user: { id: "u1" } } as { user: { id: string } } | null,
    roles: { u1: "SUPER_ADMIN", u2: "MEMBER" } as Record<string, string>,
    existing: {
      id: "reg-1",
      status: "CONFIRMED",
      attendance: "ATTENDING",
    } as RegistrationRow,
    updateCalls: [] as { where: { id: string }; data: Record<string, unknown> }[],
    createCalls: [] as { data: Record<string, unknown> }[],
    auditCalls: [] as { action: string; beforeData?: unknown; afterData?: unknown }[],
    // Peta baris pendaftaran per pasangan (reunionId, personId) / userId.
    duplicates: [] as Array<{ reunionId: string; personId?: string; userId?: string }>,
    people: {
      [PERSON_ID]: {
        id: PERSON_ID,
        fullName: "Budi Santoso",
        user: { id: "user-budi" },
      } as PersonRow,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc": {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        fullName: "Siti Aminah",
        user: null,
      } as PersonRow,
    } as Record<string, PersonRow>,
  };

  const prisma = {
    user: {
      findUnique: async (args: { where: { id: string } }) => {
        const role = state.roles[args.where.id];
        return role ? { id: args.where.id, role } : null;
      },
    },
    person: {
      findUnique: async (args: { where: { id: string } }) =>
        state.people[args.where.id] ?? null,
    },
    reunionRegistration: {
      findUnique: async (args: { where: { id: string } }) =>
        state.existing && state.existing.id === args.where.id ? state.existing : null,
      findFirst: async (args: {
        where: { reunionId: string; OR: Array<{ personId?: string; userId?: string }> };
      }) => {
        const clash = state.duplicates.find((d) =>
          args.where.OR.some(
            (cond) =>
              (cond.personId && d.personId === cond.personId) ||
              (cond.userId && d.userId === cond.userId),
          ),
        );
        return clash ? { id: "reg-duplikat" } : null;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        state.updateCalls.push(args);
        return {
          id: args.where.id,
          status: (args.data.status as string) ?? state.existing?.status,
          attendance: (args.data.attendance as string) ?? state.existing?.attendance,
        };
      },
      create: async (args: { data: Record<string, unknown> }) => {
        state.createCalls.push(args);
        return { id: "reg-baru", ...args.data };
      },
    },
  };

  const audit = {
    logAudit: async (params: { action: string; beforeData?: unknown; afterData?: unknown }) => {
      state.auditCalls.push(params);
    },
  };

  return { state, prisma, audit };
}

// Memuat route asli dengan auth, persistence, dan audit diganti mock.
function loadRegistrationsRoute(fixture: ReturnType<typeof registrationsFixture>) {
  const abs = resolve("src/app/api/admin/reuni/registrations/route.ts");
  const nodeRequire = createRequire(abs);

  const prismaModule = { prisma: fixture.prisma };
  const authModule = { auth: async () => fixture.state.session };

  return loadModule("src/app/api/admin/reuni/registrations/route.ts", (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return prismaModule;
    if (id === "@/lib/audit") return fixture.audit;
    return nodeRequire(id);
  }) as { POST?: Handler; PUT?: Handler; DELETE?: Handler };
}

// Objek yang dibuat di dalam konteks vm punya prototipe berbeda dari objek
// Node, jadi `deepEqual` menganggapnya tidak sama. Menyalin lewat JSON membuat
// perbandingan struktur jadi jujur.
function plain<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const URL_BASE = "http://localhost/api/admin/reuni/registrations";

function putRequest(body: Record<string, unknown>) {
  return new Request(URL_BASE, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function postRequest(body: Record<string, unknown>) {
  return new Request(URL_BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("PUT menerima attendance dan tidak menyentuh status", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);
  const response = await route.PUT!(
    putRequest({ id: "reg-1", attendance: "NOT_ATTENDING" }),
  );

  assert.equal(response.status, 200);
  assert.equal(f.state.updateCalls.length, 1);
  // Proima menerima `undefined` sebagai "jangan sentuh kolom ini", jadi yang
  // dicek adalah nilai kolomnya, bukan keberadaan kuncinya.
  const data = f.state.updateCalls[0].data;
  assert.equal(data.attendance, "NOT_ATTENDING");
  assert.equal(data.status, undefined, "status tidak ikut ditulis");
});

test("PUT mencatat audit dengan aksi ATTENDANCE_SET", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);
  await route.PUT!(putRequest({ id: "reg-1", attendance: "ATTENDING" }));

  const actions = f.state.auditCalls.map((c) => c.action);
  assert.deepEqual(actions, ["ATTENDANCE_SET"]);
  const call = f.state.auditCalls[0];
  assert.deepEqual(plain(call.beforeData), { attendance: "ATTENDING" });
  assert.deepEqual(plain(call.afterData), { attendance: "ATTENDING" });
});

test("PUT menolak nilai attendance yang tidak dikenal (400)", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);
  const response = await route.PUT!(putRequest({ id: "reg-1", attendance: "MUNGKIN" }));

  assert.equal(response.status, 400);
  assert.equal(f.state.updateCalls.length, 0);
});

test("PUT tanpa status maupun attendance ditolak (400)", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);
  const response = await route.PUT!(putRequest({ id: "reg-1" }));

  assert.equal(response.status, 400);
  assert.equal(f.state.updateCalls.length, 0);
});

test("PUT status dan attendance sekaligus menulis keduanya", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);
  await route.PUT!(
    putRequest({ id: "reg-1", status: "CANCELLED", attendance: "NOT_ATTENDING" }),
  );

  assert.deepEqual(plain(f.state.updateCalls[0].data), {
    status: "CANCELLED",
    attendance: "NOT_ATTENDING",
  });
  assert.deepEqual(
    f.state.auditCalls.map((c) => c.action).sort(),
    ["ATTENDANCE_SET", "REGISTRATION_CANCEL"],
  );
});

test("PUT tanpa sesi ditolak (401)", async () => {
  const f = registrationsFixture();
  f.state.session = null;
  const route = loadRegistrationsRoute(f);
  const response = await route.PUT!(putRequest({ id: "reg-1", attendance: "ATTENDING" }));
  assert.equal(response.status, 401);
});

test("PUT ke pendaftaran yang tidak ada ditolak (404)", async () => {
  const f = registrationsFixture();
  f.state.existing = null;
  const route = loadRegistrationsRoute(f);
  const response = await route.PUT!(putRequest({ id: "reg-1", attendance: "ATTENDING" }));
  assert.equal(response.status, 404);
});

test("POST membuat pendaftaran manual terkonfirmasi dan hadir (201)", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);
  const response = await route.POST!(
    postRequest({ reunionId: REUNION_ID, personId: PERSON_ID }),
  );

  assert.equal(response.status, 201);
  assert.equal(f.state.createCalls.length, 1);
  assert.deepEqual(plain(f.state.createCalls[0].data), {
    reunionId: REUNION_ID,
    personId: PERSON_ID,
    userId: "user-budi",
    status: "CONFIRMED",
    attendance: "ATTENDING",
    guestCount: 1,
  });
  assert.equal(
    f.state.auditCalls[0].action,
    "REGISTRATION_CREATE_MANUAL",
  );
});

test("POST memakai userId null untuk anggota tanpa akun", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);
  await route.POST!(
    postRequest({
      reunionId: REUNION_ID,
      personId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    }),
  );

  assert.equal(f.state.createCalls[0].data.userId, null);
  assert.equal(f.state.createCalls[0].data.personId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
});

test("POST menolak anggota yang sudah terdaftar (409)", async () => {
  const f = registrationsFixture();
  f.state.duplicates.push({ reunionId: REUNION_ID, personId: PERSON_ID });
  const route = loadRegistrationsRoute(f);
  const response = await route.POST!(
    postRequest({ reunionId: REUNION_ID, personId: PERSON_ID }),
  );

  assert.equal(response.status, 409);
  assert.equal(f.state.createCalls.length, 0);
});

test("POST menolak anggota yang akunnya sudah terdaftar di reuni itu (409)", async () => {
  const f = registrationsFixture();
  f.state.duplicates.push({ reunionId: REUNION_ID, userId: "user-budi" });
  const route = loadRegistrationsRoute(f);
  const response = await route.POST!(
    postRequest({ reunionId: REUNION_ID, personId: PERSON_ID }),
  );

  assert.equal(response.status, 409);
  assert.equal(f.state.createCalls.length, 0);
});

test("POST menolak anggota yang tidak ada (404)", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);
  const response = await route.POST!(
    postRequest({ reunionId: REUNION_ID, personId: "tidak-ada" }),
  );

  assert.equal(response.status, 404);
  assert.equal(f.state.createCalls.length, 0);
});

test("POST tanpa id yang lengkap ditolak (400)", async () => {
  const f = registrationsFixture();
  const route = loadRegistrationsRoute(f);

  assert.equal((await route.POST!(postRequest({ personId: PERSON_ID }))).status, 400);
  assert.equal(
    (await route.POST!(postRequest({ reunionId: REUNION_ID }))).status,
    400,
  );
  assert.equal(f.state.createCalls.length, 0);
});

test("POST tanpa sesi ditolak (401)", async () => {
  const f = registrationsFixture();
  f.state.session = null;
  const route = loadRegistrationsRoute(f);
  const response = await route.POST!(
    postRequest({ reunionId: REUNION_ID, personId: PERSON_ID }),
  );
  assert.equal(response.status, 401);
});