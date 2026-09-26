import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import bcrypt from "bcryptjs";
import { Prisma, type PrismaClient } from "@prisma/client";
import { DEFAULT_IMPORT_PASSWORD } from "../src/lib/import/types";
import type { ImportRowAnggota, ParsedData, ValidationError } from "../src/lib/import/types";

type Row = Record<string, unknown>;
type Table = "person" | "personPrivate" | "branch" | "user" | "personChild" | "personPartner" | "importBatch" | "auditLog";
type Query = { where?: Row; data?: Row; update?: Row; create?: Row; select?: Row };
const tables: Table[] = ["person", "personPrivate", "branch", "user", "personChild", "personPartner", "importBatch", "auditLog"];
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
  // Prisma omits undefined fields on writes; Object.assign alone would clear them.
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
    // A whole-store mutex models sequential transactions, not PostgreSQL MVCC or row-level locking.
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
  // prisma.ts short-circuits construction when this cache is populated.
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
  state.user.push({ id: actorId, personId: "actor-person", email: "actor@example.test", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false });
});

function anggota(ref: string, extra: Partial<ImportRowAnggota> = {}): ImportRowAnggota {
  return { ref, namaLengkap: `Person ${ref}`, jenisKelamin: "MALE", ...extra };
}
function data(refs: string[] = ["A"]): ParsedData {
  return { anggota: refs.map(ref => anggota(ref)), relasi: [], akun: [] };
}
function person(ref: string, extra: Row = {}) {
  const row = { id: `person-${ref}`, externalRef: ref, fullName: `Old ${ref}`, gender: "MALE", deletedAt: null, ...extra };
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
  assert.deepEqual(state, snapshot, "Every table, including batch and audit, must roll back");
  assert.ok(calls.includes("$transaction.rollback"));
}

test("commit returns actual counts, credentials, bcrypt credentials, batch report and audit", async () => {
  person("B");
  state.branch.push({ id: "branch-1", name: "Cabang Satu", slug: "cabang-satu", isActive: true });
  const input = data(["A", "B", "C"]);
  input.anggota[0] = anggota("A", { alamat: "Address", cabang: "cabang satu", tanggalLahir: "15/01/1990" });
  input.relasi = [
    { refOrang: "A", refTarget: "B", jenisRelasi: "ORANG_TUA", peranOrangTua: "FATHER", adopsi: "Ya", tiri: "Tidak" },
    { refOrang: "C", refTarget: "A", jenisRelasi: "PASANGAN", statusPasangan: "MARRIED" },
  ];
  input.akun = [{ ref: "A", email: "NEW@EXAMPLE.TEST", peran: "MEMBER" }];
  batch(input);
  const result = await importer.commitImportData(batchId, actorId);
  assert.deepEqual(result.counts, { anggota: 3, relasi: 2, akun: 1, personsCreated: 2, personsUpdated: 1,
    accountsCreated: 1, accountsUpdated: 0, childEdgesCreated: 1, partnerEdgesCreated: 1, privateUpserts: 1 });
  assert.deepEqual(result.credentials, [{ ref: "A", fullName: "Person A", email: "new@example.test", role: "MEMBER", isNew: true }]);
  const account = state.user.find(row => row.email === "new@example.test")!;
  assert.equal(typeof account.passwordHash, "string");
  assert.notEqual(account.passwordHash, DEFAULT_IMPORT_PASSWORD);
  assert.equal(await bcrypt.compare(DEFAULT_IMPORT_PASSWORD, account.passwordHash as string), true);
  assert.equal(bcrypt.getRounds(account.passwordHash as string), 10);
  assert.equal(account.mustChangePassword, true);
  assert.equal(account.isVerified, true);
  assert.equal(account.createdById, actorId);
  const created = state.person.find(row => row.externalRef === "A")!;
  assert.equal(account.personId, created.id);
  assert.equal(created.branchId, "branch-1");
  assert.deepEqual(created.birthDate, new Date("1990-01-15T00:00:00Z"));
  assert.equal(state.personChild[0].parentRole, "FATHER");
  assert.equal(state.personChild[0].isAdopted, true);
  assert.equal(state.personChild[0].isStep, false);
  assert.equal(state.personPrivate[0].personId, created.id);
  assert.equal(state.importBatch[0].status, "COMMITTED");
  assert.equal(state.importBatch[0].successRows, 6);
  assert.equal(state.importBatch[0].errorRows, 0);
  assert.deepEqual((state.importBatch[0].reportJson as Row).counts, result.counts);
  assert.deepEqual((state.importBatch[0].reportJson as Row).credentials, result.credentials);
  assert.deepEqual((state.importBatch[0].reportJson as Row).errors, []);
  assert.equal(state.auditLog.length, 1);
  assert.deepEqual(state.auditLog[0], { id: state.auditLog[0].id, action: "IMPORT_COMMIT", entityType: "ImportBatch", entityId: batchId, actorUserId: actorId, afterData: result.counts });
  assert.ok(calls.indexOf("$queryRaw") < calls.indexOf("importBatch.findUnique"));
});

