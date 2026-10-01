import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "csv-parse/sync";
import { generateCredentialCSV, generateErrorCSV } from "../src/lib/import/report";
import type { ImportCredential } from "../src/lib/import/types";

type Row = Record<string, string>;

const credentials: ImportCredential[] = [
  { fullName: "Budi Santoso", username: "budi", role: "MEMBER", isNew: true, status: "dibuat" },
  { fullName: "Siti Aminah", username: "", role: "MEMBER", isNew: false, status: "sudah ada, dilewati" },
];

test("credential CSV lists username, name, role, and status per row", () => {
  const rows = parse(generateCredentialCSV(credentials), { columns: true }) as Row[];
  assert.equal(rows.length, 2);
  assert.equal(rows[0]["Username"], "budi");
  assert.equal(rows[0]["Nama Lengkap"], "Budi Santoso");
  assert.equal(rows[0]["Peran"], "MEMBER");
  assert.equal(rows[0]["Status"], "dibuat");
  assert.equal(rows[1]["Status"], "sudah ada, dilewati");
  assert.equal(rows[1]["Username"], "");
});

test("credential CSV never contains a password column or plaintext password", () => {
  const csv = generateCredentialCSV(credentials).toString("utf-8");
  const header = csv.split("\n")[0].toLowerCase();
  assert.ok(!header.includes("password"), "header tidak boleh punya kolom password");
  assert.ok(!csv.includes("rahasia"), "plain password tidak boleh muncul di CSV");

  const rows = parse(csv, { columns: true }) as Row[];
  for (const row of rows) {
    for (const value of Object.values(row)) {
      assert.ok(!value.includes("$2"), "hash tidak boleh muncul di CSV");
    }
  }
});

test("spreadsheet formulas are escaped in credentials and errors", () => {
  const escaped = generateCredentialCSV([
    { fullName: '=HYPERLINK("https://example.test")', username: "budi", role: "MEMBER", isNew: true, status: "dibuat" },
  ]);
  const rows = parse(escaped, { columns: true }) as Row[];
  assert.ok(rows[0]["Nama Lengkap"].startsWith("'="));

  const errors = parse(
    generateErrorCSV([{ sheet: "Data", row: 2, field: "password", message: "=1+1" }]),
    { columns: true },
  ) as Row[];
  assert.equal(errors[0]["Pesan Error"], "'=1+1");
});

test("error CSV keeps Indonesian column labels and row numbers", () => {
  const rows = parse(
    generateErrorCSV([
      { sheet: "Data", row: 7, field: "kode cabang keluarga", message: "Keluarga Cabang 'X' tidak ditemukan" },
    ]),
    { columns: true },
  ) as Row[];
  assert.equal(rows[0]["Sheet"], "Data");
  assert.equal(rows[0]["Baris"], "7");
  assert.equal(rows[0]["Kolom"], "kode cabang keluarga");
  assert.equal(rows[0]["Pesan Error"], "Keluarga Cabang 'X' tidak ditemukan");
});
