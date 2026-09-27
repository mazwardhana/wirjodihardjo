# Branch `develop` — Progress Tracking

**Dibuat:** 26 September 2026  
**Update terakhir:** 26 September 2026  
**Target:** Bug fix + Import data + Artikel/Cerita  
**Branch:** `develop` (dari `main`)  
**HEAD:** `ee18c0b feat(import): add safe family data import workflow`

**Status sesi:** Modul import dan artikel sudah ter-commit. Belum di-push ke origin; belum di-deploy. Smoke test browser dan QA manual menunggu environment dev/staging.

> Detail teknis, pembagian tugas agent, dan hasil tes di `SESSION-LOG-DEVELOP.md`.

> Dokumen ini adalah sumber kebenaran status. Status di bawah diverifikasi langsung
> dari workspace (git status + isi file), bukan dari laporan subagent.

---

## 📋 Status Keseluruhan

| Fase | Status | Catatan |
|------|--------|---------|
| 🌿 Branch setup | ✅ DONE | `develop` dibuat dari `main`; commit baru belum di-push |
| 🐛 Bug Fix (B1-B7) | ✅ DONE | Ter-commit di `6b7c90d` |
| 🧱 Schema + Migration | ✅ DONE | Migrasi `20260926134000_add_import_and_article_support` sudah di-apply ke DB |
| 📦 Import Data | ✅ COMMITTED | Library + API + UI + 55 tes, commit `ee18c0b` |
| ✍️ Artikel/Cerita | ✅ COMMITTED | Kode + schema + migration, commit `ffcd7bd` |
| 🧭 Sidebar Admin | ✅ COMMITTED | Menu artikel + impor di `ffcd7bd` |
| ✅ Testing & QA | 🟡 PARTIAL | Build sukses, 55 tes lulus; smoke test browser dan staging belum |
| 🚀 Deployment | ⏸️ PENDING | Menunggu review + QA manual + push origin + rebuild Docker |

**Ringkas:** Bug fix, artikel, dan import sudah ter-commit (belum push/deploy). Checklist di bawah adalah histori implementasi, bukan bukti QA produksi.

---

## 🐛 Bug Fix — Checklist (commit `6b7c90d`)

- [x] **B1** — `NEXTAUTH_SECRET`: hapus fallback default di `docker-compose.yml`, wajib dari env
- [x] **B2** — Login redirect role-aware: admin → `/admin`, member → `/dashboard` (`src/app/login/page.tsx`)
- [x] **B3** — Navbar session-aware: avatar + Dashboard/Admin + profil/notifikasi/keluar (`src/components/layout/Navbar.tsx`)
- [x] **B4** — Admin pengguna list: aksi role/aktif/verifikasi + link detail/tambah (`src/app/admin/pengguna/page.tsx`, `src/components/admin/PenggunaList.tsx`)
- [x] **B5** — Anti-siklus & batas maksimal 2 orang tua di `src/app/api/admin/relasi/route.ts`
- [x] **B6** — `sourceSubmissionId` diteruskan saat approval `ADD_CHILD` (`src/app/api/pengajuan/review/route.ts`)
- [x] **B7** — Konteks kakek-nenek di profil (`src/lib/genealogy.ts`, `src/components/profil/FamilyPanel.tsx`)

---

## 🧱 Schema & Migration — Checklist

- [x] Enum `ArticleStatus` (PENDING | APPROVED | REJECTED)
- [x] Enum `ImportStatus` (VALIDATED | COMMITTED | PARTIAL | FAILED)
- [x] Model `ImportBatch`
- [x] Model `ArticleCategory`
- [x] Model `Article`
- [x] `Person.externalRef` (unique, untuk idempotensi import)
- [x] `PersonChild.sourceSubmissionId` + relasi `ChildSubmission` + index
- [x] Relasi `User.importBatches`, `User.articles`, `User.reviewedArticles`
- [x] Migrasi `20260926134000_add_import_and_article_support` di-apply **tanpa reset** (backup di `/tmp/wirjo-backup/`)
- [x] `prisma generate` berhasil
- [ ] Push commit schema + migration ke `origin/develop`

---

## 📦 Import Data — Checklist

### Fondasi (SELESAI)
- [x] Library terpasang: `exceljs`, `csv-parse`, `csv-stringify`
- [x] `src/lib/import/types.ts` — tipe `ImportRowAnggota`, `ImportRowRelasi`, `ImportRowAkun`, `ImportReport`, dll
- [x] Schema `ImportBatch` + `Person.externalRef`