test("existing account password and flags survive role updates; blank optional cells preserve values", async () => {
  const optional = { nickname: "Nickname", birthPlace: "Town", birthDate: new Date("1950-01-01"), deathDate: new Date("2020-01-01"), bio: "Biography", generationLevel: 4, branchId: "existing-branch" };
  const existing = person("A", optional);
  const passwordHash = await bcrypt.hash("previous-password", 4);
  state.user.push({ id: "existing-user", personId: existing.id, email: "EXISTING@example.test", passwordHash, role: "MEMBER", mustChangePassword: false, isVerified: false });
  state.personPrivate.push({ personId: existing.id, city: "Old city", phone: "123", addressLine: "Old address" });
  const input = data();
  input.anggota[0] = anggota("A", { namaPanggilan: "", tanggalLahir: "", tanggalMeninggal: "", tempatLahir: "", bio: "", levelGenerasi: "", cabang: "", telepon: "", alamat: "", kota: "New city" });
  input.akun = [{ ref: "A", email: "existing@example.test", peran: "BRANCH_ADMIN" }];
  batch(input);
  const result = await importer.commitImportData(batchId, actorId);
  for (const [key, value] of Object.entries(optional)) assert.deepEqual(state.person[0][key], value, key);
  assert.equal(state.person[0].fullName, "Person A");
  assert.deepEqual(state.personPrivate[0], { personId: existing.id, city: "New city", phone: "123", addressLine: "Old address" });
  const account = state.user.find(row => row.id === "existing-user")!;
  assert.equal(account.passwordHash, passwordHash);
  assert.equal(await bcrypt.compare("previous-password", account.passwordHash as string), true);
  assert.equal(account.mustChangePassword, false);
  assert.equal(account.isVerified, false);
  assert.equal(account.role, "BRANCH_ADMIN");
  assert.equal(result.counts.personsUpdated, 1);
  assert.equal(result.counts.accountsUpdated, 1);
  assert.equal(result.counts.accountsCreated, 0);
  assert.equal(result.credentials[0].isNew, false);
});

// Fixed: validateImportData now keeps a blank `meninggal` as undefined, so importing
// no longer clears an existing isDeceased=true.
test("blank death-status cell preserves an existing deceased flag", async () => {
  person("A", { isDeceased: true });
  const input = data();
  input.anggota[0].meninggal = "";
  batch(input);
  await importer.commitImportData(batchId, actorId);
  assert.equal(state.person[0].isDeceased, true);
});

for (const conflict of ["email belongs to another person", "person already has another email"]) {
  test(`${conflict}: rolls back people, private data, edges and earlier accounts`, async () => {
    const linked = person("B");
    const other = person("OUTSIDE");
    state.user.push({ id: "conflicting-user", personId: conflict.startsWith("email") ? other.id : linked.id, email: conflict.startsWith("email") ? "CONFLICT@example.test" : "old@example.test", passwordHash: "unchanged" });
    const input = data(["A", "B", "C"]);
    input.anggota[0].alamat = "New address";
    input.relasi = [
      { refOrang: "A", refTarget: "B", jenisRelasi: "ORANG_TUA" },
      { refOrang: "A", refTarget: "C", jenisRelasi: "PASANGAN" },
    ];
    input.akun = [
      { ref: "A", email: "first@example.test", peran: "MEMBER" },
      { _row: 9, ref: "B", email: "conflict@example.test", peran: "MEMBER" },
    ];
    batch(input);
    await rejected(400, /akun berbeda/, { sheet: "Akun", row: 9, field: "email_akun" });
    for (const method of ["person.create", "person.update", "personPrivate.upsert", "personChild.create", "personPartner.create", "user.create"]) assert.ok(calls.includes(method), method);
  });
}

