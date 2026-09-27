import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ImportRowAnggota, ParsedData, ValidationError } from "../src/lib/import/types";

type Row = Record<string, unknown>;
type Table = "person" | "personPrivate" | "branch" | "user" | "importBatch" | "auditLog";
type Query = { where?: Row; data?: Row; update?: Row; create?: Row; select?: Row };
const tables: Table[] = ["person", "personPrivate", "branch", "user", "importBatch", "auditLog"];
const actorId = "actor";
const batchId = "batch";
let state: Record<Table, Row[]>;
let calls: string[];
let sequence = 0;
let transactionTail = Promise.resolve();
let injectedFailure: { operation: string; error: Error } | undefined;
let importer: typeof import("../src/lib/import/importer");

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return (expected as Row[]).some(condition => matches(row, condition));
    if (expected && typeof expected === "object") {
      const filter = expected as Row;
      if ("in" in filter) return (filter.in as unknown[]).includes(row[key]);
      if ("equals" in filter) return filter.mode === "insensitive"
        ? String(row[key]).toLowerCase() === String(filter.equals).toLowerCase()
        : row[key] === filter.equals;
      assert.fail(`Unsupported mock filter: ${key}`);
    }
    return row[key] === expected;
  });
}

function defined(data: Row = {}): Row {
  return structuredClone(Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
}

function operation(name: string) {
  calls.push(name);
  if (injectedFailure?.operation === name) throw injectedFailure.error;
}

function delegate(table: Table) {
  const find = (where?: Row) => state[table].find(row => matches(row, where));
  return {
    async findUnique({ where }: Query) {
      operation(`${table}.findUnique`);
      return structuredClone(find(where) ?? null);
    },
    async findFirst({ where }: Query) {
      operation(`${table}.findFirst`);
      return structuredClone(find(where) ?? null);
    },
    async findMany({ where }: Query = {}) {
      operation(`${table}.findMany`);
      return structuredClone(state[table].filter(row => matches(row, where)));
    },
    async create({ data }: Query) {
      operation(`${table}.create`);
      const row = { id: `created-${++sequence}`, ...defined(data) };
      state[table].push(row);
      return structuredClone(row);
    },
    async update({ where, data }: Query) {
      operation(`${table}.update`);
      const row = find(where);
      assert.ok(row, `Missing ${table} row for update`);
      Object.assign(row, defined(data));
      return structuredClone(row);
    },
    async upsert({ where, update, create }: Query) {
      operation(`${table}.upsert`);
      let row = find(where);
      if (row) Object.assign(row, defined(update));
      else {
        row = { id: `created-${++sequence}`, ...defined(create) };
        state[table].push(row);
      }
      return structuredClone(row);
    },
  };
}

const transactionClient = {
  ...Object.fromEntries(tables.map(table => [table, delegate(table)])),
  async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
    operation("$queryRaw");
    assert.match(strings.join("?"), /SELECT "id" FROM "ImportBatch" WHERE "id" = \? FOR UPDATE/);
    assert.equal(values.length, 1);
    assert.equal(typeof values[0], "string");
    return state.importBatch.filter(row => row.id === values[0]).map(row => ({ id: row.id }));
  },
};

const fakePrisma = {
  ...transactionClient,
  async $transaction<T>(callback: (tx: typeof transactionClient) => Promise<T>, options: Row): Promise<T> {
    assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 10_000 });
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const snapshot = structuredClone(state);
    try {
      operation("$transaction.begin");
      const result = await callback(transactionClient);
      operation("$transaction.commit");
      return result;
    } catch (error) {
      state = snapshot;
      calls.push("$transaction.rollback");
      throw error;
    } finally {
      release();
    }
  },
};

const globalCache = globalThis as typeof globalThis & { prisma?: PrismaClient };
const previousPrisma = globalCache.prisma;
before(async () => {
  assert.equal(previousPrisma, undefined, "Run in an isolated node:test process without a preloaded Prisma client");
  globalCache.prisma = fakePrisma as unknown as PrismaClient;
  importer = await import("../src/lib/import/importer");
  const { prisma } = await import("../src/lib/prisma");
  assert.equal(prisma, fakePrisma);
});
after(() => {
  if (previousPrisma === undefined) delete globalCache.prisma;
  else globalCache.prisma = previousPrisma;
});
beforeEach(() => {
  state = Object.fromEntries(tables.map(table => [table, []])) as unknown as Record<Table, Row[]>;
  calls = [];
  sequence = 0;
  injectedFailure = undefined;
});

function anggota(ref: string, extra: Partial<ImportRowAnggota> = {}): ImportRowAnggota {
  return { cabangKe: 1, ref, namaLengkap: `Person ${ref}`, jenisKelamin: "MALE", ...extra };
}
function data(refs: string[] = ["A"]): ParsedData {
  return { anggota: refs.map(ref => anggota(ref)) };
}
function person(ref: string, extra: Row = {}) {
  const row = { id: `person-${ref}`, externalRef: ref, fullName: `Old ${ref}`, gender: "MALE", deletedAt: null, branchId: "branch-1", ...extra };
  state.person.push(row);
  return row;
}
function batch(input: ParsedData, extra: Row = {}) {
  state.importBatch.push({ id: batchId, status: "VALIDATED", successRows: 0, errorRows: 0,
    reportJson: { filename: "test.xlsx", data: input, errors: [], warnings: [], credentials: [], counts: {} }, ...extra });
}
async function rejected(status: number, message: RegExp, expectedRow?: Partial<ValidationError>) {
  const snapshot = structuredClone(state);
  await assert.rejects(importer.commitImportData(batchId, actorId), error => {
    assert.ok(error instanceof importer.ImportError);
    assert.equal(error.status, status);
    assert.match(error.message, message);
    if (expectedRow) {
      assert.ok(error.errors.some(row => Object.entries(expectedRow).every(([key, value]) => row[key as keyof ValidationError] === value)));
    }
    return true;
  });
  assert.deepEqual(state, snapshot, "Every table must roll back");
  assert.ok(calls.includes("$transaction.rollback"));
}

