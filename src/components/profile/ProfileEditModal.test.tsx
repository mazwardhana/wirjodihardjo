import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileEditModal, type ProfileDraft } from "./ProfileEditModal";

test("basic section maps nama panggilan and nickname to separate fields", () => {
  const initialData: ProfileDraft = {
    fullName: "Fixture", nickname: "fixture-user", namaPanggilan: "Panggilan sehari-hari",
    bio: "", occupation: "", status: "", phone: "", whatsapp: "", addressLine: "",
    city: "", visibleToMembers: false,
  };
  const html = renderToStaticMarkup(
    <ProfileEditModal open initialData={initialData} platforms={[]} onClose={() => {}} onSave={async () => {}} onChanged={() => {}} />
  );
  assert.match(html, /Nama panggilan/);
  assert.match(html, /Nickname \(username\)/);
  assert.match(html, /value="Panggilan sehari-hari"/);
});

// Browser dependencies are intentionally external to the application bundle.
// PLAYWRIGHT_MODULE=/tmp/opencode/ui-tests/node_modules/playwright npx tsx --test <this file>
const require = createRequire(import.meta.url);

test("modal keyboard, save/cancel, collection errors and 390px reflow", { skip: !process.env.PLAYWRIGHT_MODULE }, async () => {
  const { build } = require("esbuild");
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE!);
  const postcss = require("postcss");
  const tailwind = require("@tailwindcss/postcss");
  const root = process.cwd();
  const bundle = await build({
    stdin: { contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {ProfileEditModal} from './src/components/profile/ProfileEditModal';
      const initial = {fullName:'Test fixture',nickname:'',occupation:'',status:'',bio:'',city:'',phone:'',whatsapp:'',addressLine:'',visibleToMembers:false};
      function Harness() {
        const [open,setOpen]=useState(false); const [saved,setSaved]=useState('');
        return <><button onClick={()=>setOpen(true)}>Open editor</button><output>{saved}</output>{open && <ProfileEditModal open initialData={initial} platforms={[{id:'test-platform',name:'Test platform'}]} onChanged={()=>{}} onClose={()=>setOpen(false)} onSave={async data=>{const r=await fetch('/api/profil/update',{method:'POST',body:JSON.stringify(data)});if(!r.ok)throw Error();setSaved(data.fullName);}} />}</>;
      }
      createRoot(document.getElementById('root')).render(<Harness/>);
    `, loader: "tsx", resolveDir: root }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: resolve(root, "tsconfig.json"),
  });
  const css = await postcss([tailwind({ base: root })]).process(await readFile(resolve(root, "src/app/globals.css"), "utf8"), { from: resolve(root, "src/app/globals.css") });
  let failSave = false;
  let failEducation = false;
  let lastPayload: Record<string, unknown> | undefined;
  const server = createServer(async (req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return; }
    if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css.css); return; }
    if (req.url?.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST") {
        let body = ""; for await (const chunk of req) body += chunk;
        lastPayload = JSON.parse(body); res.statusCode = failSave ? 500 : 200; res.end('{}'); return;
      }
      res.statusCode = failEducation && req.url.includes("education") ? 500 : 200;
      res.end(JSON.stringify({ education: [], socialLinks: [] })); return;
    }
    res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    const trigger = page.getByRole("button", { name: "Open editor" });
    const dialog = page.getByRole("dialog");
    await trigger.focus(); await page.keyboard.press("Enter"); await dialog.waitFor();
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.evaluate((el: HTMLElement) => el.contains(document.activeElement)), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("button", { name: "Tutup", exact: true }).evaluate((el: HTMLElement) => el === document.activeElement), true);
    await page.getByLabel("Nama lengkap", { exact: true }).fill("Unsaved fixture");
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    assert.equal(await trigger.evaluate((el: HTMLElement) => el === document.activeElement), true);
    await trigger.click();
    assert.equal(await page.getByLabel("Nama lengkap", { exact: true }).inputValue(), "Test fixture");
    await page.getByRole("button", { name: "Batal", exact: true }).click();
    assert.equal(lastPayload, undefined);
    await trigger.click();
    failSave = true;
    await page.getByRole("button", { name: "Simpan profil", exact: true }).click();
    await page.getByRole("alert").waitFor(); assert.equal(await dialog.isVisible(), true);
    failSave = false;
    await page.getByLabel("Nama lengkap", { exact: true }).fill("Saved fixture");
    await page.getByRole("button", { name: "Simpan profil", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    const savedPayload = lastPayload as Record<string, unknown> | undefined;
    assert.equal(savedPayload?.fullName, "Saved fixture");
    assert.equal(savedPayload?.branchId, undefined);
    assert.equal(await trigger.evaluate((el: HTMLElement) => el === document.activeElement), true);
    await trigger.click();
    for (const section of ["Info dasar", "Pendidikan", "Sosial media"]) {
      await page.getByRole("button", { name: section, exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, section);
      const short = await dialog.locator('button:visible, input:not([type="checkbox"]):visible, select:visible').evaluateAll((els: HTMLElement[]) => els.filter(el => el.getBoundingClientRect().height < 44).map(el => el.outerHTML));
      assert.deepEqual(short, [], section);
    }
    failEducation = true;
    await page.getByRole("button", { name: "Pendidikan", exact: true }).click();
    await page.getByRole("alert").waitFor();
    failEducation = false;
    await page.getByRole("button", { name: "Coba muat lagi" }).click();
    await page.getByText("Belum ada data pendidikan.", { exact: true }).waitFor();
    await page.getByLabel("Institusi", { exact: true }).fill("Test institution");
    failSave = true;
    await page.getByRole("button", { name: "Tambah pendidikan", exact: true }).click();
    await page.getByText("Perubahan belum tersimpan. Periksa data dan coba lagi.", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Institusi", { exact: true }).inputValue(), "Test institution");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise<void>(r => server.close(() => r())); }
});
