import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import bcrypt from "bcryptjs";
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
    if (key === "OR") return (expected as Row[]).some((condition) => matches(row, condition));
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const filter = expected as Row;
      if ("in" in filter) return (filter.in as unknown[]).includes(row[key]);
      if ("startsWith" in filter) return String(row[key] ?? "").startsWith(String(filter.startsWith));
      if ("equals" in filter) {
        return filter.mode === "insensitive"
          ? String(row[key]).toLowerCase() === String(filter.equals).toLowerCase()
          : row[key] === filter.equals;
      }
      assert.fail(`Unsupported mock filter: ${key} ${JSON.stringify(filter)}`);
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
  const find = (where?: Row) => state[table].find((row) => matches(row, where));
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
      return structuredClone(state[table].filter((row) => matches(row, where)));
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
  ...Object.fromEntries(tables.map((table) => [table, delegate(table)])),
  async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
    operation("$queryRaw");
    assert.match(strings.join("?"), /SELECT "id" FROM "ImportBatch" WHERE "id" = \? FOR UPDATE/);
    assert.equal(values.length, 1);
    assert.equal(typeof values[0], "string");
    return state.importBatch.filter((row) => row.id === values[0]).map((row) => ({ id: row.id }));
  },
};

const fakePrisma = {
  ...transactionClient,
  async $transaction<T>(callback: (tx: typeof transactionClient) => Promise<T>, options: Row): Promise<T> {
    assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 10_000 });
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>((resolve) => { release = resolve; });
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
  state = Object.fromEntries(tables.map((table) => [table, []])) as unknown as Record<Table, Row[]>;
  calls = [];
  sequence = 0;
  injectedFailure = undefined;
});

function anggota(namaLengkap: string, extra: Partial<ImportRowAnggota> = {}): ImportRowAnggota {
  return {
    cabangKe: "1",
    namaLengkap,
    nickname: "budi",
    passwordHash: "$2a$12$storedhashstoredhashstoredhashstoredhashstoredhashstoredhash",
    jenisKelamin: "MALE",
    ...extra,
  };
}
function data(names: string[] = ["Person A"]): ParsedData {
  return { anggota: names.map((name) => anggota(name)) };
}
function person(name: string, extra: Row = {}) {
  const row = { id: `person-${name}`, fullName: name, gender: "MALE", deletedAt: null, branchId: "branch-1", ...extra };
  state.person.push(row);
  return row;
}
function batch(input: ParsedData, extra: Row = {}) {
  state.importBatch.push({
    id: batchId,
    status: "VALIDATED",
    successRows: 0,
    errorRows: 0,
    reportJson: { filename: "test.xlsx", data: input, errors: [], warnings: [], credentials: [], skipped: [], counts: {} },
    ...extra,
  });
}
function actor(overrides: Row = {}) {
  state.user.push({ id: actorId, username: "actor", personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangeCredentials: false, ...overrides });
}
function memberUsers(): Row[] {
  return state.user.filter((row) => row.role === "MEMBER");
}
async function rejected(status: number, message: RegExp, expectedRow?: Partial<ValidationError>) {
  const snapshot = structuredClone(state);
  await assert.rejects(importer.commitImportData(batchId, actorId), (error: unknown) => {
    assert.ok(error instanceof importer.ImportError);
    assert.equal((error as InstanceType<typeof importer.ImportError>).status, status);
    assert.match((error as Error).message, message);
    if (expectedRow) {
      assert.ok((error as InstanceType<typeof importer.ImportError>).errors.some((row) => Object.entries(expectedRow).every(([key, value]) => row[key as keyof ValidationError] === value)));
    }
    return true;
  });
  assert.deepEqual(state, snapshot, "Every table must roll back");
  assert.ok(calls.includes("$transaction.rollback"));
}

test("hashImportPasswords replaces plaintext with a verifiable bcrypt hash", async () => {
  const hashed = await importer.hashImportPasswords({
    anggota: [anggota("Budi Santoso", { passwordHash: undefined, password: "rahasia123" })],
  });
  const row = hashed.anggota[0];
  assert.equal(row.password, undefined, "plaintext harus dihapus");
  assert.ok(row.passwordHash?.startsWith("$2"), "hash bcrypt disimpan");
  assert.ok(await bcrypt.compare("rahasia123", row.passwordHash!));
});

