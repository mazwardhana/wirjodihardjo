import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { hashImportPasswords, sanitizePreviewData, ImportError, BCRYPT_ROUNDS } from "./importer";
import type { ParsedData } from "./types";

function data(): ParsedData {
  return {
    anggota: [
      {
        _row: 2,
        cabangKe: "1",
        namaLengkap: "Budi Santoso",
        namaPanggilan: "budi",
        password: "rahasia123",
        jenisKelamin: "MALE",
      },
      {
        _row: 3,
        cabangKe: "2",
        namaLengkap: "Tanpa Password",
        namaPanggilan: "tanpa",
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

test("sanitizePreviewData removes password fields without mutating input", () => {
  const input = data();
  const sanitized = sanitizePreviewData(input);
  assert.ok(!("password" in sanitized.anggota[0]));
  assert.ok(!("passwordHash" in sanitized.anggota[0]));
  assert.equal(input.anggota[0].password, "rahasia123", "input tidak boleh berubah");
});

test("ImportError carries status and row errors", () => {
  const error = new ImportError("Cabang 'X' tidak ditemukan", 400, [
    { sheet: "Data", row: 2, field: "kode cabang keluarga", message: "Cabang 'X' tidak ditemukan" },
  ]);
  assert.equal(error.status, 400);
  assert.equal(error.errors.length, 1);
  assert.ok(error instanceof Error);
});
