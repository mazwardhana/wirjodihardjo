import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ParsedRegistrasi, RegistrasiImportRow } from "./types";

// ── Mock batas database ───────────────────────────────────────────────────────
// `commitRegistrasiImport` memakai `prisma` global, jadi tes memasang Prisma
// palsu sebelum modul diimpor (pola sama seperti importer.test).

type Row = Record<string, unknown>;
type Call = { model: string; op: string; args: unknown };

type PersonCreate = { fullName: string; namaPanggilan: string; branchId: string };
type UserCreate = { username: string; role: string; mustChangeCredentials: boolean; personId: string };
type RegCreate = { reunionId: string | null; userId: string; guestCount: number; status: string };

let batch: Row | null;
let actor: Row | null;
let branches: Row[];
let existingPeople: Row[];
let takenUsers: Row[];
let reunionRow: Row | null;
let failTransactionWith: unknown;

let personCreates: PersonCreate[];
let userCreates: UserCreate[];
let regCreates: RegCreate[];
let batchUpdateArgs: { where: Row; data: Row } | null;
let auditArgs: Row | null;
let transactionOptions: Row | undefined;
let queryRawCalls: unknown[];

const tx = {
  async $queryRaw(strings: unknown, ...values: unknown[]) {
    queryRawCalls.push({ strings, values });
    return [];
  },
  branch: {
    async findMany() {
      return branches;
    },
  },
  person: {
    async findMany() {
      return existingPeople;
    },
    async create({ data }: { data: PersonCreate }) {
      personCreates.push(data);
      return { id: `person-${personCreates.length}` };
    },
  },
  user: {
    async findUnique() {
      return actor;
    },
    async findMany() {
      return takenUsers;
    },
    async create({ data }: { data: UserCreate }) {
      userCreates.push(data);
      return { id: `user-${userCreates.length}` };
    },
  },
  reunion: {
    async findUnique() {
      return reunionRow;
    },
  },
  reunionRegistration: {
    async create({ data }: { data: RegCreate }) {
      regCreates.push(data);
      return { id: `reg-${regCreates.length}` };
    },
  },
  registrationBatch: {
    async create() {
      return { id: "regbatch-1" };
    },
  },
  importBatch: {
    async findUnique() {
      return batch;
    },
    async update(args: { where: Row; data: Row }) {
      batchUpdateArgs = args;
      return {};
    },
  },
  auditLog: {
    async create({ data }: { data: Row }) {
      auditArgs = data;
      return {};
    },
  },
};

const fakePrisma = {
  async $transaction(fn: (tx: unknown) => Promise<unknown>, options: Row) {
    transactionOptions = options;
    if (failTransactionWith) throw failTransactionWith;
    return fn(tx);
  },
};

let globalCache: typeof globalThis & { prisma?: PrismaClient };
let previousPrisma: PrismaClient | undefined;
let commitRegistrasiImport: typeof import("./commit").commitRegistrasiImport;
let RegistrasiImportError: typeof import("./commit").RegistrasiImportError;

function importRow(overrides: Partial<RegistrasiImportRow> = {}): RegistrasiImportRow {
  return {
    _row: 2,
    cabangKe: "1",
    namaPanggilan: "Budi",
    namaLengkap: "Budi Santoso",
    gender: "L",
    status: "hidup",
    hadir: "ya",
    ...overrides,
  };
}

function parsed(...rows: RegistrasiImportRow[]): ParsedRegistrasi {
  return { rows };
}

function validBatch(overrides: { status?: string; type?: string; payload?: Record<string, unknown> } = {}) {
  return {
    id: "batch-1",
    status: overrides.status ?? "VALIDATED",
    type: overrides.type ?? "REGISTRASI",
    reportJson: {
      filename: "data.xlsx",
      data: parsed(importRow()),
      errors: [],
      warnings: [],
      credentials: [],
      skipped: [],
      counts: { total: 1, personsCreated: 1, accountsCreated: 1, attendeesPlanned: 1, rowsSkipped: 0 },
      reunionId: "reunion-1",
      ...overrides.payload,
    },
  };
}

function reset() {
  batch = validBatch();
  actor = { id: "admin-1", isActive: true, role: "SUPER_ADMIN", mustChangeCredentials: false };
  branches = [{ id: "b1", name: "Cabang Satu", branchNumber: 1, slug: "cabang-satu", isActive: true }];
  existingPeople = [];
  takenUsers = [];
  reunionRow = { id: "reunion-fallback" };
  failTransactionWith = null;

  personCreates = [];
  userCreates = [];
  regCreates = [];
  batchUpdateArgs = null;
  auditArgs = null;
  transactionOptions = undefined;
  queryRawCalls = [];
}