test("sanitizePreviewData strips password and hash", () => {
  const sanitized = importer.sanitizePreviewData({
    anggota: [anggota("Budi", { password: "rahasia123" })],
  });
  assert.ok(!("password" in sanitized.anggota[0]));
  assert.ok(!("passwordHash" in sanitized.anggota[0]));
});

test("commit creates Person, PersonPrivate, and User with correct branch and username", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  state.branch.push({ id: "branch-2", branchNumber: 2, name: "Cabang Dua", isActive: true });
  const input = data(["Budi Santoso", "Siti Aminah"]);
  input.anggota[0] = anggota("Budi Santoso", {
    cabangKe: "1",
    nickname: "Budi",
    nomorTelepon: "081234567890",
    alamatDomisili: "Jl. Merdeka 1",
    kotaDomisili: "Jakarta",
  });
  input.anggota[1] = anggota("Siti Aminah", { cabangKe: "2", nickname: "Siti" });
  batch(input);
  actor();

  const result = await importer.commitImportData(batchId, actorId);

  assert.equal(result.counts.personsCreated, 2);
  assert.equal(result.counts.accountsCreated, 2);
  assert.equal(result.counts.rowsSkipped, 0);
  assert.equal(result.counts.privateUpserts, 1);
  assert.equal(result.skipped.length, 0);

  assert.equal(state.person.length, 2);
  assert.equal(state.person[0].branchId, "branch-1");
  assert.equal(state.person[1].branchId, "branch-2");
  assert.equal(state.person[0].fullName, "Budi Santoso");
  assert.equal(state.person[0].nickname, "Budi");

  assert.equal(state.personPrivate.length, 1);
  assert.equal(state.personPrivate[0].city, "Jakarta");
  assert.equal(state.personPrivate[0].phone, "081234567890");
  assert.equal(state.personPrivate[0].addressLine, "Jl. Merdeka 1");

  const users = memberUsers();
  assert.equal(users.length, 2);
  assert.equal(users[0].username, "budi");
  assert.equal(users[1].username, "siti");
  for (const user of users) {
    assert.equal(user.role, "MEMBER");
    assert.equal(user.isActive, true);
    assert.equal(user.mustChangeCredentials, true);
    assert.equal(user.email, null);
    assert.ok(String(user.passwordHash).startsWith("$2"));
    assert.equal(user.createdById, actorId);
  }
  assert.deepEqual(result.credentials.map((c) => c.username), ["budi", "siti"]);
});

test("commit skips rows whose (branch, normalized name) already exists", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  person("Budi Santoso");
  batch(data(["  budi   santoso ", "Siti Aminah"]));
  actor();

  const result = await importer.commitImportData(batchId, actorId);

  assert.equal(result.counts.personsCreated, 1);
  assert.equal(result.counts.rowsSkipped, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].reason, "sudah ada, dilewati");
  assert.equal(result.skipped[0].fullName, "budi   santoso");
  assert.equal(state.person.length, 2, "hanya satu person baru");
  assert.equal(memberUsers().length, 1);
});

test("archived person does not block re-import", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  person("Budi Santoso", { deletedAt: new Date() });
  batch(data(["Budi Santoso"]));
  actor();

  const result = await importer.commitImportData(batchId, actorId);

  assert.equal(result.counts.personsCreated, 1, "person terarsip tidak dihitung exist");
  assert.equal(result.counts.rowsSkipped, 0);
  assert.equal(memberUsers().length, 1, "user tetap dibuat");
});

test("successRows counts only stored rows, not skipped ones", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  person("Budi Santoso");
  batch(data(["Budi Santoso", "Siti Aminah"]));
  actor();

  await importer.commitImportData(batchId, actorId);

  const saved = state.importBatch.find((row) => row.id === batchId);
  assert.equal(saved?.successRows, 1, "hanya baris tersimpan yang dihitung");
});

test("commit skips duplicate rows within the same file", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  batch(data(["Budi Santoso", "budi santoso", "Siti Aminah"]));
  actor();

  const result = await importer.commitImportData(batchId, actorId);

  assert.equal(result.counts.personsCreated, 2);
  assert.equal(result.counts.rowsSkipped, 1);
  assert.equal(state.person.length, 2);
  assert.equal(memberUsers().length, 2);
});

test("username collision with an existing user gets a -2 suffix", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  state.user.push({ id: "existing", username: "budi", role: "MEMBER", personId: "p" });
  batch(data(["Budi Santoso"]));
  actor();

  const result = await importer.commitImportData(batchId, actorId);

  assert.equal(result.credentials[0].username, "budi-2");
  assert.equal(memberUsers().find((u) => u.id !== "existing")?.username, "budi-2");
});

