import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { GEDCOM_IMPORT_TYPE } from "./types";

type Row = Record<string, unknown>;

let batch: Row | null;
let actor: Row | null;
let failTransactionWith: unknown;

let personCreates: Row[];
let personChildCreates: Row[];
let personPartnerCreates: Row[];
let batchUpdateArgs: { where: Row; data: Row } | null;
let auditArgs: Row | null;
let transactionOptions: Row | undefined;
let queryRawCalls: unknown[];
let personFindUniqueResults: Map<string, Row | null>;

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
  person: {
    async findUnique(args: { where: { externalRef: string } }) {
      return personFindUniqueResults.get(args.where.externalRef) ?? null;
    },
    async create({ data }: { data: Row }) {
      personCreates.push(data);
      return { id: `person-${personCreates.length}` };
    },
  },
  personChild: {
    async create({ data }: { data: Row }) {
      personChildCreates.push(data);
      return { id: `child-${personChildCreates.length}` };
    },
  },
  personPartner: {
    async create({ data }: { data: Row }) {
      personPartnerCreates.push(data);
      return { id: `partner-${personPartnerCreates.length}` };
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
let commitGedcomImport: typeof import("./commit").commitGedcomImport;
let GedcomImportError: typeof import("./commit").GedcomImportError;

function validBatch(overrides: { status?: string; type?: string; payload?: Row } = {}) {
  return {
    id: "batch-1",
    status: overrides.status ?? "VALIDATED",
    type: overrides.type ?? GEDCOM_IMPORT_TYPE,
    reportJson: {
      filename: "keluarga.ged",
      data: {
        charSet: "UTF-8",
        persons: [
          {
            gedcomId: "@I1@",
            fullName: "Budi Santoso",
            gender: "MALE",
            birthDate: new Date(Date.UTC(1980, 0, 12)),
            birthPlace: "Yogyakarta",
            deathDate: null,
            deathPlace: undefined,
            isDeceased: false,
          },
          {
            gedcomId: "@I2@",
            fullName: "Siti Rahayu",
            gender: "FEMALE",
            birthDate: null,
            deathDate: null,
            isDeceased: false,
          },
        ],
        families: [
          {
            gedcomId: "@F1@",
            husband: "@I1@",
            wife: "@I2@",
            children: [],
            marriageDate: null,
            divorceDate: null,
            status: "MARRIED",
          },
        ],
      },
      errors: [],
      warnings: [],
      counts: { total: 2, personsCreated: 2, personsSkipped: 0, childEdgesCreated: 0, partnerEdgesCreated: 1 },
    },
    ...overrides.payload,
  };
}

function reset() {
  batch = validBatch();
  actor = { id: "admin-1", isActive: true, role: "SUPER_ADMIN", mustChangeCredentials: false };
  failTransactionWith = null;
  personFindUniqueResults = new Map();
  personCreates = [];
  personChildCreates = [];
  personPartnerCreates = [];
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
  const mod = await import("./commit");
  commitGedcomImport = mod.commitGedcomImport;
  GedcomImportError = mod.GedcomImportError;
});

after(() => {
  if (previousPrisma === undefined) delete globalCache.prisma;
  else globalCache.prisma = previousPrisma;
});

beforeEach(reset);

describe("commitGedcomImport — happy path", () => {
  test("mengunci baris batch dan memakai transaksi serializable dengan timeout", async () => {
    await commitGedcomImport("batch-1", "admin-1");
    assert.strictEqual(queryRawCalls.length, 1);
    assert.ok(transactionOptions);
    assert.strictEqual(transactionOptions!.isolationLevel, "Serializable");
    assert.strictEqual(transactionOptions!.timeout, 120_000);
    assert.strictEqual(transactionOptions!.maxWait, 10_000);
  });

  test("membuat Person baru dan PersonPartner", async () => {
    const result = await commitGedcomImport("batch-1", "admin-1");
    assert.strictEqual(personCreates.length, 2);
    assert.strictEqual(personCreates[0].fullName, "Budi Santoso");
    assert.strictEqual(personCreates[0].gender, "MALE");
    assert.strictEqual(personCreates[0].externalRef, "@I1@");
    assert.strictEqual(personPartnerCreates.length, 1);
    assert.strictEqual(result.counts.personsCreated, 2);
    assert.strictEqual(result.counts.partnerEdgesCreated, 1);
    assert.strictEqual(result.skipped, 0);
  });

  test("menandai batch COMMITTED + menulis audit log", async () => {
    await commitGedcomImport("batch-1", "admin-1");
    assert.ok(batchUpdateArgs);
    assert.deepStrictEqual(batchUpdateArgs!.where, { id: "batch-1" });
    assert.strictEqual(batchUpdateArgs!.data.status, "COMMITTED");
    assert.strictEqual(batchUpdateArgs!.data.successRows, 2);
    assert.ok(auditArgs);
    assert.strictEqual(auditArgs!.action, "GEDCOM_IMPORT_COMMIT");
    assert.strictEqual(auditArgs!.entityType, "ImportBatch");
    assert.strictEqual(auditArgs!.entityId, "batch-1");
    assert.strictEqual(auditArgs!.actorUserId, "admin-1");
  });

  test("orang yang sudah ada dilewati, relasi tetap terbentuk", async () => {
    personFindUniqueResults.set("@I1@", { id: "existing-1" });
    const result = await commitGedcomImport("batch-1", "admin-1");
    assert.strictEqual(personCreates.length, 1); // hanya Siti yang dibuat
    assert.strictEqual(personPartnerCreates.length, 1);
    assert.strictEqual(result.counts.personsCreated, 1);
    assert.strictEqual(result.counts.personsSkipped, 1);
    assert.strictEqual(result.skipped, 1);
  });
});

describe("commitGedcomImport — guard errors", () => {
  test("batch tidak ditemukan -> 404", async () => {
    batch = null;
    await assert.rejects(
      () => commitGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.ok(error instanceof GedcomImportError);
        assert.strictEqual(error.status, 404);
        return true;
      },
    );
  });

  test("batch sudah diproses -> 409", async () => {
    batch = validBatch({ status: "COMMITTED" });
    await assert.rejects(
      () => commitGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        return true;
      },
    );
  });

  test("type batch salah -> 409", async () => {
    batch = validBatch({ type: "REGISTRASI" });
    await assert.rejects(
      () => commitGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        return true;
      },
    );
  });

  test("aktor bukan Super Admin -> 403", async () => {
    actor = { id: "admin-1", isActive: true, role: "MEMBER", mustChangeCredentials: false };
    await assert.rejects(
      () => commitGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 403);
        assert.strictEqual(error.message, "Akses impor ditolak.");
        return true;
      },
    );
  });

  test("aktor nonaktif / harus ganti kredensial -> 403", async () => {
    actor = { id: "admin-1", isActive: false, role: "SUPER_ADMIN", mustChangeCredentials: false };
    await assert.rejects(() => commitGedcomImport("batch-1", "admin-1"), /Akses impor ditolak/);
    actor = { id: "admin-1", isActive: true, role: "SUPER_ADMIN", mustChangeCredentials: true };
    await assert.rejects(() => commitGedcomImport("batch-1", "admin-1"), /Akses impor ditolak/);
  });

  test("Prisma P2034 -> dipetakan ke 409 retry", async () => {
    failTransactionWith = new Prisma.PrismaClientKnownRequestError("Serialization failure", {
      code: "P2034",
      clientVersion: "test",
    });
    await assert.rejects(
      () => commitGedcomImport("batch-1", "admin-1"),
      (error: InstanceType<typeof GedcomImportError>) => {
        assert.strictEqual(error.status, 409);
        assert.match(error.message, /Muat ulang laporan/);
        return true;
      },
    );
  });
});