import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { GEDCOM_IMPORT_TYPE } from "./types";

type Row = Record<string, unknown>;

/**
 * Integrasi commit → rollback pada satu mock prisma yang sama. Menjalankan
 * alur nyata: upload(validated) → commit (menyimpan snapshot id) → rollback
 * (menghapus id snapshot yang sama). Memastikan rollback menghapus persis
 * baris yang diciptakan commit, bukan menebak.
 */

let actor: Row;
let batch: Row;
let seq: number;
let existingByRef: Map<string, Row>;
let partnerDeletes: Row[];
let childDeletes: Row[];
let personDeletes: Row[];
let auditLogs: Row[];

const tx = {
  async $queryRaw() {
    return [];
  },
  user: {
    async findUnique() {
      return actor;
    },
  },
  importBatch: {
    async findUnique() {
      return { ...batch };
    },
    async update({ data }: { where: Row; data: Row }) {
      batch = { ...batch, ...data };
      return batch;
    },
  },
  person: {
    async findUnique({ where }: { where: { externalRef: string } }) {
      return existingByRef.get(where.externalRef) ?? null;
    },
    async create({ data }: { data: Row }) {
      const id = `person-${++seq}`;
      const row = { id, ...data };
      existingByRef.set(data.externalRef as string, row);
      return row;
    },
    async deleteMany({ where }: { where: Row }) {
      personDeletes.push(where);
      return { count: (where.id as { in: string[] }).in.length };
    },
  },
  personChild: {
    async create() {
      return { id: `child-${++seq}` };
    },
    async deleteMany({ where }: { where: Row }) {
      childDeletes.push(where);
      return { count: (where.id as { in: string[] }).in.length };
    },
  },
  personPartner: {
    async create() {
      return { id: `partner-${++seq}` };
    },
    async deleteMany({ where }: { where: Row }) {
      partnerDeletes.push(where);
      return { count: (where.id as { in: string[] }).in.length };
    },
  },
  auditLog: {
    async create({ data }: { data: Row }) {
      auditLogs.push(data);
      return {};
    },
  },
};

const fakePrisma = {
  async $transaction(fn: (tx: unknown) => Promise<unknown>, options: Row) {
    void options;
    return fn(tx);
  },
};

let globalCache: typeof globalThis & { prisma?: PrismaClient };
let previousPrisma: PrismaClient | undefined;
let commitGedcomImport: typeof import("./commit").commitGedcomImport;
let rollbackGedcomImport: typeof import("./rollback").rollbackGedcomImport;

function validBatch() {
  return {
    id: "batch-1",
    type: GEDCOM_IMPORT_TYPE,
    status: "VALIDATED",
    reportJson: {
      filename: "keluarga.ged",
      errors: [],
      warnings: [],
      counts: { total: 2, personsCreated: 2, personsSkipped: 0, childEdgesCreated: 0, partnerEdgesCreated: 1 },
      data: {
        charSet: "UTF-8",
        persons: [
          {
            gedcomId: "@I1@",
            fullName: "Budi Santoso",
            gender: "MALE",
            birthDate: null,
            deathDate: null,
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
            status: "MARRIED",
            marriageDate: null,
            divorceDate: null,
          },
        ],
      },
    },
  };
}

function reset() {
  actor = { id: "admin-1", isActive: true, role: "SUPER_ADMIN", mustChangeCredentials: false };
  batch = validBatch();
  seq = 0;
  existingByRef = new Map();
  partnerDeletes = [];
  childDeletes = [];
  personDeletes = [];
  auditLogs = [];
}

before(async () => {
  reset();
  globalCache = globalThis as typeof globalThis & { prisma?: PrismaClient };
  previousPrisma = globalCache.prisma;
  globalCache.prisma = fakePrisma as unknown as PrismaClient;
  const commitMod = await import("./commit");
  commitGedcomImport = commitMod.commitGedcomImport;
  const rollbackMod = await import("./rollback");
  rollbackGedcomImport = rollbackMod.rollbackGedcomImport;
});

after(() => {
  if (previousPrisma === undefined) delete globalCache.prisma;
  else globalCache.prisma = previousPrisma;
});

beforeEach(reset);

describe("integrasi commit → rollback", () => {
  test("rollback menghapus persis snapshot id hasil commit", async () => {
    const commitResult = await commitGedcomImport("batch-1", "admin-1");
    assert.strictEqual(commitResult.counts.personsCreated, 2);
    assert.strictEqual(commitResult.counts.partnerEdgesCreated, 1);
    assert.strictEqual(batch.status, "COMMITTED");

    const payload = batch.reportJson as {
      createdPersonIds: string[];
      createdChildEdgeIds: string[];
      createdPartnerEdgeIds: string[];
    };
    assert.strictEqual(payload.createdPersonIds.length, 2);
    assert.strictEqual(payload.createdPartnerEdgeIds.length, 1);
    assert.deepStrictEqual(payload.createdChildEdgeIds, []);
    const snapshotPersonIds = [...payload.createdPersonIds];
    const snapshotPartnerIds = [...payload.createdPartnerEdgeIds];

    const rollbackResult = await rollbackGedcomImport("batch-1", "admin-1");
    assert.deepStrictEqual(rollbackResult, {
      removedPersons: 2,
      removedChildEdges: 0,
      removedPartnerEdges: 1,
    });

    // Urutan delete: partner → child → person, dengan id persis dari snapshot.
    assert.deepStrictEqual(partnerDeletes[0], { id: { in: snapshotPartnerIds } });
    assert.strictEqual(childDeletes.length, 0);
    assert.deepStrictEqual(personDeletes[0], { id: { in: snapshotPersonIds } });

    // Batch ditandai dibatalkan dan tidak bisa di-rollback dua kali.
    assert.ok(batch.rolledBackAt instanceof Date);
    const payloadAfter = batch.reportJson as { createdPersonIds: string[] };
    assert.strictEqual(payloadAfter.createdPersonIds.length, 2);

    await assert.rejects(
      () => rollbackGedcomImport("batch-1", "admin-1"),
      (error: Error & { status?: number }) => {
        assert.strictEqual(error.status, 409);
        return true;
      },
    );

    // Audit mencatat commit lalu rollback.
    const actions = auditLogs.map((log) => log.action);
    assert.ok(actions.includes("GEDCOM_IMPORT_COMMIT"));
    assert.ok(actions.includes("GEDCOM_IMPORT_ROLLBACK"));
  });

  test("commit ulang setelah rollback tidak mungkin (status tetap COMMITTED)", async () => {
    await commitGedcomImport("batch-1", "admin-1");
    await rollbackGedcomImport("batch-1", "admin-1");

    // Commit ulang ditolak karena status batch masih COMMITTED (rollback hanya
    // menandai dibatalkan, tidak mengubah status).
    await assert.rejects(
      () => commitGedcomImport("batch-1", "admin-1"),
      (error: Error & { status?: number }) => {
        assert.strictEqual(error.status, 409);
        return true;
      },
    );
  });
});
