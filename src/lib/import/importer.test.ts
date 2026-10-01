import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import type { ParsedData } from "./types";

// ── Mock batas database ───────────────────────────────────────────────────────
// `commitImportData` dan `analyzeImportData` memakai `prisma` global, jadi tes
// memasang Prisma palsu sebelum modul diimpor (pola sama seperti validate.test).

type Row = Record<string, unknown>;
type Query = { where?: Row; select?: Row; data?: Row };

type PersonCreate = { data: { fullName: string; nickname?: string | null; namaPanggilan?: string | null } };

let personCreates: PersonCreate[];
let branchRows: Row[];
let existingPeople: Row[];
let takenUsers: Row[];
let globalCache: typeof globalThis & { prisma?: PrismaClient };
let previousPrisma: PrismaClient | undefined;
let hashImportPasswords: typeof import("./importer").hashImportPasswords;
let sanitizePreviewData: typeof import("./importer").sanitizePreviewData;
let ImportError: typeof import("./importer").ImportError;
let BCRYPT_ROUNDS: number;
let commitImportData: typeof import("./importer").commitImportData;
let analyzeImportData: typeof import("./importer").analyzeImportData;

const fakePrisma = {
  branch: {
    async findMany() {
      return structuredClone(branchRows);
    },
  },
  person: {
    async findMany() {
      return structuredClone(existingPeople);
    },
  },
  user: {
    async findMany() {
      return structuredClone(takenUsers);
    },
  },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
};

const tx = {
  async $queryRaw() {
    return [];
  },
  importBatch: {
    async findUnique() {
      return {
        id: "batch-1",
        status: "VALIDATED",
        reportJson: { data: validData(), errors: [], warnings: [], credentials: [] },
      };
    },
    async update() {
      return {};
    },
  },
  user: {
    async findUnique() {
      return { id: "admin-1", isActive: true, role: "SUPER_ADMIN", mustChangeCredentials: false };
    },
    async findMany() {
      return [];
    },
    async create({ data }: Query) {
      return { ...data, id: "user-1" };
    },
  },
  person: {
    async findMany() {
      return [];
    },
    async create({ data }: PersonCreate) {
      personCreates.push({ data: data as PersonCreate["data"] });
      return { id: `person-${personCreates.length}` };
    },
  },
  personPrivate: {
    async upsert() {
      return {};
    },
  },
  auditLog: {
    async create() {
      return {};
    },
  },
};

function validData(): ParsedData {
  return {
    anggota: [
      {
        _row: 2,
        cabangKe: "1",
        namaLengkap: "Budi Santoso",
        nickname: "budi",
        namaPanggilan: "Budi Manis",
        passwordHash: "$2a$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQ",
        jenisKelamin: "MALE",
      },
    ],
  };
}

before(async () => {
  personCreates = [];
  branchRows = [{ id: "branch-1", branchNumber: 1, name: "Cabang Satu", isActive: true }];
  existingPeople = [];
  takenUsers = [];

  globalCache = globalThis as typeof globalThis & { prisma?: PrismaClient };
  previousPrisma = globalCache.prisma;
  globalCache.prisma = fakePrisma as unknown as PrismaClient;

  const module = await import("./importer");
  hashImportPasswords = module.hashImportPasswords;
  sanitizePreviewData = module.sanitizePreviewData;
  ImportError = module.ImportError;
  BCRYPT_ROUNDS = module.BCRYPT_ROUNDS;
  commitImportData = module.commitImportData;
  analyzeImportData = module.analyzeImportData;
});

after(() => {
  if (previousPrisma === undefined) delete globalCache.prisma;
  else globalCache.prisma = previousPrisma;
});

function data(): ParsedData {
  return {
    anggota: [
      {
        _row: 2,
        cabangKe: "1",
        namaLengkap: "Budi Santoso",
        nickname: "budi",
        namaPanggilan: "Budi Manis",
        password: "rahasia123",
        jenisKelamin: "MALE",
      },
      {
        _row: 3,
        cabangKe: "2",
        namaLengkap: "Tanpa Password",
        nickname: "tanpa",
        namaPanggilan: "Si Tanpa",
        jenisKelamin: "FEMALE",
      },
    ],
  };
}

test("hashImportPasswords uses bcrypt 12 rounds and removes plaintext", async () => {
  const hashed = await hashImportPasswords(data());
  const [first, second] = hashed.anggota;
  assert.equal(first.password, undefined);
  assert.ok(first.passwordHash);
  assert.equal(bcrypt.getRounds(first.passwordHash!), BCRYPT_ROUNDS);
  assert.ok(await bcrypt.compare("rahasia123", first.passwordHash!));
  assert.equal(second.password, undefined);
  assert.equal(second.passwordHash, undefined);
});

test("hashImportPasswords mempertahankan nickname dan nama panggilan", async () => {
  const hashed = await hashImportPasswords(data());
  assert.equal(hashed.anggota[0].nickname, "budi");
  assert.equal(hashed.anggota[0].namaPanggilan, "Budi Manis");
});

test("sanitizePreviewData removes password fields without mutating input", () => {
  const input = data();
  const sanitized = sanitizePreviewData(input);
  assert.ok(!("password" in sanitized.anggota[0]));
  assert.ok(!("passwordHash" in sanitized.anggota[0]));
  assert.equal(input.anggota[0].password, "rahasia123", "input tidak boleh berubah");
  assert.equal(sanitized.anggota[0].nickname, "budi");
  assert.equal(sanitized.anggota[0].namaPanggilan, "Budi Manis");
});

test("ImportError carries status and row errors", () => {
  const error = new ImportError("Keluarga Cabang 'X' tidak ditemukan", 400, [
    { sheet: "Data", row: 2, field: "kode cabang keluarga", message: "Keluarga Cabang 'X' tidak ditemukan" },
  ]);
  assert.equal(error.status, 400);
  assert.equal(error.errors.length, 1);
  assert.ok(error instanceof Error);
});

test("importer menulis nickname dan namaPanggilan ke Person secara terpisah", async () => {
  personCreates = [];
  await commitImportData("batch-1", "admin-1");
  assert.equal(personCreates.length, 1);
  assert.equal(personCreates[0].data.nickname, "budi");
  assert.equal(personCreates[0].data.namaPanggilan, "Budi Manis");
});

test("username diturunkan dari nickname, bukan nama panggilan", async () => {
  personCreates = [];
  const plan = await analyzeImportData(validData());
  assert.equal(plan.credentials[0].username, "budi");
});
