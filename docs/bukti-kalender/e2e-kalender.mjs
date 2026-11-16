// E2E kalender keluarga — Wirjodihardjo (kartu t_63ebbdd8).
// Pemakaian: node e2e-kalender.tmp.mjs <baseUrl> <outDir>
// Jalankan dari worktree (resolve ESM butuh node_modules setempat).
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME =
  process.env.CHROME_BIN ||
  `${process.env.HOME}/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome`;

const baseUrl = process.argv[2] || "http://127.0.0.1:3111";
const outDir = process.argv[3] || "docs/bukti-kalender";
mkdirSync(outDir, { recursive: true });

const results = [];
function log(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "OK  " : "GAGAL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1"],
});

async function clickByText(page, selector, text) {
  const ok = await page.evaluate(
    (sel, txt) => {
      const els = Array.from(document.querySelectorAll(sel));
      const el = els.find((e) => (e.textContent || "").trim().includes(txt));
      if (el) {
        el.click();
        return true;
      }
      return false;
    },
    selector,
    text,
  );
  if (!ok) throw new Error(`Tidak menemukan elemen ${selector} bertuliskan "${text}"`);
}

async function clickRowAction(page, title, actionText) {
  const ok = await page.evaluate(
    (t, act) => {
      const items = Array.from(document.querySelectorAll("li"));
      const row = items.find((li) => (li.textContent || "").includes(t));
      if (!row) return false;
      const btn = Array.from(row.querySelectorAll("button")).find(
        (b) => (b.textContent || "").trim() === act,
      );
      if (!btn) return false;
      btn.click();
      return true;
    },
    title,
    actionText,
  );
  if (!ok) throw new Error(`Baris "${title}" tidak punya tombol "${actionText}"`);
}

async function fetchAdminEvent(page, title) {
  return page.evaluate(async (t) => {
    const res = await fetch("/api/admin/kalender");
    if (!res.ok) return null;
    const list = await res.json();
    return list.find((e) => e.title === t) ?? null;
  }, title);
}

async function waitText(page, text, timeoutMs = 15000) {
  await page.waitForFunction(
    (t) => document.body && document.body.innerText.includes(t),
    { timeout: timeoutMs },
    text,
  );
}

async function login(page, username, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#usernameOrEmail", { timeout: 20000 });
  await page.click("#usernameOrEmail");
  await page.type("#usernameOrEmail", username, { delay: 20 });
  await page.click("#password");
  await page.type("#password", password, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => undefined),
    page.click('button[type="submit"]'),
  ]);
  // Tunggu URL meninggalkan /login (client-side router.replace).
  for (let i = 0; i < 40; i++) {
    if (!page.url().includes("/login")) return;
    await sleep(250);
  }
  throw new Error(`Login ${username} tidak berpindah halaman (masih ${page.url()})`);
}

