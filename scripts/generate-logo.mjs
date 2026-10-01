// Skrip pembuat aset logo monogram "W" untuk PWA.
// SVG dirender menjadi PNG memakai sharp (librsvg).
// Font Fraunces diunduh saat skrip dijalankan karena container tidak
// menyediakan font sistem; bila unduhan gagal, dipakai bentuk vektor cadangan.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIK = path.join(AKAR, "public");

const WARNA = {
  hutan: "#1A4D2E",
  krem: "#FFFBF5",
  emas: "#B4872A",
};

// Semua koordinat digambar pada ruang 512 lalu diperkecil saat ekspor.
const KANVAS = 512;
const UKURAN_MASTER = 1024;

const FONT_FAMILI = "Fraunces";
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap";
// URL cadangan bila permintaan CSS gagal (versi Fraunces 600 statis).
const FONT_URL_CADANGAN =
  "https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcaRyjDg.ttf";

async function cariUrlFont() {
  const resp = await fetch(FONT_CSS);
  if (!resp.ok) throw new Error(`CSS font gagal: ${resp.status}`);
  const teks = await resp.text();
  const cocok = teks.match(/url\((https:[^)]+\.(?:ttf|otf))\)/);
  if (!cocok) throw new Error("URL font tidak ditemukan pada CSS");
  return cocok[1];
}

// Menyiapkan font di direktori sementara beserta fontconfig khusus.
// Mengembalikan true bila font siap dipakai librsvg.
async function siapkanFont() {
  try {
    const dir = path.join(os.tmpdir(), "wd-logo-font");
    const berkasFont = path.join(dir, `${FONT_FAMILI}.ttf`);
    const berkasKonfig = path.join(dir, "fonts.conf");
    if (!existsSync(berkasFont)) {
      await mkdir(dir, { recursive: true });
      const url = await cariUrlFont().catch(() => FONT_URL_CADANGAN);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`unduhan font gagal: ${resp.status}`);
      await writeFile(berkasFont, Buffer.from(await resp.arrayBuffer()));
    }
    await writeFile(
      berkasKonfig,
      [
        '<?xml version="1.0"?>',
        '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
        "<fontconfig>",
        `  <dir>${dir}</dir>`,
        `  <cachedir>${path.join(dir, "cache")}</cachedir>`,
        "</fontconfig>",
        "",
      ].join("\n"),
    );
    process.env.FONTCONFIG_FILE = berkasKonfig;
    return true;
  } catch (galat) {
    console.warn(`[logo] font Fraunces tidak tersedia: ${galat.message}`);
    return false;
  }
}

// Bentuk "W" vektor sederhana sebagai cadangan tanpa font.
function jalurCadangan() {
  return `<path d="M104 150 L176 362 L256 214 L336 362 L408 150"
      fill="none" stroke="${WARNA.hutan}" stroke-width="34"
      stroke-linejoin="round" stroke-linecap="round"/>`;
}

function buatSvg({ maskable, pakaiFont }) {
  // Padding aman maskable 20% di tiap sisi, sehingga konten menempati 60%.
  const skala = maskable ? 0.6 : 1;
  const monogram = pakaiFont
    ? `<text x="256" y="352" text-anchor="middle" font-family="${FONT_FAMILI}"
        font-size="330" font-weight="600" fill="${WARNA.hutan}">W</text>`
    : jalurCadangan();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${UKURAN_MASTER}"
      height="${UKURAN_MASTER}" viewBox="0 0 ${KANVAS} ${KANVAS}">
  <rect width="${KANVAS}" height="${KANVAS}" fill="${WARNA.krem}"/>
  <g transform="translate(256 256) scale(${skala}) translate(-256 -256)">
    ${monogram}
    <rect x="188" y="392" width="136" height="11" rx="5.5" fill="${WARNA.emas}"/>
  </g>
</svg>`;
}

async function render(nama, ukuran, opsi, pakaiFont) {
  const svg = buatSvg({ ...opsi, pakaiFont });
  const tujuan = path.join(PUBLIK, nama);
  await sharp(Buffer.from(svg))
    .resize(ukuran, ukuran)
    .png({ compressionLevel: 9 })
    .toFile(tujuan);
  const meta = await sharp(tujuan).metadata();
  console.log(`[logo] ${nama} ${meta.width}x${meta.height} (${meta.format})`);
}

async function utama() {
  const pakaiFont = await siapkanFont();
  await render("icon-192.png", 192, { maskable: false }, pakaiFont);
  await render("icon-512.png", 512, { maskable: false }, pakaiFont);
  await render("apple-touch-icon.png", 180, { maskable: false }, pakaiFont);
  await render("icon-maskable-512.png", 512, { maskable: true }, pakaiFont);
}

utama().catch((galat) => {
  console.error(`[logo] gagal: ${galat.message}`);
  process.exitCode = 1;
});