### Backend Library (BELUM)
- [ ] `src/lib/import/parser.ts` — parse XLSX (3 sheet: Anggota/Relasi/Akun) + fallback CSV
- [ ] `src/lib/import/validate.ts` — validasi field wajib, ref, tanggal, enum, duplikat ref, ref relasi tak dikenal, batas orang tua, anti-siklus
- [ ] `src/lib/import/importer.ts` — transaksi DB: upsert Person (`externalRef`), PersonPrivate, PersonChild, PersonPartner, User (password `WD26` + `mustChangePassword`)
- [ ] `src/lib/import/template.ts` — generate template XLSX (sheet Petunjuk + dropdown + baris contoh `CONTOH`)
- [ ] `src/lib/import/report.ts` — laporan kredensial + error per baris
- [ ] `src/lib/import/index.ts` — barrel export

### API (BELUM)
- [ ] `src/app/api/admin/impor/route.ts` — POST upload/validasi preview, GET template
- [ ] `src/app/api/admin/impor/commit/route.ts` — POST commit batch
- [ ] `src/app/api/admin/impor/laporan/route.ts` — GET laporan per batch

### UI (BELUM)
- [ ] `src/app/admin/impor/page.tsx` — halaman upload + preview
- [ ] `src/app/admin/impor/laporan/[id]/page.tsx` — halaman laporan
- [ ] `src/components/admin/ImporUpload.tsx` — drag & drop
- [ ] `src/components/admin/ImporPreview.tsx` — tabel preview per baris (✅/❌/⚠️)
- [ ] `src/components/admin/ImporReport.tsx` — ringkasan + unduh kredensial/error
- [x] Menu "Impor Data" di `AdminSidebar` (sudah ditambahkan, uncommitted)

### Aturan Import (kesepakatan)
- Hanya `SUPER_ADMIN`
- Maksimal file 10 MB
- Idempotensi via `Person.externalRef` dan `User.email`
- Password default `WD26`, `mustChangePassword = true`, bcrypt cost 10
- Tidak ada data yang masuk jika validasi gagal (transaksi all-or-nothing)
- Password tidak boleh bocor di response umum (hanya di laporan kredensial khusus admin)

---

## ✍️ Artikel/Cerita — Checklist (kode selesai, BELUM COMMIT)

### Library (SELESAI)
- [x] `src/lib/article/youtube.ts` — parse & validasi YouTube (youtube.com/watch + youtu.be)
- [x] `src/lib/article/slug.ts` — slug unik dari judul + suffix collision
- [x] `src/lib/article/sanitize.ts` — sanitasi HTML allowlist (server-side)
- [x] Seed 4 kategori: Sejarah Keluarga, Biografi, Kenangan, Prestasi (`prisma/seed.ts`)

### API (SELESAI, uncommitted)
- [x] `POST /api/artikel` — submit artikel (member login)
- [x] `GET /api/artikel` — list artikel approved (publik)
- [x] `GET/PUT /api/admin/artikel` — list + update (admin)
- [x] `POST /api/admin/artikel/review` — approve/reject + catatan
- [x] CRUD `/api/admin/artikel/kategori` (SUPER_ADMIN)

### UI Publik (SELESAI, uncommitted)
- [x] `src/app/hall-of-fame/page.tsx` — tab "Apresiasi" + "Artikel & Cerita"
- [x] `src/app/hall-of-fame/artikel/[slug]/page.tsx` — halaman baca (Fraunces serif, foto, YouTube embed)
- [x] `src/components/artikel/ArticleCard.tsx`, `ArticleDetail.tsx`, `HallOfFameTabs.tsx`

### UI Member (SELESAI, uncommitted)
- [x] `src/app/dashboard/artikel/page.tsx` — daftar artikel saya
- [x] `src/app/dashboard/artikel/baru/page.tsx` — form submit
- [x] `src/components/artikel/ArticleForm.tsx`, `ArticleEditor.tsx` (TipTap toolbar custom)

### UI Admin (SELESAI, uncommitted)
- [x] `src/app/admin/artikel/page.tsx` — antrean moderasi
- [x] `src/app/admin/artikel/[id]/page.tsx` — detail + review
- [x] `src/app/admin/artikel/kategori/page.tsx` — CRUD kategori
- [x] `src/components/admin/ArticleReview.tsx`, `ArticleCategoryManager.tsx`
- [x] Menu "Artikel" di `AdminSidebar` (sudah ditambahkan, uncommitted)

### Sisa Artikel
- [ ] Commit seluruh file artikel
- [ ] Verifikasi build TypeScript
- [ ] Smoke test alur: submit → PENDING → approve → tampil di Hall of Fame

---

## ✅ Testing & QA — Checklist

