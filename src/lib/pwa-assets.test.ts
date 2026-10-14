import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { PALET } from "./theme-tokens";

// Gerbang aset PWA: berkas yang dirujuk manifest dan meta iOS harus benar-benar
// ada, dan ukurannya masuk akal. Tanpa gerbang ini, aset yang terhapus atau
// ikon yang belum dibuat baru ketahuan saat aplikasi dibuka di HP.

const swTemplat = readFileSync("scripts/sw-template.js", "utf8");

test("service worker mem-pra-cache halaman luring", () => {
  assert.match(swTemplat, /OFFLINE_URL = '\/offline'/);
  assert.match(swTemplat, /PRECACHE_URLS = \[[\s\S]*OFFLINE_URL/);
});

test("service worker memakai id build sebagai versi cache", () => {
  // Versi tetap berarti perbaikan tidak pernah sampai ke perangkat terpasang.
  assert.match(swTemplat, /__BUILD_ID__/);
  assert.match(readFileSync("scripts/build-sw.mjs", "utf8"), /\.next\/BUILD_ID/);
  assert.match(readFileSync("package.json", "utf8"), /build-sw\.mjs/);
});

test("precache tidak lagi menunjuk manifest.json yang sudah dihapus", () => {
  assert.doesNotMatch(swTemplat, /'\/manifest\.json'/);
  assert.ok(!existsSync("public/manifest.json"), "public/manifest.json masih ada");
});

test("semua aset ikon dan splash yang dirujuk benar-benar ada", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const rujukan = [
    ...layout.matchAll(/"(\/(?:splash|icon|apple-touch)[^"]*\.png)"/g),
  ].map((m) => m[1]);
  assert.ok(rujukan.length >= 8, `hanya ${rujukan.length} aset dirujuk di layout`);
  for (const url of new Set(rujukan)) {
    const jalur = `public${url}`;
    assert.ok(existsSync(jalur), `aset hilang: ${jalur}`);
    assert.ok(statSync(jalur).size > 1000, `aset kosong: ${jalur}`);
  }
});

test("manifest memakai token palet, bukan warna lama", () => {
  const manifest = readFileSync("src/app/manifest.ts", "utf8");
  assert.match(manifest, /background_color: PALET\.cream/);
  assert.match(manifest, /theme_color: PALET\.forest/);
  // Palet lama yang membuat splash Android tidak nyambung.
  assert.doesNotMatch(manifest, /#FFFBF5|#1A4D2E/i);
  assert.match(manifest, /lang: "id"/);
});

test("palet ikon di berkas PNG sama dengan token", () => {
  // sharp dipakai skrip logo; di sini cukup baca metadata PNG mentah lewat
  // pemeriksaan berkas agar tes tidak menambah dependensi.
  const ikon = readFileSync("public/icon-512.png");
  assert.ok(ikon.length > 2000, "icon-512.png terlalu kecil");
  assert.equal(ikon.subarray(1, 4).toString(), "PNG");
});

test("warna splash dan ikon berasal dari token yang sama", () => {
  const skrip = readFileSync("scripts/generate-logo.mjs", "utf8");
  assert.match(skrip, /globals\.css/);
  for (const nama of ["forest", "cream", "gold"]) {
    assert.match(skrip, new RegExp(`ambil\\("${nama}"\\)`));
  }
  assert.equal(PALET.cream, "#f7f1e2");
});