for (const inactive of [false, true]) {
  test(`${inactive ? "inactive" : "unknown"} branch rolls back earlier writes`, async () => {
    if (inactive) state.branch.push({ id: "inactive", name: "Missing", slug: "missing", isActive: false });
    const input = data(["A", "B"]);
    input.anggota[0].alamat = "Address";
    input.anggota[1] = anggota("B", { _row: 12, cabang: "Missing" });
    batch(input);
    await rejected(400, /Cabang.*tidak ditemukan/, { sheet: "Anggota", row: 12, field: "cabang" });
    assert.ok(calls.includes("personPrivate.upsert"));
  });
}

test("cycle through database-only intermediate ancestor rolls back", async () => {
  const a = person("A"), middle = person("MIDDLE"), b = person("B");
  state.personChild.push({ parentId: a.id, childId: middle.id }, { parentId: middle.id, childId: b.id });
  const input = data(["A", "B", "NEW"]);
  input.relasi = [{ _row: 7, refOrang: "A", refTarget: "B", jenisRelasi: "ORANG_TUA" }];
  batch(input);
  await rejected(400, /siklus/, { sheet: "Relasi", row: 7, field: "ref_target" });
  assert.ok(calls.includes("person.create"));
  assert.ok(calls.includes("personChild.findMany"));
});

test("two-parent guard combines stored parents and newly imported parents", async () => {
  const child = person("C"), parent = person("P1");
  state.personChild.push({ parentId: parent.id, childId: child.id });
  const input = data(["C", "P2", "P3"]);
  input.relasi = [
    { refOrang: "C", refTarget: "P2", jenisRelasi: "ORANG_TUA" },
    { _row: 8, refOrang: "C", refTarget: "P3", jenisRelasi: "ORANG_TUA" },
  ];
  batch(input);
  await rejected(400, /dua orang tua/, { sheet: "Relasi", row: 8, field: "ref_target" });
  assert.equal(calls.filter(call => call === "personChild.create").length, 1);
});

test("existing parent edges and duplicate import rows do not add extra parents", async () => {
  const child = person("C"), parent = person("P1"), other = person("P2");
  state.personChild.push({ parentId: parent.id, childId: child.id }, { parentId: other.id, childId: child.id });
  const input = data(["C", "P1"]);
  input.relasi = Array.from({ length: 2 }, () => ({ refOrang: "C", refTarget: "P1", jenisRelasi: "ORANG_TUA" as const }));
  batch(input);
  const result = await importer.commitImportData(batchId, actorId);
  assert.equal(result.counts.childEdgesCreated, 0);
  assert.equal(state.personChild.length, 2);
});

for (const stored of [false, true]) {
  test(`reversed partners deduplicate ${stored ? "against stored edges" : "within a batch"}`, async () => {
    const a = person("A"), b = person("B");
    if (stored) state.personPartner.push({ partnerAId: b.id, partnerBId: a.id });
    const input = data(["A", "B"]);
    input.relasi = [
      { refOrang: "A", refTarget: "B", jenisRelasi: "PASANGAN" },
      { refOrang: "B", refTarget: "A", jenisRelasi: "PASANGAN" },
    ];
    batch(input);
    const result = await importer.commitImportData(batchId, actorId);
    assert.equal(result.counts.partnerEdgesCreated, stored ? 0 : 1);
    assert.equal(state.personPartner.length, 1);
    if (!stored) assert.deepEqual([state.personPartner[0].partnerAId, state.personPartner[0].partnerBId], [a.id, b.id].sort());
  });
}

