import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  FORGOT_PASSWORD_NEUTRAL_MESSAGE,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_TTL_MS,
  generateResetToken,
  hashResetToken,
  isResetTokenValid,
  resetExpiryFrom,
} from "./password-reset";

describe("utilitas reset password", () => {
  test("generateResetToken menghasilkan 64 karakter hex", () => {
    const token = generateResetToken();
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  test("generateResetToken tidak mengulang token yang sama", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateResetToken()));
    assert.equal(tokens.size, 50);
  });

  test("hashResetToken deterministik dan tidak bisa dikembalikan", () => {
    const token = "a".repeat(64);
    const hash = hashResetToken(token);
    assert.equal(hash, hashResetToken(token));
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.notEqual(hash, token);
    // Token berbeda satu karakter pun harus menghasilkan hash berbeda.
    assert.notEqual(hashResetToken("b".repeat(64)), hash);
  });

  test("resetExpiryFrom menambah tepat satu jam", () => {
    const now = 1_800_000_000_000;
    const expiry = resetExpiryFrom(now);
    assert.equal(expiry.getTime() - now, PASSWORD_RESET_TTL_MS);
    assert.equal(PASSWORD_RESET_TTL_MS, 60 * 60 * 1000);
  });

  test("isResetTokenValid menolak token kosong atau masa berlaku kosong", () => {
    assert.equal(isResetTokenValid(null, new Date()), false);
    assert.equal(isResetTokenValid("hash", null), false);
    assert.equal(isResetTokenValid("hash", undefined), false);
  });

  test("isResetTokenValid memakai waktu sekarang sebagai pembanding", () => {
    const now = new Date("2026-10-28T10:00:00.000Z");
    assert.equal(
      isResetTokenValid("hash", new Date("2026-10-28T11:00:00.000Z"), now),
      true,
    );
    assert.equal(
      isResetTokenValid("hash", new Date("2026-10-28T10:00:00.000Z"), now),
      false,
      "tepat di batas tetap dianggap kedaluwarsa",
    );
    assert.equal(
      isResetTokenValid("hash", new Date("2026-10-28T09:00:00.000Z"), now),
      false,
    );
  });

  test("MIN_PASSWORD_LENGTH memakai batas delapan karakter", () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8);
  });

  test("pesan netral tidak menyebut keberadaan akun", () => {
    assert.ok(FORGOT_PASSWORD_NEUTRAL_MESSAGE.length > 0);
    // Pesan tidak boleh membenarkan maupun menyangkal adanya akun.
    assert.ok(!/terdaftar$/.test(FORGOT_PASSWORD_NEUTRAL_MESSAGE.trim()));
    assert.ok(FORGOT_PASSWORD_NEUTRAL_MESSAGE.includes("Jika akun"));
  });
});
