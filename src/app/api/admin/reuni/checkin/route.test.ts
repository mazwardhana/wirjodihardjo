import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

type Handler = (request: Request) => Promise<Response>;

type AuditCall = {
  action: string;
  entityType?: string;
  entityId?: string;
  afterData?: unknown;
};

type CheckInRow = {
  id: string;
  personId: string | null;
  checkedInAt: Date | null;
  checkInSource: string | null;
  checkInGroupId: string | null;
  person: {
    fullName: string;
    namaPanggilan: string | null;
    branch: { name: string; branchNumber: number } | null;
    user: { id: string } | null;
  } | null;
};

const URL_BASE = "http://localhost/api/admin/reuni/checkin";
const T1 = new Date("2026-10-09T02:00:00.000Z");
const T2 = new Date("2026-10-09T03:00:00.000Z");

let auditCalls: AuditCall[];
let approveCalls: { personId: string; actorUserId: string }[];
let cancelCalls: { registrationId: string; actorUserId: string }[];
let session: { user: { id: string } } | null;
let roles: Record<string, string>;
// `db.state.registrations` dipakai baik oleh tiruan prisma (GET) maupun tiruan
// cancelCheckIn, agar tes bisa memastikan baris tidak dihapus.
let db: { state: { registrations: CheckInRow[] } };
// Handler route yang sudah dimuat dengan tiruan; diisi ulang tiap tes.
let GET: Handler;
let POST: Handler;

function row(
  id: string,
  personId: string,
  groupId: string | null,
  source: string | null,
  fullName: string,
  namaPanggilan: string | null,
  user: { id: string } | null,
): CheckInRow {
  return {
    id,
    personId: `p-${id}`,
    checkedInAt: groupId === "g1" ? T1 : T2,
    checkInSource: source,
    checkInGroupId: groupId,
    person: {
      fullName,
      namaPanggilan,
      branch: { name: "Blitar", branchNumber: 1 },
      user,
    },
  };
}

beforeEach(() => {
  auditCalls = [];
  approveCalls = [];
  cancelCalls = [];
  session = null;
  roles = { u1: "SUPER_ADMIN", u2: "MEMBER" };
  mockRows([row("reg1", "p1", "g1", "QR_SELF", "Budi Santoso", "Budi", null)]);
});

// Ganti isi buku tamu untuk skenario tertentu.
function mockRows(registrations: CheckInRow[]) {
  db = { state: { registrations } };
}

function mockAuth(sessionUser: { id: string; role: string } | null) {
  if (sessionUser === null) {
    session = null;
  } else {
    roles[sessionUser.id] = sessionUser.role;
    session = { user: { id: sessionUser.id } };
  }
  loadCheckinRoute();
}

function req(query: string) {
  return new Request(`${URL_BASE}${query}`, { method: "GET" });
}

function json(body: Record<string, unknown>) {
  return new Request(URL_BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

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

function loadCheckinRoute() {
  const abs = resolve("src/app/api/admin/reuni/checkin/route.ts");
  const nodeRequire = createRequire(abs);

  const prisma = {
    user: {
      findUnique: async (args: { where: { id: string } }) => {
        const role = roles[args.where.id];
        return role ? { id: args.where.id, role, isActive: true } : null;
      },
    },
    reunionRegistration: {
      findMany: async () => db.state.registrations,
    },
  };

  const authModule = { auth: async () => session };
  const auditModule = {
    logAudit: async (params: AuditCall) => {
      auditCalls.push(params);
    },
  };
  // Tiruan buku-tamu: pembatalan hanya mengosongkan kolom, tidak menghapus.
  const bukuTamuModule = {
    approveWalkInAccount: async (
      _db: unknown,
      input: { personId: string; actorUserId: string },
    ) => {
      approveCalls.push(input);
      return { username: "budi.santoso" };
    },
    cancelCheckIn: async (
      _db: unknown,
      input: { registrationId: string; actorUserId: string },
    ) => {
      cancelCalls.push(input);
      const row = db.state.registrations.find((r) => r.id === input.registrationId);
      if (row) {
        row.checkedInAt = null;
        row.checkInSource = null;
        row.checkInGroupId = null;
      }
      return true;
    },
  };

  const loaded = loadModule("src/app/api/admin/reuni/checkin/route.ts", (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return { prisma };
    if (id === "@/lib/audit") return auditModule;
    if (id === "@/lib/buku-tamu") return bukuTamuModule;
    return nodeRequire(id);
  }) as { GET?: Handler; POST?: Handler };

  GET = loaded.GET!;
  POST = loaded.POST!;
}

test("GET menolak pengunjung tanpa sesi", async () => {
  mockAuth(null);
  assert.equal((await GET(req("?reunionId=r1"))).status, 401);
});

test("GET menolak pengguna MEMBER", async () => {
  mockAuth({ id: "u1", role: "MEMBER" });
  assert.equal((await GET(req("?reunionId=r1"))).status, 403);
});

test("GET mengelompokkan anggota menurut checkInGroupId", async () => {
  mockAuth({ id: "u1", role: "SUPER_ADMIN" });
  // Satu rombongan (g1) tiga orang, satu absen mandiri (g2).
  mockRows([
    row("reg1", "p1", "g1", "QR_SELF", "Budi Santoso", "Budi", null),
    row("reg2", "p2", "g1", "QR_SELF", "Ani Lestari", "Ani", { id: "u-ani" }),
    row("reg3", "p3", "g1", "ADMIN", "Cici Wirjo", null, { id: "u-cici" }),
    row("reg4", "p4", "g2", "QR_SELF", "Dedi Kurnia", "Ded", { id: "u-dedi" }),
  ]);
  const body = await (await GET(req("?reunionId=r1"))).json();
  assert.equal(body.groups.length, 2);
  assert.equal(body.groups[0].members.length, 3);
});

test("GET menandai tamu baru yang belum punya akun", async () => {
  mockAuth({ id: "u1", role: "SUPER_ADMIN" });
  mockRows([
    row("reg1", "p1", "g1", "QR_SELF", "Budi Santoso", "Budi", null),
    row("reg2", "p2", "g1", "QR_SELF", "Ani Lestari", "Ani", { id: "u-ani" }),
    row("reg3", "p3", "g1", "ADMIN", "Cici Wirjo", null, { id: "u-cici" }),
    row("reg4", "p4", "g2", "QR_SELF", "Dedi Kurnia", "Ded", { id: "u-dedi" }),
  ]);
  const body = await (await GET(req("?reunionId=r1"))).json();
  assert.deepEqual(body.pendingAccounts.map((p: { fullName: string }) => p.fullName), [
    "Budi Santoso",
  ]);
});

test("POST approve-account menulis audit log", async () => {
  mockAuth({ id: "u1", role: "SUPER_ADMIN" });
  const res = await POST(json({ action: "approve-account", personId: "p9" }));
  assert.equal(res.status, 200);
  assert.equal(auditCalls[0].action, "buku-tamu.approve-account");
});

test("POST cancel-checkin menulis audit log dan tidak menghapus baris", async () => {
  mockAuth({ id: "u1", role: "SUPER_ADMIN" });
  const res = await POST(json({ action: "cancel-checkin", registrationId: "reg1" }));
  assert.equal(res.status, 200);
  assert.equal(auditCalls[0].action, "buku-tamu.cancel-checkin");
  assert.equal(db.state.registrations.length, 1);
});