before(async () => {
  reset();
  globalCache = globalThis as typeof globalThis & { prisma?: PrismaClient };
  previousPrisma = globalCache.prisma;
  globalCache.prisma = fakePrisma as unknown as PrismaClient;

  const module = await import("./commit");
  commitRegistrasiImport = module.commitRegistrasiImport;
  RegistrasiImportError = module.RegistrasiImportError;
});

after(() => {
  if (previousPrisma === undefined) delete globalCache.prisma;
  else globalCache.prisma = previousPrisma;
});

beforeEach(reset);

describe("commitRegistrasiImport — happy path", () => {
  test("locks the batch row and runs a serializable transaction with timeouts", async () => {
    await commitRegistrasiImport("batch-1", "admin-1");
    assert.strictEqual(queryRawCalls.length, 1, "row lock harus dijalankan sekali");
    assert.ok(transactionOptions, "opsi transaksi harus diberikan");
    assert.strictEqual(transactionOptions!.isolationLevel, "Serializable");
    assert.strictEqual(transactionOptions!.timeout, 120_000);
    assert.strictEqual(transactionOptions!.maxWait, 10_000);
  });

  test("creates person, account and reunion registration via createRegistrationsInTx", async () => {
    const result = await commitRegistrasiImport("batch-1", "admin-1");
    assert.strictEqual(personCreates.length, 1);
    assert.strictEqual(personCreates[0].fullName, "Budi Santoso");
    assert.strictEqual(personCreates[0].branchId, "b1");
    assert.strictEqual(userCreates.length, 1);
    assert.strictEqual(userCreates[0].username, "budi");
    assert.strictEqual(userCreates[0].role, "MEMBER");
    assert.strictEqual(userCreates[0].mustChangeCredentials, true);
    assert.strictEqual(regCreates.length, 1);
    assert.strictEqual(regCreates[0].reunionId, "reunion-1");
    assert.strictEqual(regCreates[0].status, "CONFIRMED");
    assert.strictEqual(result.counts.personsCreated, 1);
    assert.strictEqual(result.counts.accountsCreated, 1);
    assert.strictEqual(result.counts.attendeesPlanned, 1);
    assert.strictEqual(result.counts.rowsSkipped, 0);
  });

  test("marks the batch COMMITTED with success rows and actual usernames", async () => {
    await commitRegistrasiImport("batch-1", "admin-1");
    assert.ok(batchUpdateArgs, "batch harus diperbarui");
    assert.deepStrictEqual(batchUpdateArgs!.where, { id: "batch-1" });
    assert.strictEqual(batchUpdateArgs!.data.status, "COMMITTED");
    assert.strictEqual(batchUpdateArgs!.data.successRows, 1);
    assert.strictEqual(batchUpdateArgs!.data.errorRows, 0);
    const report = batchUpdateArgs!.data.reportJson as Record<string, unknown>;
    assert.deepStrictEqual(report.plannedUsernames, { "b1::budi santoso": "budi" });
    const credentials = report.credentials as { status: string; username: string }[];
    assert.strictEqual(credentials.length, 1);
    assert.strictEqual(credentials[0].status, "dibuat");
    assert.strictEqual(credentials[0].username, "budi");
  });

  test("writes a REGISTRASI_IMPORT_COMMIT audit log", async () => {
    await commitRegistrasiImport("batch-1", "admin-1");
    assert.ok(auditArgs, "audit harus dicatat");
    assert.strictEqual(auditArgs!.action, "REGISTRASI_IMPORT_COMMIT");
    assert.strictEqual(auditArgs!.entityType, "ImportBatch");
    assert.strictEqual(auditArgs!.entityId, "batch-1");
    assert.strictEqual(auditArgs!.actorUserId, "admin-1");
  });

  test("falls back to the reunion slug lookup when payload has no reunionId", async () => {
    batch = validBatch({ payload: { reunionId: undefined } });
    await commitRegistrasiImport("batch-1", "admin-1");
    assert.strictEqual(regCreates.length, 1);
    assert.strictEqual(regCreates[0].reunionId, "reunion-fallback");
  });

  test("skipped rows are reported and not created", async () => {
    existingPeople = [{ branchId: "b1", fullName: "Budi Santoso" }];
    const result = await commitRegistrasiImport("batch-1", "admin-1");
    assert.strictEqual(personCreates.length, 0);
    assert.strictEqual(result.counts.rowsSkipped, 1);
    assert.strictEqual(result.counts.personsCreated, 0);
    assert.strictEqual(result.skipped.length, 1);
    assert.strictEqual(result.skipped[0].reason, "sudah ada, dilewati");
    const report = batchUpdateArgs!.data.reportJson as Record<string, unknown>;
    const credentials = report.credentials as { status: string; username: string }[];
    assert.ok(credentials.some((c) => c.status === "sudah ada, dilewati" && c.username === ""));
  });

  test("reunion registration is not created for deceased attendees", async () => {
    batch = validBatch({
      payload: { data: parsed(importRow({ status: "wafat", hadir: "ya" })) },
    });
    const result = await commitRegistrasiImport("batch-1", "admin-1");
    assert.strictEqual(regCreates.length, 0);
    assert.strictEqual(result.counts.attendeesPlanned, 0);
  });
});

