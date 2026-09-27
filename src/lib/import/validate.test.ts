import { test } from "node:test";
import assert from "node:assert";
import { validateImportData } from "./validate";
import type { ParsedData } from "./types";

test("validates rows with all required fields", async () => {
  const data: ParsedData = {
    anggota: [
      { _row: 2, cabangKe: 1, namaLengkap: "Budi Santoso", jenisKelamin: "MALE" },
      { _row: 3, cabangKe: 5, namaLengkap: "Siti Aminah", jenisKelamin: "FEMALE" },
    ],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test("validates rows with nullable optional fields", async () => {
  const data: ParsedData = {
    anggota: [
      {
        _row: 2,
        cabangKe: 3,
        namaLengkap: "Ahmad Yani",
        jenisKelamin: "MALE",
        namaPanggilan: "Yani",
        tempatLahir: "Jakarta",
        tanggalLahir: "1990-05-15",
        kotaDomisili: "Bandung",
        nomorTelepon: "081234567890",
        catatan: "Catatan tambahan",
      },
    ],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test("rejects missing full name", async () => {
  const data: ParsedData = {
    anggota: [{ _row: 2, cabangKe: 1, namaLengkap: "", jenisKelamin: "MALE" }],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.errors.length, 1);
  assert.strictEqual(result.errors[0].field, "nama_lengkap");
  assert.match(result.errors[0].message, /nama lengkap wajib/i);
});

test("rejects missing gender", async () => {
  const data: ParsedData = {
    anggota: [{ _row: 2, cabangKe: 1, namaLengkap: "Budi Santoso", jenisKelamin: "" as any }],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "jenis_kelamin"));
});

test("rejects invalid branch number (zero)", async () => {
  const data: ParsedData = {
    anggota: [{ _row: 2, cabangKe: 0, namaLengkap: "Budi Santoso", jenisKelamin: "MALE" }],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "cabang_ke" && /1.*10/.test(e.message)));
});

test("rejects invalid branch number (11)", async () => {
  const data: ParsedData = {
    anggota: [{ _row: 2, cabangKe: 11, namaLengkap: "Budi Santoso", jenisKelamin: "MALE" }],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "cabang_ke" && /1.*10/.test(e.message)));
});

test("rejects invalid date format", async () => {
  const data: ParsedData = {
    anggota: [
      {
        _row: 2,
        cabangKe: 1,
        namaLengkap: "Budi Santoso",
        jenisKelamin: "MALE",
        tanggalLahir: "1990-13-45",
      },
    ],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "tanggal_lahir"));
});

test("rejects duplicate external reference", async () => {
  const data: ParsedData = {
    anggota: [
      { _row: 2, cabangKe: 1, namaLengkap: "Budi Santoso", jenisKelamin: "MALE", ref: "EXT001" },
      { _row: 3, cabangKe: 2, namaLengkap: "Siti Aminah", jenisKelamin: "FEMALE", ref: "EXT001" },
    ],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "ref" && /duplikat/i.test(e.message)));
});

test("normalizes gender aliases", async () => {
  const data: ParsedData = {
    anggota: [
      { _row: 2, cabangKe: 1, namaLengkap: "Budi", jenisKelamin: "L" as any },
      { _row: 3, cabangKe: 2, namaLengkap: "Siti", jenisKelamin: "P" as any },
    ],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.data.anggota[0].jenisKelamin, "MALE");
  assert.strictEqual(result.data.anggota[1].jenisKelamin, "FEMALE");
});

test("generates no relation or account payload", async () => {
  const data: ParsedData = {
    anggota: [{ _row: 2, cabangKe: 1, namaLengkap: "Budi Santoso", jenisKelamin: "MALE" }],
  };
  const result = await validateImportData(data);
  assert.strictEqual(result.valid, true);
  // New structure should not have relasi or akun
  assert.ok(!("relasi" in result.data) || !result.data.relasi);
  assert.ok(!("akun" in result.data) || !result.data.akun);
});
