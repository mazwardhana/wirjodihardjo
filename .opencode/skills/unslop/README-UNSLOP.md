# unslop — catatan sumber & lisensi

Skill ini **bukan** buatan Teknoloka. Dipasang apa adanya (tanpa modifikasi isi) dari repo upstream.

## Sumber

- Repo: https://github.com/heydamir/unslop
- Commit terpasang: `a6f121eee5f29c2f74976b75456feae8b66afb3a`
  - tanggal: 2026-11-01 19:46:09 +0300
  - subjek: `Merge pull request #10 from garvrao80/fix/snapshot-responsive-images`
- Diambil dengan: `git clone --depth 1 https://github.com/heydamir/unslop`
- Diverifikasi sebagai jarak HEAD lokal: lihat `git -C <clone> rev-parse HEAD`

## Lisensi & kredit

- Lisensi: **CC BY 4.0** (`license: CC-BY-4.0` di frontmatter SKILL.md, berkas `LICENSE` di repo)
- Penulis: **Damir Sokolovsky** — https://x.com/heydamir — https://heydamir.design/unslop
- Kredit ini wajib ikut kalau skill diadaptasi atau disebar ulang. Atribusi wajib ada juga di file ini
  supaya jejaknya tidak hilang kalau SKILL.md disunting lagi.

## Isi yang dipasang

14 berkas, 1.5 MB — `SKILL.md`, `references/` (5 markdown + 4 webp), `scripts/` (2 mjs), `agents/openai.yaml`.
Berkas `.webp` adalah contoh lampiran di dalam `references/refs/`; tidak ada yang diubah.

## Catatan pemasangan di host orca

- Lokasi: `~/.config/opencode/skills/unslop/` (skill global, sama seperti `antislop`, `antislop-ui`,
  `ui-ux-pro-max`, `impeccable`). Format frontmatter kompatibel: opencode kenal `name` dan `description`;
  field `license` dan `metadata:` diabaikan tanpa error (sudah diuji — skill berhasil dimuat).
- `agents/openai.yaml` tidak dipakai opencode (itu metadata untuk runtime lain). Dibiarkan ada apa adanya,
  tidak mengganggu pemuatan skill.

## Runtime script (uji 2026-11-03)

- `scripts/snapshot.mjs` — **JALAN**, butuh `playwright` yang bisa di-`import` dan Chromium.
  Di orca: set `NODE_PATH` ke folder playwright npx (`~/.npm/_npx/e41f203b7505f1fb/node_modules`)
  dan `CHROME_PATH=/home/orca/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
  Tanpa `CHROME_PATH`, Playwright mencari build 1248 yang tidak ada → `Executable doesn't exist`.
- `scripts/story.mjs` — **JALAN**, tapi butuh `ffmpeg` yang punya `libx264` dan opsi `-preset`.
  Build `ffmpeg` bawaan Playwright (`~/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux`) **tidak bisa dipakai**:
  dikompilasi `--disable-everything` dengan hanya `libvpx_vp8` → `Unrecognized option 'preset'`.
  Solusi tanpa sudo: `npm i ffmpeg-static` (punya libx264), lalu taruh binary-nya di PATH sebagai `ffmpeg`.
  Tidak ada `ffmpeg` di PATH host orca secara default; `sudo` butuh password.

## Riwayat pemasangan

- 2026-11-03 — dipasang oleh Beta (kanban `t_1e56ba13`) dari commit di atas. Tidak ada perubahan isi skill.
  Bukti pemuatan: `opencode run` memanggil tool `skill` dengan `id=unslop`, lalu membaca
  `references/signs.md` dan `references/tokens.md` dari folder ini.