try {
  // ── 1. Admin: login, panel kelola ──────────────────────────────────
  const adminCtx = await browser.createBrowserContext();
  const admin = await adminCtx.newPage();
  await admin.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await login(admin, "admin", "KalenderE2E2026!");
  log("login admin", true, admin.url());

  await admin.goto(`${baseUrl}/admin/kalender`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitText(admin, "Milad Mbah Wirjodihardjo");
  const adminText = await admin.evaluate(() => document.body.innerText);
  log(
    "panel admin memuat 5 event seed",
    adminText.includes("Milad Mbah Wirjodihardjo") &&
      adminText.includes("Haul Eyang Siti") &&
      adminText.includes("Reuni Besar Keluarga") &&
      adminText.includes("Halal Bihalal") &&
      adminText.includes("Draft: Ngaji Bareng"),
  );
  await admin.screenshot({ path: join(outDir, "admin-kalender.png") });

  // ── 2. Buat event baru via modal ───────────────────────────────────
  const runTag = Date.now().toString(36); // unik per run → E2E idempoten
  const newTitle = `Ngaji Bareng E2E ${runTag}`;
  const draftSeed = "Draft: Ngaji Bareng Bulanan";
  await clickByText(admin, "button", "Event Baru");
  await admin.waitForSelector("#title", { timeout: 10000 });
  await admin.type("#title", newTitle, { delay: 15 });
  await admin.evaluate(() => {
    const set = (id, val) => {
      const el = document.querySelector(id);
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set("#startsAt", "2026-12-20T16:00");
    set("#locationName", "Musholla Keluarga");
  });
  await admin.evaluate(() => {
    const boxes = document.querySelectorAll('input[type="checkbox"]');
    boxes[1].click(); // "Terbitkan (tampilkan untuk member)"
  });
  await admin.screenshot({ path: join(outDir, "admin-kalender-form.png") });
  await clickByText(admin, 'button[type="submit"]', "Buat Event");
  await waitText(admin, newTitle, 20000);
  const created = await fetchAdminEvent(admin, newTitle);
  log("admin buat event terbit", !!created && created.isPublished === true, newTitle);
  await sleep(800);
  await admin.screenshot({ path: join(outDir, "admin-kalender-setelah-buat.png") });

  // ── 3. Toggle publish dua arah pada event yang baru dibuat ────────
  await clickRowAction(admin, newTitle, "Turunkan");
  await sleep(1500);
  const afterUnpublish = await fetchAdminEvent(admin, newTitle);
  log("turunkan (unpublish) event", !!afterUnpublish && afterUnpublish.isPublished === false);
  await clickRowAction(admin, newTitle, "Terbitkan");
  await sleep(1500);
  const afterRepublish = await fetchAdminEvent(admin, newTitle);
  log("terbitkan kembali event", !!afterRepublish && afterRepublish.isPublished === true);
  await admin.screenshot({ path: join(outDir, "admin-kalender-setelah-terbitkan.png") });

  // ── 3b. Turunkan draft seed (kondisional) untuk uji kebocoran ─────
  const draftState = await fetchAdminEvent(admin, draftSeed);
  if (draftState?.isPublished) {
    await clickRowAction(admin, draftSeed, "Turunkan");
    await sleep(1500);
  }
  const draftAfter = await fetchAdminEvent(admin, draftSeed);
  log("draft seed diturunkan (bahan uji kebocoran)", !!draftAfter && draftAfter.isPublished === false);

  // ── 4. Member: kalender publik + RSVP ──────────────────────────────
  const watiCtx = await browser.createBrowserContext();
  const wati = await watiCtx.newPage();
  await wati.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await login(wati, "wati", "KalenderE2E2026!");
  await wati.goto(`${baseUrl}/kalender`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitText(wati, "Agenda Bulan Ini");
  await sleep(1200); // fetch /api/kalender selesai
  const pubText = await wati.evaluate(() => document.body.innerText);
  log(
    "kalender publik memuat event terbit (bulan ini + agenda mendatang)",
    pubText.includes("Agenda Mendatang") &&
      pubText.includes("Haul Eyang Siti") &&
      pubText.includes("Milad Mbah Wirjodihardjo") &&
      pubText.includes("Reuni Besar Keluarga"),
  );
  const draftLeak = pubText.includes("Draft: Ngaji Bareng Bulanan");
  log("draft tidak bocor ke member", !draftLeak);
  await wati.screenshot({ path: join(outDir, "kalender-member-1280.png") });

  // Pilih event → RSVP Hadir
  await clickByText(wati, 'button[title="Haul Eyang Siti"], li button', "Haul Eyang Siti");
  await waitText(wati, "Kehadiran", 5000);
  await sleep(400);
  await clickByText(wati, "aside button", "Hadir");
  await sleep(800);
  const rsvpSelected = await wati.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("aside button"));
    const hadir = btns.find((b) => (b.textContent || "").trim() === "Hadir");
    return !!hadir && hadir.className.includes("bg-forest");
  });
  log("RSVP Hadir tersimpan (state tombol)", rsvpSelected);
  await wati.screenshot({ path: join(outDir, "kalender-member-rsvp.png") });

  // ── 5. RBAC: member ditolak di API & panel admin ───────────────────
  const apiStatus = await wati.evaluate(async () => {
    const res = await fetch("/api/admin/kalender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Coba Ilegal", type: "MILAD", startsAt: new Date().toISOString() }),
    });
    return res.status;
  });
  log("API admin ditolak untuk member", apiStatus === 401 || apiStatus === 403, `status=${apiStatus}`);

  await wati.goto(`${baseUrl}/admin/kalender`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  const redirectedAway = !wati.url().includes("/admin/kalender");
  log("panel admin me-redirect member", redirectedAway, `landed=${wati.url()}`);

  // Anonim → /kalender dilempar ke /login
  const anonCtx = await browser.createBrowserContext();
  const anon = await anonCtx.newPage();
  await anon.setViewport({ width: 1280, height: 900 });
  await anon.goto(`${baseUrl}/kalender`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(800);
  log("anonim diarahkan ke /login", anon.url().includes("/login"), anon.url());

  // ── 6. Dashboard wati → memicu pengingat (dicek ke DB di luar) ────
  await wati.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await wati.screenshot({ path: join(outDir, "dashboard-member.png") });
  log("dashboard member dimuat (pemicu pengingat)", true);

  // ── 7. Mobile 390px ────────────────────────────────────────────────
  await wati.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await wati.goto(`${baseUrl}/kalender`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitText(wati, "Agenda Bulan Ini");
  await sleep(1200);
  await wati.screenshot({ path: join(outDir, "kalender-member-390.png") });
  log("mobile 390px ter-capture", true);

  writeFileSync(join(outDir, "hasil-e2e.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`RINGKASAN: ${results.length - failed.length}/${results.length} langkah lulus`);
  process.exitCode = failed.length ? 1 : 0;
} catch (err) {
  console.error("E2E_GAGAL", err);
  process.exitCode = 2;
} finally {
  await browser.close();
}
