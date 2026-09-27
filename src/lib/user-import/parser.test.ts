import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";
import { parseUserImportCsv, type UserImportRow } from "./parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rows(csv: string): UserImportRow[] {
  return parseUserImportCsv(csv);
}

// ─── Basic parsing ─────────────────────────────────────────────────────────────

describe("parseUserImportCsv — valid rows", () => {
  test("parses a minimal row with all fields", () => {
    const r = rows("budi_w,Password123!,Budi Wirjodihardjo,budi@example.com\n");
    assert.equal(r.length, 1);
    assert.equal(r[0].username, "budi_w");
    assert.equal(r[0].password, "Password123!");
    assert.equal(r[0].namaLengkap, "Budi Wirjodihardjo");
    assert.equal(r[0].email, "budi@example.com");
    assert.equal(r[0].line, 1);
  });

  test("maps camelCase field namaLengkap", () => {
    const r = rows("u1,P@ssword1!,Nama Lengkap,\n");
    assert.equal(r[0].namaLengkap, "Nama Lengkap");
    assert.equal(r[0].email, null);
    assert.equal(r[0].line, 1);
  });

  test("maps email column to null when empty string", () => {
    const r = rows("siti_a,TempPass456!,Siti Aminah,\n");
    assert.equal(r[0].email, null);
  });

  test("parses multiple rows in order", () => {
    const r = rows(
      "u1,Pass1!,Ahmad Basuki,ahmad@example.com\n" +
      "u2,Pass2!,Siti Aminah,siti@example.com\n" +
      "u3,Pass3!,Budi Wirjodihardjo,\n",
    );
    assert.equal(r.length, 3);
    assert.equal(r[0].username, "u1");
    assert.equal(r[1].username, "u2");
    assert.equal(r[2].username, "u3");
  });

  test("skips empty lines", () => {
    const r = rows("\n\nbudi_w,Pass1!,Budi,\n\n\n");
    assert.equal(r.length, 1);
    assert.equal(r[0].username, "budi_w");
  });

  test("handles CRLF line endings", () => {
    const r = parseUserImportCsv("budi_w,Pass1!,Budi,budi@x.com\r\n");
    assert.equal(r.length, 1);
    assert.equal(r[0].username, "budi_w");
  });

  test("handles BOM prefix", () => {
    const r = parseUserImportCsv("\uFEFFusername,password,nama_lengkap,email\nbudi_w,Pass1!,Budi,budi@x.com\n");
    assert.equal(r.length, 1);
    assert.equal(r[0].username, "budi_w");
  });
});

// ─── Header handling ──────────────────────────────────────────────────────────

describe("parseUserImportCsv — header detection", () => {
  test("accepts header row and skips it", () => {
    const r = rows(
      "username,password,nama_lengkap,email\n" +
      "budi_w,Pass1!,Budi Wirjodihardjo,budi@example.com\n",
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].username, "budi_w");
    assert.equal(r[0].line, 2);
  });

  test("accepts header with spaces around names", () => {
    const r = rows(
      "  username , password , nama_lengkap , email \n" +
      "budi_w,Pass1!,Budi,\n",
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].username, "budi_w");
  });

  test("detects header case-insensitively", () => {
    const r = rows(
      "USERNAME,PASSWORD,NAMA_LENGKAP,EMAIL\n" +
      "budi_w,Pass1!,Budi,\n",
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].namaLengkap, "Budi");
  });

  test("data row starting with 'username' is treated as data when no other header present", () => {
    // Without a proper header row, "username" in first cell means the
    // parser detects no header (header requires username+password+nama_lengkap).
    // A row where the first cell IS the literal word "username" is valid data.
    const r = rows("username,Pass1!,Nama,\n");
    assert.equal(r.length, 1);
    assert.equal(r[0].username, "username");
    assert.equal(r[0].line, 1);
  });

  test("header columns in different order are mapped correctly", () => {
    const r = rows(
      "nama_lengkap,username,email,password\n" +
      "Budi,budi_w,budi@example.com,Pass1!\n",
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].username, "budi_w");
    assert.equal(r[0].namaLengkap, "Budi");
    assert.equal(r[0].email, "budi@example.com");
    assert.equal(r[0].password, "Pass1!");
  });

  test("throws when header is missing required column", () => {
    assert.throws(
      () => rows("username,password\nbudi_w,Pass1!\n"),
      /kolom/i,
    );
  });
});

// ─── Line numbers ──────────────────────────────────────────────────────────────

describe("parseUserImportCsv — line numbers", () => {
  test("assigns line 1 to first data row with no header", () => {
    const r = rows("budi_w,Pass1!,Budi,\n");
    assert.equal(r[0].line, 1);
  });

  test("assigns line 2 to first data row with header", () => {
    const r = rows("username,password,nama_lengkap,email\nbudi_w,Pass1!,Budi,\n");
    assert.equal(r[0].line, 2);
  });

  test("preserves line numbers across multiple rows", () => {
    const r = rows(
      "a1,P1!,Nama 1,\n" +
      "a2,P2!,Nama 2,\n" +
      "a3,P3!,Nama 3,\n",
    );
    assert.equal(r[0].line, 1);
    assert.equal(r[1].line, 2);
    assert.equal(r[2].line, 3);
  });

  test("correct line numbers when header precedes data", () => {
    const r = rows(
      "username,password,nama_lengkap,email\n" + // line 1 = header
      "r1,P!,N1,\n" + // line 2
      "r2,P!,N2,\n", // line 3
    );
    assert.equal(r[0].line, 2);
    assert.equal(r[1].line, 3);
  });
});

// ─── Error cases ──────────────────────────────────────────────────────────────

describe("parseUserImportCsv — malformed CSV", () => {
  test("throws on unclosed quote", () => {
    assert.throws(
      () => rows('budi_w,"unclosed\n'),
      /CSV|tidak valid/i,
    );
  });

  test("throws on extra non-empty column beyond 4", () => {
    assert.throws(
      () => rows("budi_w,Pass1!,Budi,x@x.com,extra\n"),
      /terlalu banyak|kolom/i,
    );
  });

  test("throws on extra non-empty column in header mode", () => {
    assert.throws(
      () => rows(
        "username,password,nama_lengkap,email,extra\n" +
        "budi_w,Pass1!,Budi,x@x.com,something\n",
      ),
      /terlalu banyak|kolom/i,
    );
  });

  test("allows empty cells after the first 4 columns", () => {
    // Extra column that is empty should not throw.
    const r = rows("budi_w,Pass1!,Budi,x@x.com,\n");
    assert.equal(r.length, 1);
    assert.equal(r[0].email, "x@x.com");
  });
});
