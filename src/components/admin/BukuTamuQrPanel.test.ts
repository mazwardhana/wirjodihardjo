import assert from "node:assert/strict";
import test from "node:test";
import { buildCheckInUrl, renderQrSvg } from "./BukuTamuQrPanel";

test("buildCheckInUrl memakai base tanpa garis miring ganda", () => {
  assert.equal(
    buildCheckInUrl("https://wirjodihardjo.teknoloka.id/"),
    "https://wirjodihardjo.teknoloka.id/reuni/buku-tamu",
  );
  assert.equal(
    buildCheckInUrl("https://wirjodihardjo.teknoloka.id"),
    "https://wirjodihardjo.teknoloka.id/reuni/buku-tamu",
  );
});

test("renderQrSvg menghasilkan svg yang dapat disisipkan", async () => {
  const svg = await renderQrSvg("https://wirjodihardjo.teknoloka.id/reuni/buku-tamu");
  assert.match(svg, /^<svg/);
  assert.ok(svg.includes("path"), "QR harus berupa path hitam-putih");
  assert.ok(svg.length > 200, "SVG terlalu kecil untuk QR asli");
});

test("renderQrSvg berbeda untuk teks berbeda", async () => {
  const a = await renderQrSvg("https://wirjodihardjo.teknoloka.id/reuni/buku-tamu");
  const b = await renderQrSvg("https://wirjodihardjo.teknoloka.id/reuni");
  assert.notEqual(a, b);
});