test("stored preview errors block an otherwise valid batch", async () => {
  const errors: ValidationError[] = [{ sheet: "Anggota", row: 19, field: "ref", message: "Stored parser error" }];
  batch(data(), { reportJson: { data: data(), errors } });
  await rejected(400, /unggah ulang/, errors[0]);
  assert.ok(!calls.includes("person.findUnique"));
});

test("commit revalidates payload even when preview errors are empty", async () => {
  const input = data(["A", "A"]);
  batch(input);
  await rejected(400, /unggah ulang/, { sheet: "Anggota", field: "ref", row: 3 });
  assert.ok(!calls.includes("person.findUnique"));
});

for (const status of ["COMMITTED", "FAILED", "PARTIAL", "UPLOADED"]) {
  test(`${status} batch cannot commit`, async () => {
    batch(data(), { status });
    await rejected(409, /sudah diproses/);
    assert.ok(!calls.includes("person.findUnique"));
  });
}

test("missing batch returns 404", async () => {
  await rejected(404, /tidak ditemukan/);
});

test("batch without stored data cannot commit", async () => {
  batch(data(), { reportJson: null });
  await rejected(400, /tidak lengkap/);
});

for (const restriction of ["missing", "inactive", "MEMBER", "BRANCH_ADMIN", "password-reset-required"]) {
  test(`authorization rejects ${restriction} actor without writes`, async () => {
    if (restriction === "missing") state.user = [];
    else if (restriction === "inactive") state.user[0].isActive = false;
    else if (restriction === "password-reset-required") state.user[0].mustChangePassword = true;
    else state.user[0].role = restriction;
    batch(data());
    await rejected(403, /Akses impor ditolak/);
    assert.ok(!calls.includes("person.findUnique"));
  });
}

test("super-admin cannot demote their own account during import", async () => {
  person("ACTOR", { id: "actor-person" });
  const input = data(["NEW", "ACTOR"]);
  input.akun = [{ _row: 5, ref: "ACTOR", email: "actor@example.test", peran: "MEMBER" }];
  batch(input);
  await rejected(400, /menurunkan peran akun sendiri/, { sheet: "Akun", row: 5, field: "peran" });
});

test("archived person rejects import after earlier writes", async () => {
  person("ARCHIVED", { deletedAt: new Date("2020-01-01") });
  batch(data(["NEW", "ARCHIVED"]));
  await rejected(400, /diarsipkan/, { sheet: "Anggota", row: 3, field: "ref" });
});

test("audit failure rolls back batch COMMITTED update and every data write", async () => {
  const input = data();
  input.akun = [{ ref: "A", email: "a@example.test", peran: "MEMBER" }];
  batch(input);
  const snapshot = structuredClone(state);
  const error = new Error("Audit insert failed");
  injectedFailure = { operation: "auditLog.create", error };
  await assert.rejects(importer.commitImportData(batchId, actorId), caught => caught === error);
  assert.deepEqual(state, snapshot);
  assert.ok(calls.includes("importBatch.update"));
  assert.ok(calls.includes("user.create"));
});

test("P2034 at commit becomes a retryable 409 and rolls back", async () => {
  batch(data());
  injectedFailure = { operation: "$transaction.commit", error: new Prisma.PrismaClientKnownRequestError("Serialization failure", { code: "P2034", clientVersion: "test" }) };
  await rejected(409, /Muat ulang laporan/);
  assert.ok(calls.includes("auditLog.create"));
});

test("concurrent retries of one batch commit only once under the mock transaction mutex", async () => {
  const input = data();
  input.akun = [{ ref: "A", email: "a@example.test", peran: "MEMBER" }];
  batch(input);
  const results = await Promise.allSettled([
    importer.commitImportData(batchId, actorId),
    importer.commitImportData(batchId, actorId),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejectedResult = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(rejectedResult.reason instanceof importer.ImportError);
  assert.equal(rejectedResult.reason.status, 409);
  assert.equal(state.person.length, 1);
  assert.equal(state.user.filter(row => row.id !== actorId).length, 1);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.importBatch[0].status, "COMMITTED");
});
