import assert from "node:assert/strict";
import test from "node:test";
import { buildRegistrasiPreview } from "./preview";
import type { RegistrasiCredential, RegistrasiImportRow } from "./types";

function row(overrides: Partial<RegistrasiImportRow> = {}): RegistrasiImportRow {
  return {
    _row: 2,
    cabangKe: "1",
    namaPanggilan: "Budi",
    namaLengkap: "Budi Santoso",
    gender: "L",
    status: "hidup",
    hadir: "ya",
    branchId: "b1",
    branchNumber: 1,
    ...overrides,
  };
}

function cred(overrides: Partial<RegistrasiCredential> = {}): RegistrasiCredential {
  return {
    fullName: "Budi Santoso",
    username: "budi",
    status: "dibuat",
    branchNumber: 1,
    isDeceased: false,
    willAttend: true,
    ...overrides,
  };
}

test("baris ber-error tidak menggeser penggabungan kredensial", () => {
  const rows = [
    row({ _row: 2, branchId: undefined, namaLengkap: "Cabang Salah" }),
    row({ _row: 3, branchId: "b1", namaLengkap: "Ani", branchNumber: 1 }),
    row({ _row: 4, branchId: "b1", namaLengkap: "Budi", branchNumber: 1 }),
  ];
  const credentials = [
    cred({ fullName: "Ani", username: "ani", willAttend: false }),
    cred({ fullName: "Budi", username: "budi", willAttend: true }),
  ];

  const preview = buildRegistrasiPreview(rows, credentials);

  // Baris pertama ber-error: tanpa kredensial, bukan mengambil milik baris berikutnya.
  assert.equal(preview[0].username, "");
  assert.equal(preview[0].willAttend, null);
  assert.equal(preview[0].accountStatus, "");

  // Baris berikutnya tetap sejajar dengan kredensialnya masing-masing.
  assert.equal(preview[1].username, "ani");
  assert.equal(preview[1].willAttend, false);
  assert.equal(preview[2].username, "budi");
  assert.equal(preview[2].willAttend, true);
});

test("menghormati batas jumlah baris pratinjau", () => {
  const rows = Array.from({ length: 5 }, (_, i) => row({ _row: i + 2, namaLengkap: `Nama ${i}` }));
  const credentials = rows.map((_, i) => cred({ fullName: `Nama ${i}`, username: `n${i}` }));

  const preview = buildRegistrasiPreview(rows, credentials, 2);
  assert.equal(preview.length, 2);
  assert.equal(preview[1].username, "n1");
});

test("baris tanpa kredensial menampilkan nilai mentah sebagai ganti", () => {
  const rows = [row({ _row: 9, hadir: "tidak", branchNumber: 3 })];
  const preview = buildRegistrasiPreview(rows, []);
  assert.equal(preview[0].username, "");
  assert.equal(preview[0].willAttend, null);
  assert.equal(preview[0].branchNumber, 3);
});