test("commit creates person and private data with correct branch resolution", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  state.branch.push({ id: "branch-2", branchNumber: 2, name: "Cabang Dua", slug: "cabang-dua", isActive: true });
  const input = data(["A", "B"]);
  input.anggota[0] = anggota("A", { cabangKe: 1, kotaDomisili: "Jakarta", nomorTelepon: "081234567890", catatan: "Note A" });
  input.anggota[1] = anggota("B", { cabangKe: 2, namaPanggilan: "Bee" });
  batch(input);
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  const result = await importer.commitImportData(batchId, actorId);
  assert.equal(result.counts.personsCreated, 2);
  assert.equal(result.counts.personsUpdated, 0);
  assert.equal(result.counts.privateUpserts, 1);
  assert.equal(state.person.length, 2);
  assert.equal(state.person[0].branchId, "branch-1");
  assert.equal(state.person[1].branchId, "branch-2");
  assert.equal(state.personPrivate.length, 1);
  assert.equal(state.personPrivate[0].city, "Jakarta");
  assert.equal(state.personPrivate[0].phone, "081234567890");
  assert.equal(state.personPrivate[0].familyNotes, "Note A");
});

test("analyze counts an existing external ref as an upsert", async () => {
  person("A");
  const result = await importer.analyzeImportData(data());
  assert.equal(result.counts.personsUpdated, 1);
  assert.equal(result.counts.personsCreated, 0);
  assert.deepEqual(result.existingRefs, new Set(["A"]));
});

test("nonexistent branch number is caught at validation time", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Active", slug: "active", isActive: true });
  const input = data(["A"]);
  input.anggota[0] = anggota("A", { _row: 12, cabangKe: 99 });
  batch(input);
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  await rejected(400, /unggah ulang/);
});

test("stored preview errors block an otherwise valid batch", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  const errors: ValidationError[] = [{ sheet: "Data", row: 19, field: "ref", message: "Stored parser error" }];
  batch(data(), { reportJson: { data: data(), errors } });
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  await rejected(400, /unggah ulang/, errors[0]);
  assert.ok(!calls.includes("person.findUnique"));
});

test("commit revalidates payload even when preview errors are empty", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  const input = data(["A", "A"]);
  batch(input);
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  await rejected(400, /unggah ulang/, { sheet: "Data", field: "ref", row: 3 });
  assert.ok(!calls.includes("person.findUnique"));
});

for (const status of ["COMMITTED", "FAILED", "PARTIAL", "UPLOADED"]) {
  test(`${status} batch cannot commit`, async () => {
    state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
    batch(data(), { status });
    state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
    await rejected(409, /sudah diproses/);
    assert.ok(!calls.includes("person.findUnique"));
  });
}

test("missing batch returns 404", async () => {
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  await rejected(404, /tidak ditemukan/);
});

test("batch without stored data cannot commit", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  batch(data(), { reportJson: null });
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  await rejected(400, /tidak lengkap/);
});

for (const restriction of ["missing", "inactive", "MEMBER", "BRANCH_ADMIN", "password-reset-required"]) {
  test(`authorization rejects ${restriction} actor without writes`, async () => {
    state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
    if (restriction === "missing") state.user = [];
    else {
      state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
      if (restriction === "inactive") state.user[0].isActive = false;
      else if (restriction === "password-reset-required") state.user[0].mustChangePassword = true;
      else state.user[0].role = restriction;
    }
    batch(data());
    await rejected(403, /Akses impor ditolak/);
    assert.ok(!calls.includes("person.findUnique"));
  });
}

test("duplicate refs caught at validation time", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  const input = data(["A", "A"]);
  input.anggota[1] = anggota("A", { _row: 3 });
  batch(input);
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  await rejected(400, /unggah ulang/);
});

test("audit failure rolls back batch COMMITTED update and every data write", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  const input = data();
  batch(input);
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  const snapshot = structuredClone(state);
  const error = new Error("Audit insert failed");
  injectedFailure = { operation: "auditLog.create", error };
  await assert.rejects(importer.commitImportData(batchId, actorId), caught => caught === error);
  assert.deepEqual(state, snapshot);
  assert.ok(calls.includes("importBatch.update"));
});

test("P2034 at commit becomes a retryable 409 and rolls back", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  batch(data());
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  injectedFailure = { operation: "$transaction.commit", error: new Prisma.PrismaClientKnownRequestError("Serialization failure", { code: "P2034", clientVersion: "test" }) };
  await rejected(409, /Muat ulang laporan/);
  assert.ok(calls.includes("auditLog.create"));
});

test("concurrent retries of one batch commit only once under the mock transaction mutex", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  batch(data());
  state.user = [{ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false }];
  const results = await Promise.allSettled([
    importer.commitImportData(batchId, actorId),
    importer.commitImportData(batchId, actorId),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejectedResult = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(rejectedResult.reason instanceof importer.ImportError);
  assert.equal(rejectedResult.reason.status, 409);
  assert.equal(state.person.length, 1);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.importBatch[0].status, "COMMITTED");
});
