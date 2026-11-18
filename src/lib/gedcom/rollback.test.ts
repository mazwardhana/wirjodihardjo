import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { GEDCOM_IMPORT_TYPE } from "./types";

type Row = Record<string, unknown>;

let batch: Row | null;
let actor: Row | null;
let failTransactionWith: unknown;

let partnerDeletes: Row[];
let childDeletes: Row[];
let personDeletes: Row[];
let batchUpdateArgs: { where: Row; data: Row } | null;
let auditArgs: Row | null;
let transactionOptions: Row | undefined;
let queryRawCalls: unknown[];

const tx = {
  async $queryRaw(strings: unknown, ...values: unknown[]) {
    queryRawCalls.push({ strings, values });
    return [];
  },
  user: {
    async findUnique() {
      return actor;
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
  personPartner: {
    async deleteMany({ where }: { where: Row }) {
      partnerDeletes.push(where);
      return { count: (where.id as { in: string[] }).in.length };
    },
  },
  personChild: {
    async deleteMany({ where }: { where: Row }) {
      childDeletes.push(where);
      return { count: (where.id as { in: string[] }).in.length };
    },
  },
  person: {
    async deleteMany({ where }: { where: Row }) {
      personDeletes.push(where);
      return { count: (where.id as { in: string[] }).in.length };
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
let rollbackGedcomImport: typeof import("./rollback").rollbackGedcomImport;
let GedcomImportError: typeof import("./commit").GedcomImportError;

function committedBatch(overrides: { status?: string; type?: string; rollback?: boolean; emptySnapshot?: boolean } = {}) {
  return {
    id: "batch-1",
    status: overrides.status ?? "COMMITTED",
    type: overrides.type ?? GEDCOM_IMPORT_TYPE,
    rolledBackAt: overrides.rollback ? new Date() : null,
    reportJson: {
      filename: "keluarga.ged",
      createdPersonIds: overrides.emptySnapshot ? [] : ["person-1", "person-2"],
      createdChildEdgeIds: overrides.emptySnapshot ? [] : ["child-1"],
      createdPartnerEdgeIds: overrides.emptySnapshot ? [] : ["partner-1"],
    },
  };
}

function reset() {
  batch = committedBatch();
  actor = { id: "admin-1", isActive: true, role: "SUPER_ADMIN", mustChangeCredentials: false };
  failTransactionWith = null;
  partnerDeletes = [];
  childDeletes = [];
  personDeletes = [];
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
  const commitMod = await import("./commit");
  GedcomImportError = commitMod.GedcomImportError;
  const rollbackMod = await import("./rollback");
  rollbackGedcomImport = rollbackMod.rollbackGedcomImport;
});

after(() => {
  if (previousPrisma === undefined) delete globalCache.prisma;
  else globalCache.prisma = previousPrisma;
});

beforeEach(reset);

describe("rollbackGedcomImport — happy path", () => {
  test("mengunci baris batch dan memakai transaksi serializable dengan timeout", async () => {
    await rollbackGedcomImport("batch-1", "admin-1");
    assert.strictEqual(queryRawCalls.length, 1);
    assert.ok(transactionOptions);
    assert.strictEqual(transactionOptions!.isolationLevel, "Serializable");
    assert.strictEqual(transactionOptions!.timeout, 120_000);
    assert.strictEqual(transactionOptions!.maxWait, 10_000);
  });

  test("menghapus Partner, Child, lalu Person sesuai snapshot", async () => {
    const result = await rollbackGedcomImport("batch-1", "admin-1");
    assert.strictEqual(partnerDeletes.length, 1);
    assert.deepStrictEqual(partnerDeletes[0], { id: { in: ["partner-1"] } });
    assert.strictEqual(childDeletes.length, 1);
    assert.deepStrictEqual(childDeletes[0], { id: { in: ["child-1"] } });
    assert.strictEqual(personDeletes.length, 1);
    assert.deepStrictEqual(personDeletes[0], { id: { in: ["person-1", "person-2"] } });
    assert.deepStrictEqual(result, {
      removedPersons: 2,
      removedChildEdges: 1,
      removedPartnerEdges: 1,
    });
  });

  test("menandai batch rolledBackAt + menulis audit log", async () => {
    await rollbackGedcomImport("batch-1", "admin-1");
    assert.ok(batchUpdateArgs);
    assert.deepStrictEqual(batchUpdateArgs!.where, { id: "batch-1" });
    assert.ok(batchUpdateArgs!.data.rolledBackAt instanceof Date);
    assert.ok(auditArgs);
    assert.strictEqual(auditArgs!.action, "GEDCOM_IMPORT_ROLLBACK");
    assert.strictEqual(auditArgs!.entityType, "ImportBatch");
    assert.strictEqual(auditArgs!.entityId, "batch-1");
    assert.strictEqual(auditArgs!.actorUserId, "admin-1");
  });

  test("snapshot kosong tetap aman: tanpa delete, tapi ditolak sebagai tidak lengkap", async () => {
    batch = committedBatch({ emptySnapshot: true });
    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        assert.match(error.message, /snapshot/);
        return true;
      },
    );
    assert.strictEqual(partnerDeletes.length, 0);
    assert.strictEqual(childDeletes.length, 0);
    assert.strictEqual(personDeletes.length, 0);
  });
});

describe("rollbackGedcomImport — guard errors", () => {
  test("batch tidak ditemukan -> 404", async () => {
    batch = null;
    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 404);
        return true;
      },
    );
  });

  test("batch belum COMMITTED -> 409", async () => {
    batch = committedBatch({ status: "VALIDATED" });
    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        assert.match(error.message, /belum di-commit/);
        return true;
      },
    );
  });

  test("batch sudah di-rollback -> 409", async () => {
    batch = committedBatch({ rollback: true });
    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        assert.match(error.message, /sudah dibatalkan/);
        return true;
      },
    );
  });

  test("type batch salah -> 409", async () => {
    batch = committedBatch({ type: "REGISTRASI" });
    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        return true;
      },
    );
  });

  test("aktor bukan Super Admin -> 403", async () => {
    actor = { id: "admin-1", isActive: true, role: "MEMBER", mustChangeCredentials: false };
    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 403);
        return true;
      },
    );
  });

  test("Prisma P2034 -> dipetakan ke 409 retry", async () => {
    failTransactionWith = new Prisma.PrismaClientKnownRequestError("Serialization failure", {
      code: "P2034",
      clientVersion: "test",
    });
    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        assert.match(error.message, /Muat ulang laporan/);
        return true;
      },
    );
  });

  test("Prisma P2010 dengan originalCode 40001 -> dipetakan ke 409 retry", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("TransactionWriteConflict", {
      code: "P2010",
      clientVersion: "test",
      meta: {
        driverAdapterError: {
          cause: { originalCode: "40001" },
        },
      },
    });
    failTransactionWith = error;
    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        assert.match(error.message, /Muat ulang laporan/);
        return true;
      },
    );
  });
});
