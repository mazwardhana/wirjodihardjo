<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Panduan Kerja — Wirjodihardjo

Website keluarga besar Wirjodihardjo. Next.js 16 App Router, React 19,
TypeScript, Tailwind v4, Prisma 7 + PostgreSQL, NextAuth v5.

## Perintah

```bash
npm run dev                                  # pengembangan
npm run build                                # build produksi (wajib lulus sebelum commit)
npx tsc --noEmit                             # pemeriksaan tipe
npx eslint .                                 # lint
npx tsx --test <berkas.test.ts>              # SATU berkas tes
npx tsx --test $(git ls-files '*.test.ts' '*.test.tsx')   # seluruh suite
```

**Tidak ada `npm test`.** Tes dijalankan per berkas dengan `tsx --test`
(node:test). Baseline suite penuh: **932 lulus, 1 skip, 0 gagal**. Jangan
menurunkan angka itu.

## Aturan keras

- **Tailwind v4, tanpa `tailwind.config`.** Token ada di `@theme` dalam
  `src/app/globals.css`. Menambah sistem styling kedua (styled-components,
  CSS-in-JS) membuat tema berhenti jadi sumber kebenaran.
- **Nol warna hardcode** di luar `globals.css`. Tidak ada `#hex` atau `rgb()`
  di dalam komponen.
- **Jangan pernah** jalankan `prisma migrate resolve` atau `prisma db execute`.
  Migrasi didaftarkan panitia saat deploy.
- **Jangan ubah `prisma/schema.prisma`** tanpa diminta eksplisit.
- Semua teks antarmuka berbahasa Indonesia, tanpa em dash. Pakai koma atau titik.
- Komentar kode menjelaskan **kenapa**, bukan apa. Bahasa Indonesia.
- Angka di tabel wajib `tabular-nums`.

## Gerbang mutu (angka, bukan selera)

Ini **pengukuran**, bukan preferensi. Jalankan audit dan tempel JSON-nya.
Klaim "selesai" tanpa output audit **tidak diterima**.

| Gerbang | Ambang |
|---|---|
| Kontras teks | ≥ 4.5:1 (≥ 3:1 untuk ≥24px atau ≥18.66px tebal) |
| Target sentuh | ≥ 44×44 px |
| Font input | ≥ 16 px (di bawah ini iOS auto-zoom saat fokus) |
| Scroll horizontal | tidak ada pada lebar 360px |
| Warna hardcode | 0 |
| Gambar | punya `width`+`height`, atau `fill` dengan induk berposisi |

Target: `summary.pass === true` untuk setiap halaman yang disentuh.

## Cara kerja UI

**Sebelum menulis kode layar baru, tulis tiga kalimat arah seni:** untuk siapa
layar ini, apa yang harus dilihat pertama, mood dalam tiga kata sifat. Lalu
pilih satu hierarki visual: satu elemen dominan, satu pendukung, sisanya redup.
Lalu tulis komponennya. Lalu jalankan audit dan tempel angkanya.

**Kalau diminta "perindah" tanpa detail spesifik: jangan mengarang palet dan
tata letak.** Usulkan **dua** arah seni yang benar-benar berbeda, lalu tunggu
mana yang dibangun. Mengarang sendiri berarti menebak selera pemilik produk.

Spesifikasi lengkap ada di `DESIGN.md` (token, matriks kontras terukur, skala
tipografi, skala jarak, resep komponen siap salin, daftar terlarang). **Baca
`DESIGN.md` sebelum menyentuh tampilan.**

## Peta repo

- `src/app/` — rute App Router. Publik di root, `/admin/*`, `/dashboard/*`, `/api/*`
- `src/components/ui/` — komponen dasar (EmptyState, Dialog, Toast, DataTable, FormField)
- `src/components/{admin,galeri,silsilah,reuni,...}/` — komponen per domain
- `src/lib/` — logika domain (registrasi, buku-tamu, import, audit, rate-limit)
- `src/server/validations/` — skema zod
- `prisma/schema.prisma` — 40 model, 14 enum
- `DESIGN.md` — sumber kebenaran visual
- `docs/superpowers/plans/` — rencana kerja per fitur
- `.superpowers/sdd/` — ledger kerja (brief, laporan, diff review)

## Pola yang sudah ada, pakai jangan tulis ulang

- Penjaga admin: `requireAdmin()` di `src/app/api/admin/*/route.ts`
  (401 tanpa sesi, 403 untuk peran non-admin).
- RBAC: `getActorScope` / `requireAdminScope` / `assertBranchAccess`.
  Fail-closed: `BRANCH_ADMIN` tanpa penugasan = tanpa akses.
- Audit: `logAudit()` dari `src/lib/audit.ts` untuk setiap aksi admin.
- Transaksi batch: lihat `src/app/api/registrasi/route.ts`.
- Komponen dasar: `src/components/ui/*` sebelum membuat baru.
