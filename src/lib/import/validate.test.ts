import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { Gender, ImportRowAnggota, ParsedData } from "./types";

type Row = Record<string, unknown>;
type Query = { where?: Row; select?: Row };

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return (expected as Row[]).some((condition) => matches(row, condition));
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const filter = expected as Row;
      if ("in" in filter) return (filter.in as unknown[]).includes(row[key]);
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

let branches: Row[];
let globalCache: typeof globalThis & { prisma?: PrismaClient };
let previousPrisma: PrismaClient | undefined;
let validateImportData: typeof import("./validate").validateImportData;

const fakePrisma = {
  branch: {
    async findMany({ where }: Query = {}) {
      return structuredClone(branches.filter((row) => matches(row, where)));
    },
    async findUnique({ where }: Query) {
      return structuredClone(branches.find((row) => matches(row, where)) ?? null);
    },
  },
};

function anggota(row: Partial<ImportRowAnggota> = {}): ImportRowAnggota {
  return {
    cabangKe: "1",
    namaLengkap: "Budi Santoso",
    namaPanggilan: "budi",
    password: "rahasia123",
    jenisKelamin: "MALE" as Gender,
    ...row,
  };
}

function validate(data: ParsedData) {
  return validateImportData(data);
}

function errorFields(result: { errors: { field: string }[] }): string[] {
  return result.errors.map((error) => error.field);
}

before(async () => {
  globalCache = globalThis as typeof globalThis & { prisma?: PrismaClient };
  previousPrisma = globalCache.prisma;
  globalCache.prisma = fakePrisma as unknown as PrismaClient;
  const module = await import("./validate");
  validateImportData = module.validateImportData;
});

after(() => {
  if (previousPrisma === undefined) delete globalCache.prisma;
  else globalCache.prisma = previousPrisma;
});

beforeEach(() => {
  branches = [
    { id: "branch-1", branchNumber: 1, name: "Cabang Satu", slug: "cabang-satu", isActive: true },
    { id: "branch-5", branchNumber: 5, name: "Cabang Lima", slug: "cabang-lima", isActive: true },
    { id: "branch-x", branchNumber: 9, name: "Cabang X", slug: "cabang-x", isActive: false },
  ];
});

test("validates rows with all required fields", async () => {
  const result = await validate({
    anggota: [
      anggota({ _row: 2, cabangKe: "1" }),
      anggota({ _row: 3, cabangKe: "5", namaLengkap: "Siti Aminah", namaPanggilan: "siti" }),
    ],
  });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.data.anggota[0].branchId, "branch-1");
  assert.strictEqual(result.data.anggota[1].branchId, "branch-5");
  assert.strictEqual(result.data.anggota[1].branchNumber, 5);
});

test("resolves branch code by case-insensitive name when not a number", async () => {
  const result = await validate({ anggota: [anggota({ cabangKe: "  cabang lima " })] });
  assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
  assert.strictEqual(result.data.anggota[0].branchId, "branch-5");
});

test("branch number wins over name when both could match", async () => {
  const result = await validate({ anggota: [anggota({ cabangKe: "1" })] });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.data.anggota[0].branchId, "branch-1");
});

test("unknown branch reports Indonesian row error", async () => {
  const result = await validate({ anggota: [anggota({ _row: 7, cabangKe: "Tidak Ada" })] });
  assert.strictEqual(result.valid, false);
  const branchError = result.errors.find((error) => error.field === "kode cabang keluarga");
  assert.ok(branchError, "harus ada error cabang");
  assert.strictEqual(branchError.row, 7);
  assert.match(branchError.message, /^Cabang 'Tidak Ada' tidak ditemukan$/);
});

test("inactive branch is reported as not found", async () => {
  const result = await validate({ anggota: [anggota({ cabangKe: "9" })] });
  assert.strictEqual(result.valid, false);
  assert.ok(
    result.errors.some(
      (error) => error.field === "kode cabang keluarga" && error.message === "Cabang '9' tidak ditemukan",
    ),
  );
});

test("rejects missing required fields with Indonesian messages", async () => {
  const result = await validate({
    anggota: [{ _row: 2, cabangKe: "1", namaLengkap: "", jenisKelamin: "MALE" as Gender }],
  });
  assert.strictEqual(result.valid, false);
  const fields = errorFields(result);
  assert.ok(fields.includes("nickname"));
  assert.ok(fields.includes("password"));
  assert.ok(fields.includes("nama_lengkap"));
  assert.ok(
    result.errors.some((error) => error.field === "nama_lengkap" && /nama lengkap wajib/i.test(error.message)),
  );
});

