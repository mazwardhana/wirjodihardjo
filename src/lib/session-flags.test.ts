import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCredentialFlag, type CredentialFlagLookup } from "./session-flags";

function spyLookup(result: boolean | null) {
  const calls: string[] = [];
  const lookup: CredentialFlagLookup = async (userId) => {
    calls.push(userId);
    return result;
  };
  return { calls, lookup };
}

test("token yang sudah false tidak menyentuh database", async () => {
  const { calls, lookup } = spyLookup(true);
  const flag = await resolveCredentialFlag({ id: "u1", mustChangeCredentials: false }, lookup);
  assert.equal(flag, false);
  assert.deepEqual(calls, []);
});

test("token tanpa flag yang terisi tidak menyentuh database", async () => {
  const { calls, lookup } = spyLookup(true);
  assert.equal(await resolveCredentialFlag({ id: "u1" }, lookup), false);
  assert.deepEqual(calls, []);
});

test("token basi true dibaca ulang dari database dan diangkat setelah onboarding", async () => {
  const { calls, lookup } = spyLookup(false);
  const flag = await resolveCredentialFlag({ id: "u1", mustChangeCredentials: true }, lookup);
  assert.equal(flag, false);
  assert.deepEqual(calls, ["u1"]);
});

test("flag tetap true selama database juga true", async () => {
  const { calls, lookup } = spyLookup(true);
  const flag = await resolveCredentialFlag({ id: "u1", mustChangeCredentials: true }, lookup);
  assert.equal(flag, true);
  assert.deepEqual(calls, ["u1"]);
});

test("pengguna hilang di database tetap dipaksa onboarding", async () => {
  const { calls, lookup } = spyLookup(null);
  const flag = await resolveCredentialFlag({ id: "u1", mustChangeCredentials: true }, lookup);
  assert.equal(flag, true);
  assert.deepEqual(calls, ["u1"]);
});

test("token lama tanpa id tidak memanggil database", async () => {
  const { calls, lookup } = spyLookup(false);
  const flag = await resolveCredentialFlag({ mustChangeCredentials: true }, lookup);
  assert.equal(flag, true);
  assert.deepEqual(calls, []);
});
