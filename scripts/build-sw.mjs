// Menulis public/sw.js dari scripts/sw-template.js dengan id build Next.js.
// Dijalankan sebagai bagian dari `npm run build`. Berkas hasil tidak di-commit.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templat = readFileSync(path.join(AKAR, "scripts/sw-template.js"), "utf8");

let buildId = "dev";
try {
  buildId = readFileSync(path.join(AKAR, ".next/BUILD_ID"), "utf8").trim();
} catch {
  console.warn("[sw] .next/BUILD_ID tidak ada, pakai versi 'dev'");
}

const isi = templat.replaceAll("__BUILD_ID__", buildId);
writeFileSync(path.join(AKAR, "public/sw.js"), isi);
console.log(`[sw] public/sw.js ditulis, cache = wirjodihardjo-${buildId}`);