test("two rows with the same nickname get unique usernames", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  batch(data(["Budi Santoso", "Budi Hartono"]));
  actor();

  const result = await importer.commitImportData(batchId, actorId);

  assert.deepEqual(result.credentials.map((c) => c.username), ["budi", "budi-2"]);
});

test("analyzeImportData plans usernames, private upserts, and skips", async () => {
  person("Budi Santoso");
  const input: ParsedData = {
    anggota: [
      anggota("Budi Santoso", { branchId: "branch-1", branchNumber: 1 }),
      anggota("Siti Aminah", { branchId: "branch-1", branchNumber: 1, nickname: "Siti", nomorTelepon: "0812" }),
    ],
  };
  const plan = await importer.analyzeImportData(input);
  assert.equal(plan.counts.personsCreated, 1);
  assert.equal(plan.counts.rowsSkipped, 1);
  assert.equal(plan.counts.privateUpserts, 1);
  assert.deepEqual(plan.credentials.map((c) => c.username), ["siti"]);
  assert.equal(plan.skipped[0].reason, "sudah ada, dilewati");
});

test("analyzeImportData returns the planned usernames keyed by row", async () => {
  person("Budi Santoso");
  const input: ParsedData = {
    anggota: [
      anggota("Budi Santoso", { branchId: "branch-1", branchNumber: 1 }),
      anggota("Siti Aminah", { branchId: "branch-1", branchNumber: 1, nickname: "Siti" }),
    ],
  };

  const plan = await importer.analyzeImportData(input);

  // rowKey menormalkan nama ke huruf kecil lewat normalizeFullName.
  assert.equal(plan.plannedUsernames["branch-1::siti aminah"], "siti");
  assert.equal(plan.plannedUsernames["branch-1::budi santoso"], undefined, "baris dilewati tidak masuk rencana");
  assert.equal(plan.credentials[0].rowKey, "branch-1::siti aminah");
});

test("commit reuses the username planned at preview", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  batch(data(["Budi Santoso"]), {
    reportJson: {
      filename: "test.xlsx",
      data: data(["Budi Santoso"]),
      errors: [],
      warnings: [],
      // Bentuk inilah yang benar-benar ditulis rute pratinjau: rencana ada di
      // dalam `credentials` lewat `rowKey` (nama ternormalisasi huruf kecil).
      credentials: [{ fullName: "Budi Santoso", username: "budi_keluarga", rowKey: "branch-1::budi santoso", role: "MEMBER", isNew: true, status: "dibuat" }],
      skipped: [],
      counts: {},
    },
  });
  actor();

  const result = await importer.commitImportData(batchId, actorId);

  const created = memberUsers().find((u) => u.personId?.toString().startsWith("created-"));
  assert.equal(created?.username, "budi_keluarga");
  assert.equal(result.credentials[0].username, "budi_keluarga");

  // Rencana ikut tercatat saat reportJson ditulis ulang oleh commit.
  const saved = state.importBatch.find((row) => row.id === batchId);
  const savedPayload = saved?.reportJson as {
    plannedUsernames?: Record<string, string>;
    credentials?: Array<{ rowKey?: string; username?: string }>;
  };
  // plannedUsernames berisi username yang benar-benar dibuat, bukan sekadar rencana.
  assert.equal(savedPayload?.plannedUsernames?.["branch-1::budi santoso"], "budi_keluarga");
  assert.equal(savedPayload?.credentials?.[0]?.rowKey, "branch-1::budi santoso");
  assert.equal(savedPayload?.credentials?.[0]?.username, "budi_keluarga");
});

test("planned username that became taken falls back to a unique one", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  state.user.push({ id: "existing", username: "budi_keluarga", role: "MEMBER", personId: "p" });
  batch(data(["Budi Santoso"]), {
    reportJson: {
      filename: "test.xlsx",
      data: data(["Budi Santoso"]),
      errors: [],
      warnings: [],
      credentials: [{ fullName: "Budi Santoso", username: "budi_keluarga", rowKey: "branch-1::budi santoso", role: "MEMBER", isNew: true, status: "dibuat" }],
      skipped: [],
      counts: {},
    },
  });
  actor();

  const result = await importer.commitImportData(batchId, actorId);

  const created = memberUsers().find((u) => u.personId?.toString().startsWith("created-"));
  assert.notEqual(created?.username, "budi_keluarga");
  assert.equal(created?.username, "budi");
  assert.equal(result.credentials[0].username, "budi");

  // reportJson mencatat hasil nyata: username terpaksa berganti, laporan ikut berubah.
  const saved = state.importBatch.find((row) => row.id === batchId);
  const savedPayload = saved?.reportJson as { plannedUsernames?: Record<string, string> };
  assert.equal(savedPayload?.plannedUsernames?.["branch-1::budi santoso"], "budi");
});