describe("commitRegistrasiImport — guard errors", () => {
  test("missing batch -> 404", async () => {
    batch = null;
    await assert.rejects(
      () => commitRegistrasiImport("batch-1", "admin-1"),
      (error: InstanceType<typeof RegistrasiImportError>) => {
        assert.ok(error instanceof RegistrasiImportError);
        assert.strictEqual(error.status, 404);
        return true;
      },
    );
  });

  test("batch already processed -> 409", async () => {
    batch = validBatch({ status: "COMMITTED" });
    await assert.rejects(
      () => commitRegistrasiImport("batch-1", "admin-1"),
      (error: InstanceType<typeof RegistrasiImportError>) => {
        assert.strictEqual(error.status, 409);
        return true;
      },
    );
  });

  test("wrong batch type -> 409", async () => {
    batch = validBatch({ type: "PERSON_FULL" });
    await assert.rejects(
      () => commitRegistrasiImport("batch-1", "admin-1"),
      (error: InstanceType<typeof RegistrasiImportError>) => {
        assert.strictEqual(error.status, 409);
        return true;
      },
    );
  });

  test("non-superadmin actor -> 403", async () => {
    actor = { id: "admin-1", isActive: true, role: "MEMBER", mustChangeCredentials: false };
    await assert.rejects(
      () => commitRegistrasiImport("batch-1", "admin-1"),
      (error: InstanceType<typeof RegistrasiImportError>) => {
        assert.strictEqual(error.status, 403);
        assert.strictEqual(error.message, "Akses impor ditolak.");
        return true;
      },
    );
  });

  test("inactive or must-change-credentials superadmin -> 403", async () => {
    actor = { id: "admin-1", isActive: false, role: "SUPER_ADMIN", mustChangeCredentials: false };
    await assert.rejects(() => commitRegistrasiImport("batch-1", "admin-1"), /Akses impor ditolak/);
    actor = { id: "admin-1", isActive: true, role: "SUPER_ADMIN", mustChangeCredentials: true };
    await assert.rejects(() => commitRegistrasiImport("batch-1", "admin-1"), /Akses impor ditolak/);
  });

  test("missing payload data -> error", async () => {
    batch = { id: "batch-1", status: "VALIDATED", type: "REGISTRASI", reportJson: null };
    await assert.rejects(() => commitRegistrasiImport("batch-1", "admin-1"), /Data batch tidak lengkap|tidak lengkap/i);
  });

  test("invalid stored payload -> 400 with 'Perbaiki file'", async () => {
    batch = validBatch({ payload: { data: parsed(importRow({ gender: "" })) } });
    await assert.rejects(
      () => commitRegistrasiImport("batch-1", "admin-1"),
      (error: InstanceType<typeof RegistrasiImportError>) => {
        assert.strictEqual(error.status, 400);
        assert.strictEqual(error.message, "Perbaiki file dan unggah ulang.");
        assert.ok(error.errors.length > 0);
        return true;
      },
    );
  });

  test("Prisma P2034 is mapped to a 409 retry error", async () => {
    failTransactionWith = new Prisma.PrismaClientKnownRequestError("Serialization failure", {
      code: "P2034",
      clientVersion: "test",
    });
    await assert.rejects(
      () => commitRegistrasiImport("batch-1", "admin-1"),
      (error: InstanceType<typeof RegistrasiImportError>) => {
        assert.strictEqual(error.status, 409);
        assert.match(error.message, /Muat ulang laporan/);
        return true;
      },
    );
  });
});
