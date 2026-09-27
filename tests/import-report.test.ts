import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "csv-parse/sync";
import { generateCredentialCSV, generateErrorCSV } from "../src/lib/import/report";

type Row = Record<string, string>;

test("credential CSV only includes the initial password for new accounts", () => {
  const rows = parse(
    generateCredentialCSV(
      [
        { ref: "A", fullName: "Example", email: "a@example.test", role: "MEMBER", isNew: true },
        { ref: "B", fullName: "Example", email: "b@example.test", role: "MEMBER", isNew: false },
      ],
      "WD26",
    ),
    { columns: true },
  ) as Row[];
  assert.equal(rows[0]["Password"], "WD26");
  assert.equal(rows[1]["Password"], "");
});

test("spreadsheet formulas are escaped in credentials and errors", () => {
  const credentials = parse(
    generateCredentialCSV(
      [{ ref: "A", fullName: '=HYPERLINK("https://example.test")', email: "a@example.test", role: "MEMBER", isNew: true }],
      "WD26",
    ),
    { columns: true },
  ) as Row[];
  assert.ok(credentials[0]["Nama Lengkap"].startsWith("'="));
  const errors = parse(
    generateErrorCSV([{ sheet: "Anggota", row: 2, field: "ref", message: "=1+1" }]),
    { columns: true },
  ) as Row[];
  assert.equal(errors[0]["Pesan Error"], "'=1+1");
});