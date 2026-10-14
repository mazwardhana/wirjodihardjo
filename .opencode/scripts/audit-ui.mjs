#!/usr/bin/env node
/**
 * audit-ui.mjs — audit mutu UI halaman live via chrome-headless-shell (CDP).
 *
 * Pemakaian (di host, atau di container dengan CHROME_BIN):
 *   node .opencode/scripts/audit-ui.mjs <url> [url...]
 * Viewport 360x800 (HP). Keluaran: JSON ringkas per halaman dengan summary.pass.
 *
 * Aturan ambang ada di DESIGN.md bagian 8. Mesin audit: scripts/audit-ui.js
 * (dijalankan di konteks halaman, hasilnya JSON).
 */
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const here = dirname(fileURLToPath(import.meta.url));
const AUDIT_JS = readFileSync(join(here, "audit-ui.js"), "utf8");

const SHELL_BIN =
  process.env.CHROME_BIN ||
  `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`;

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error("pakai: node audit-ui.mjs <url> [url...]");
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: SHELL_BIN,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  defaultViewport: { width: 360, height: 800, deviceScaleFactor: 2, isMobile: true },
});

let fail = 0;
for (const url of urls) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500); // beri waktu reveal/animasi selesai
    // Emulasi ulang setelah navigasi: emulasi ter-reset saat navigasi.
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 2, isMobile: true });
    await sleep(500);
    const raw = await page.evaluate(AUDIT_JS);
    const report = JSON.parse(raw);
    const s = report.summary;
    console.log(`### ${url}`);
    console.log(JSON.stringify({
      viewport: report.viewport,
      contrastViolations: s.contrastViolations,
      tapTargetViolations: s.tapTargetViolations,
      inputFontViolations: s.inputFontViolations,
      imagesWithoutSize: s.imagesWithoutSize,
      emojiIcons: s.emojiIcons,
      hardcodedHex: s.hardcodedHex,
      pwa: report.pwa,
      horizontalScroll: report.horizontalScroll,
      pass: s.pass,
      worst: (report.contrast || []).slice(0, 5),
      tap: (report.tapTargets || []).slice(0, 5),
      inputFont: report.inputFont || [],
      images: report.images || [],
    }, null, 1));
    console.log(s.pass ? "PASS" : "FAIL");
    if (!s.pass) fail++;
  } catch (err) {
    console.log(`### ${url}\nAUDIT_ERROR ${err.message}`);
    fail++;
  } finally {
    await page.close();
  }
}

await browser.close();
process.exit(fail ? 1 : 0);
