import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeGroup,
  canSubmit,
  groupRowsByBranch,
  type GuestRow,
} from "./buku-tamu-helpers";

const existing = (over: Partial<Extract<GuestRow, { kind: "existing" }>> = {}): GuestRow => ({
  kind: "existing",
  personId: "p1",
  fullName: "Sri Wahyuni",
  namaPanggilan: "Yuni",
  branchName: "Keluarga Soedjinah",
  alreadyRegistered: true,
  checkedIn: false,
  ...over,
});

const walkIn = (over: Partial<Extract<GuestRow, { kind: "walkIn" }>> = {}): GuestRow => ({
  kind: "walkIn",
  fullName: "Budi Santoso",
  namaPanggilan: "Budi",
  gender: "MALE",
  ...over,
});

test("summarizeGroup menghitung terdaftar, sudah absen, dan tamu baru", () => {
  const rows = [existing(), existing({ checkedIn: true }), walkIn()];
  assert.deepEqual(summarizeGroup(rows), {
    total: 3,
    existing: 2,
    alreadyCheckedIn: 1,
    walkIn: 1,
  });
});

test("canSubmit menolak daftar kosong dan menerima minimal satu baris", () => {
  assert.equal(canSubmit([]), false);
  assert.equal(canSubmit([existing()]), true);
  assert.equal(canSubmit([walkIn()]), true);
});

test("canSubmit menolak tamu baru tanpa nama lengkap atau nama panggilan", () => {
  assert.equal(canSubmit([walkIn({ fullName: "" })]), false);
  assert.equal(canSubmit([walkIn({ namaPanggilan: "" })]), false);
});

test("canSubmit menolak baris yang sudah absen", () => {
  assert.equal(canSubmit([existing({ checkedIn: true })]), false);
});

test("canSubmit menolak baris ganda untuk orang yang sama", () => {
  assert.equal(canSubmit([existing(), existing()]), false);
  assert.equal(canSubmit([walkIn(), walkIn()]), false);
});

test("groupRowsByBranch memisahkan baris menurut cabang pilihan tamu", () => {
  const grouped = groupRowsByBranch([existing(), existing(), walkIn()], "b1", "b2");
  assert.deepEqual(Object.keys(grouped).sort(), ["b1", "b2"]);
  assert.equal(grouped.b1.length, 2);
  assert.equal(grouped.b2.length, 1);
});

test("groupRowsByBranch menaruh tamu baru ke cabang yang dipilih tamu", () => {
  const grouped = groupRowsByBranch([walkIn()], "b1", "b9");
  assert.equal(grouped.b9.length, 1);
  assert.equal(grouped.b1, undefined);
});