test("rejects missing branch code", async () => {
  const result = await validate({ anggota: [anggota({ cabangKe: "   " })] });
  assert.ok(errorFields(result).includes("kode cabang keluarga"));
});

test("nickname must be 2-50 characters and is trimmed", async () => {
  const short = await validate({ anggota: [anggota({ namaPanggilan: "a" })] });
  assert.ok(short.errors.some((error) => error.field === "nickname" && /2-50/.test(error.message)));

  const long = await validate({ anggota: [anggota({ namaPanggilan: "x".repeat(51) })] });
  assert.ok(long.errors.some((error) => error.field === "nickname" && /2-50/.test(error.message)));

  const ok = await validate({ anggota: [anggota({ namaPanggilan: "  budi  " })] });
  assert.strictEqual(ok.valid, true, JSON.stringify(ok.errors));
  assert.strictEqual(ok.data.anggota[0].namaPanggilan, "budi");
});

test("password must be at least 8 characters and never leaks into messages", async () => {
  const short = await validate({ anggota: [anggota({ password: "1234567" })] });
  assert.ok(short.errors.some((error) => error.field === "password" && /8/.test(error.message)));
  const allText = short.errors.map((error) => error.message).join(" ");
  assert.ok(!allText.includes("1234567"), "password tidak boleh muncul di pesan error");

  const missing = await validate({ anggota: [anggota({ password: "" })] });
  assert.ok(missing.errors.some((error) => error.field === "password"));
});

test("optional fields validate and normalize", async () => {
  const invalid = await validate({ anggota: [anggota({ tanggalLahir: "31/02/2024" })] });
  assert.ok(invalid.errors.some((error) => error.field === "tanggal_lahir"));

  const valid = await validate({
    anggota: [
      anggota({
        tanggalLahir: "15/01/1990",
        tempatLahir: " Jakarta ",
        nomorTelepon: " 0812 ",
        alamatDomisili: " Jl. A ",
        kotaDomisili: " Bandung ",
      }),
    ],
  });
  assert.strictEqual(valid.valid, true, JSON.stringify(valid.errors));
  const row = valid.data.anggota[0];
  assert.strictEqual(row.tanggalLahir, "1990-01-15");
  assert.strictEqual(row.tempatLahir, "Jakarta");
  assert.strictEqual(row.nomorTelepon, "0812");
  assert.strictEqual(row.alamatDomisili, "Jl. A");
  assert.strictEqual(row.kotaDomisili, "Bandung");

  const empty = await validate({ anggota: [anggota({ tanggalLahir: "" })] });
  assert.strictEqual(empty.valid, true);
  assert.strictEqual(empty.data.anggota[0].tanggalLahir, undefined);
});

test("gender aliases normalize and empty gender becomes OTHER with warning", async () => {
  const result = await validate({
    anggota: [
      anggota({ jenisKelamin: "Laki-laki" as Gender }),
      anggota({ jenisKelamin: "l" as Gender }),
      anggota({ jenisKelamin: "P" as Gender }),
      anggota({ jenisKelamin: "Perempuan" as Gender }),
      anggota({ jenisKelamin: "" as Gender }),
    ],
  });
  assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
  assert.strictEqual(result.data.anggota[0].jenisKelamin, "MALE");
  assert.strictEqual(result.data.anggota[1].jenisKelamin, "MALE");
  assert.strictEqual(result.data.anggota[2].jenisKelamin, "FEMALE");
  assert.strictEqual(result.data.anggota[3].jenisKelamin, "FEMALE");
  assert.strictEqual(result.data.anggota[4].jenisKelamin, "OTHER");
  assert.ok(result.warnings.includes("Gender kosong, diisi OTHER"));
});

test("invalid gender is a row error", async () => {
  const result = await validate({ anggota: [anggota({ jenisKelamin: "UNKNOWN" as Gender })] });
  assert.strictEqual(result.valid, false);
  assert.ok(errorFields(result).includes("gender"));
});

test("accepts a pre-hashed password at commit time without re-checking length", async () => {
  const result = await validate({
    anggota: [
      anggota({
        password: undefined,
        passwordHash: "$2a$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQ",
      }),
    ],
  });
  assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
  assert.strictEqual(result.errors.length, 0);
});

test("empty import is rejected", async () => {
  const result = await validate({ anggota: [] });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((error) => /kosong/.test(error.message)));
});

test("validation keeps password for hashing and does not add relation payloads", async () => {
  const result = await validate({ anggota: [anggota()] });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.data.anggota[0].password, "rahasia123");
  assert.ok(!("relasi" in result.data));
  assert.ok(!("akun" in result.data));
});
