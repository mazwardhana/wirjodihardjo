import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PALET } from "./theme-tokens";

// Gerbang anti-melenceng: warna manifest PWA dan ikon harus sama dengan token
// di globals.css. Sebelumnya manifest memakai palet lama (#FFFBF5 / #1A4D2E)
// sehingga splash Android tidak nyambung dengan aplikasinya.
const css = readFileSync("src/app/globals.css", "utf8");

function token(nama: string): string {
  const m = css.match(new RegExp(`--color-${nama}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --color-${nama} tidak ditemukan di globals.css`);
  return m[1].toLowerCase();
}

test("token di theme-tokens.ts sama dengan globals.css", () => {
  assert.equal(PALET.cream, token("cream"));
  assert.equal(PALET.forest, token("forest"));
  assert.equal(PALET.gold, token("gold"));
});

test("skrip pembuat ikon memakai token yang sama", () => {
  const skrip = readFileSync("scripts/generate-logo.mjs", "utf8");
  assert.match(skrip, /globals\.css/);
  for (const [nama, hex] of Object.entries(PALET)) {
    assert.match(skrip, new RegExp(nama), `skrip logo tidak menyebut token ${nama}`);
    assert.doesNotMatch(
      skrip,
      new RegExp(hex.replace("#", "#").toUpperCase()),
      `skrip logo masih menyimpan hex ${hex} secara manual`,
    );
  }
});