- [ ] Build berhasil tanpa error TypeScript
- [ ] Login admin → landing di `/admin`
- [ ] Login member → landing di `/dashboard`
- [ ] Navbar tampil avatar + Dashboard/Admin + signout
- [ ] Import template XLSX bisa diunduh
- [ ] Import file valid → semua data masuk
- [ ] Import file error → tidak ada yang masuk, tampil error per baris
- [ ] Submit artikel → status PENDING
- [ ] Admin approve artikel → muncul di tab Hall of Fame
- [ ] TipTap editor berfungsi (bold, italic, link, image)
- [ ] YouTube embed tampil dengan benar
- [ ] Semua halaman responsive (mobile, tablet, desktop)
- [ ] Keyboard navigation berfungsi
- [ ] Contrast WCAG AA lolos
- [ ] Antislop gate: tidak ada AI slop patterns

---

## 📝 Log Perubahan

### 2026-09-26 — Setup
- Branch `develop` dibuat dari `main`
- File tracking `DEVELOP.md` + `PHASES-DEVELOP.md` dibuat
- Sesi rename: "develop branch: bug fix + import + artikel"

### 2026-09-26 — Fondasi
- Install library: `exceljs`, `csv-parse`, `csv-stringify`, `@tiptap/*`
- Edit `prisma/schema.prisma`: enum + model import & artikel, `Person.externalRef`, `PersonChild.sourceSubmissionId`
- Migrasi `20260926134000_add_import_and_article_support` di-apply ke DB produksi **tanpa reset**
  - Backup dulu: `/tmp/wirjo-backup/wirjodihardjo-*.sql`
  - SQL di-generate via `prisma migrate diff --from-config-datasource --to-schema`, bersih (hanya penambahan)
  - Didaftarkan via `prisma migrate resolve --applied`
- `prisma generate` berhasil

### 2026-09-26 — Bug Fix B1-B7 (commit `6b7c90d`)
- **B1** `docker-compose.yml`: `NEXTAUTH_SECRET` hanya dari env, fallback default dihapus
- **B2** `src/app/login/page.tsx`: redirect role-aware, `next` internal dipertahankan, dibungkus `Suspense`
- **B3** `src/components/layout/Navbar.tsx`: session-aware + dropdown user + responsif
- **B4** `src/app/admin/pengguna/page.tsx` + `src/components/admin/PenggunaList.tsx`: aksi role/aktif/verifikasi
- **B5** `src/app/api/admin/relasi/route.ts`: anti-siklus + maksimal 2 orang tua
- **B6** `src/app/api/pengajuan/review/route.ts`: `sourceSubmissionId` saat approval `ADD_CHILD`
- **B7** `src/lib/genealogy.ts` + `src/components/profil/FamilyPanel.tsx`: konteks kakek-nenek

### 2026-09-26 — Artikel/Cerita (kode selesai, BELUM COMMIT)
- Library: `youtube.ts`, `slug.ts`, `sanitize.ts`
- API: submit member, list publik, list/update admin, review approve/reject, CRUD kategori
- UI publik: tab Hall of Fame + halaman baca artikel
- UI member: daftar + form TipTap
- UI admin: antrean, detail/review, kategori
- Seed 4 kategori

### 2026-09-26 — Insiden & Pemulihan
- Koordinasi git paralel antar-subagent menyebabkan `git reset --hard HEAD~1` yang sempat menghapus commit bug fix
- Pemulihan: `git reset --soft HEAD@{1}` → commit bug fix kembali (`6b7c90d`)
- Kode artikel ternyata ikut tersimpan di commit tersebut dan kembali sebagai untracked
- **Pelajaran:** tidak ada lagi operasi git destruktif saat subagent berjalan; commit hanya dari parent

### 2026-09-26 — Sidebar & Status
- `AdminSidebar`: tambah menu "Artikel" + "Impor Data"
- Verifikasi status nyata: **import backend/API/UI belum ada** (hanya `types.ts`)
- Dokumen tracking dikoreksi agar akurat

---

## 🚀 Deployment Plan

1. Selesaikan import (library + API + UI)
2. Commit semua pekerjaan (artikel + import + sidebar) ke `develop`
3. Push `develop` ke origin
4. Build + smoke test lokal
5. PR `develop` → `main` (review)
6. Merge ke `main`
7. Rebuild Docker image (no-cache)
8. Restart container `wirjodihardjo-app`
9. Smoke test produksi
10. Monitor audit log & error

---

**Catatan:**
- Password import default: `WD26` (wajib ganti saat login pertama)
- `NEXTAUTH_SECRET` produksi: generate baru, simpan di env server
- TipTap toolbar: custom build, konsisten dengan palet cream/forest/gold
- Jangan pernah `prisma migrate reset` pada DB ini (dipakai produksi)