test("nonexistent branch code is caught at validation time", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Active", isActive: true });
  const input = data(["Person A"]);
  input.anggota[0] = anggota("Person A", { _row: 12, cabangKe: "99" });
  batch(input);
  actor();

  await rejected(400, /unggah ulang/, { sheet: "Data", field: "kode cabang keluarga", row: 12 });
  assert.ok(!calls.includes("person.create"));
});

test("stored preview errors block an otherwise valid batch", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  const errors: ValidationError[] = [{ sheet: "Data", row: 19, field: "password", message: "Stored parser error" }];
  batch(data(), { reportJson: { data: data(), errors } });
  actor();

  await rejected(400, /unggah ulang/, errors[0]);
  assert.ok(!calls.includes("person.create"));
});

test("commit revalidates payload even when preview errors are empty", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  const input = data(["Person A"]);
  input.anggota[0] = anggota("Person A", { tanggalLahir: "31/02/2024" });
  batch(input);
  actor();

  await rejected(400, /unggah ulang/, { sheet: "Data", field: "tanggal_lahir", row: 2 });
  assert.ok(!calls.includes("person.create"));
});

for (const status of ["COMMITTED", "FAILED", "PARTIAL", "UPLOADED"]) {
  test(`${status} batch cannot commit`, async () => {
    state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
    batch(data(), { status });
    actor();
    await rejected(409, /sudah diproses/);
    assert.ok(!calls.includes("person.create"));
  });
}

test("missing batch returns 404", async () => {
  actor();
  await rejected(404, /tidak ditemukan/);
});

test("batch without stored data cannot commit", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  batch(data(), { reportJson: null });
  actor();
  await rejected(400, /tidak lengkap/);
});

for (const restriction of ["missing", "inactive", "MEMBER", "BRANCH_ADMIN", "onboarding-required"]) {
  test(`authorization rejects ${restriction} actor without writes`, async () => {
    state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
    if (restriction === "missing") {
      // no actor pushed
    } else if (restriction === "inactive") {
      actor({ isActive: false });
    } else if (restriction === "onboarding-required") {
      actor({ mustChangeCredentials: true });
    } else {
      actor({ role: restriction });
    }
    batch(data());
    await rejected(403, /Akses impor ditolak/);
    assert.ok(!calls.includes("person.create"));
  });
}

test("commit fails row-safely when a validated row has no password hash", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  batch(data(["Person A"]), {
    reportJson: {
      data: { anggota: [anggota("Person A", { passwordHash: undefined, password: "rahasia123" })] },
      errors: [],
      warnings: [],
      credentials: [],
      skipped: [],
      counts: {},
    },
  });
  actor();
  await rejected(400, /Password tidak tersedia/, { field: "password", row: 2 });
});

test("audit failure rolls back batch COMMITTED update and every data write", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  batch(data());
  actor();
  const snapshot = structuredClone(state);
  const error = new Error("Audit insert failed");
  injectedFailure = { operation: "auditLog.create", error };
  await assert.rejects(importer.commitImportData(batchId, actorId), (caught: unknown) => caught === error);
  assert.deepEqual(state, snapshot);
  assert.ok(calls.includes("importBatch.update"));
});

test("P2034 at commit becomes a retryable 409 and rolls back", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  batch(data());
  actor();
  injectedFailure = { operation: "$transaction.commit", error: new Prisma.PrismaClientKnownRequestError("Serialization failure", { code: "P2034", clientVersion: "test" }) };
  await rejected(409, /Muat ulang laporan/);
  assert.ok(calls.includes("auditLog.create"));
});

test("concurrent retries of one batch commit only once under the mock transaction mutex", async () => {
  state.branch.push({ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true });
  batch(data());
  actor();
  const results = await Promise.allSettled([
    importer.commitImportData(batchId, actorId),
    importer.commitImportData(batchId, actorId),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejectedResult = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(rejectedResult.reason instanceof importer.ImportError);
  assert.equal(rejectedResult.reason.status, 409);
  assert.equal(state.person.length, 1);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.importBatch[0].status, "COMMITTED");
});
