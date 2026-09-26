# Branch `develop` — Progress Tracking

**Dibuat:** 26 September 2026  
**Target:** Bug fix + Import data + Artikel/Cerita  
**Branch:** `develop` (dari `main`)

---

## 📋 Status Keseluruhan

| Fase | Status | Catatan |
|------|--------|---------|
| 🌿 Branch setup | ⏳ IN PROGRESS | |
| 🐛 Bug Fix (B1-B7) | ✅ DONE | |
| 📦 Import Data | ⏸️ PENDING | |
| ✍️ Artikel/Cerita | ✅ DONE | Implementasi artikel, moderasi, kategori, TipTap, dan Hall of Fame selesai; AdminSidebar tidak diubah sesuai scope |
| ✅ Testing & QA | ⏸️ PENDING | TypeScript/lint masih memiliki error pre-existing di modul import dan modul lain |

---

## 🐛 Bug Fix — Checklist

- [x] **B1** — NEXTAUTH_SECRET: hapus fallback default di `docker-compose.yml`, wajib dari env
- [x] **B2** — Login redirect role-aware: admin → `/admin`, member → `/dashboard`
- [x] **B3** — Navbar session-aware: tampil avatar + Dashboard/Admin + signout
- [x] **B4** — Admin pengguna list: integrasi aksi (verifikasi, role, aktif/nonaktif) + link detail/tambah
- [x] **B5** — Anti-siklus & batas 2 orang tua di relasi route
- [x] **B6** — `sourceSubmissionId` di `PersonChild` schema
- [x] **B7** — Konteks kakek-nenek di profil

---

## 📦 Import Data — Checklist

### Schema
- [ ] Model `ImportBatch`
- [ ] Field `Person.externalRef`
- [ ] Migration `add_import_support`

### Library
- [ ] Install `exceljs`, `csv-parse`, `csv-stringify`

### Backend
- [ ] `src/lib/import/parser.ts` — parse XLSX/CSV
- [ ] `src/lib/import/validate.ts` — validasi + deteksi duplikat + anti-siklus
- [ ] `src/lib/import/importer.ts` — transaksi DB
- [ ] `src/lib/import/template.ts` — generate template XLSX
- [ ] `src/lib/import/report.ts` — laporan kredensial + error

### API
- [ ] `src/app/api/admin/impor/route.ts` — POST upload, GET template
- [ ] `src/app/api/admin/impor/commit/route.ts` — POST commit

### UI
- [ ] `src/app/admin/impor/page.tsx` — halaman upload
- [ ] `src/app/admin/impor/laporan/[id]/page.tsx` — laporan
- [ ] `src/components/admin/ImporUpload.tsx` — drag & drop
- [ ] `src/components/admin/ImporPreview.tsx` — tabel preview
- [ ] `src/components/admin/ImporReport.tsx` — ringkasan
- [ ] Menu "Impor Data" di `AdminSidebar`

---

## ✍️ Artikel/Cerita — Checklist

### Schema
- [x] Enum `ArticleStatus` (PENDING | APPROVED | REJECTED)
- [x] Model `ArticleCategory`
- [x] Model `Article`
- [x] Migration `add_article_support`

### Library
- [x] Install `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`

### Backend
- [x] `src/lib/article/youtube.ts` — parse & validate YouTube URL
- [x] `src/lib/article/slug.ts` — generate unique slug
- [x] `src/lib/article/sanitize.ts` — HTML allowlist sanitizer
- [x] Seed kategori awal: Sejarah Keluarga, Biografi, Kenangan, Prestasi

### API
- [x] `src/app/api/artikel/route.ts` — POST submit artikel (member)
- [x] `src/app/api/admin/artikel/route.ts` — GET list, PUT update
- [x] `src/app/api/admin/artikel/review/route.ts` — POST approve/reject
- [x] `src/app/api/admin/artikel/kategori/route.ts` — CRUD kategori

### UI Publik
- [x] `src/app/hall-of-fame/page.tsx` — tambah tab "Artikel & Cerita"
- [x] `src/app/hall-of-fame/artikel/[slug]/page.tsx` — halaman baca artikel
- [x] `src/components/artikel/ArticleCard.tsx`
- [x] `src/components/artikel/ArticleDetail.tsx`
- [x] `src/components/artikel/HallOfFameTabs.tsx`

### UI Dashboard (Member)
- [x] `src/app/dashboard/artikel/page.tsx` — daftar artikel saya
- [x] `src/app/dashboard/artikel/baru/page.tsx` — form submit (TipTap editor)
- [x] `src/components/artikel/ArticleForm.tsx` — form dengan TipTap
- [x] `src/components/artikel/ArticleEditor.tsx` — TipTap editor custom

### UI Admin
- [x] `src/app/admin/artikel/page.tsx` — antrean moderasi
- [x] `src/app/admin/artikel/[id]/page.tsx` — detail + approve/reject
- [x] `src/app/admin/artikel/kategori/page.tsx` — CRUD kategori
- [x] `src/components/admin/ArticleReview.tsx`
- [x] `src/components/admin/ArticleCategoryManager.tsx`
- [ ] Menu "Artikel" di `AdminSidebar` (per scope tidak diubah)

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
- File tracking `DEVELOP.md` dibuat
- Sesi rename: "develop branch: bug fix + import + artikel"

### 2026-09-26 — Bug Fix B1-B7
- **B1** `docker-compose.yml`: `NEXTAUTH_SECRET` hanya dari env (`${NEXTAUTH_SECRET:?...}`), fallback default dihapus
- **B2** `src/app/login/page.tsx`: redirect role-aware (SUPER_ADMIN/BRANCH_ADMIN → `/admin`, MEMBER → `/dashboard`), `next` internal dipertahankan, dibungkus `Suspense`
- **B3** `src/components/layout/Navbar.tsx`: session-aware via `useSession` (avatar, Dashboard/Panel Admin, Profil, Notifikasi, Keluar), responsif mobile
- **B4** `src/app/admin/pengguna/page.tsx` + `src/components/admin/PenggunaList.tsx`: aksi role/aktif/verifikasi lewat API yang ada + link detail & tambah
- **B5** `src/app/api/admin/relasi/route.ts`: validasi anti-siklus + maksimal 2 orang tua, pesan error aman
- **B6** `src/app/api/pengajuan/review/route.ts`: `sourceSubmissionId` diteruskan saat approval `ADD_CHILD`
- **B7** `src/lib/genealogy.ts` + `src/components/profil/FamilyPanel.tsx`: konteks kakek-nenek pada profil

### 2026-09-26 — Artikel/Cerita System
- Schema: `ArticleStatus` + `ArticleCategory` + `Article` (migrasi `20260926134000_add_import_and_article_support`)
- `src/lib/article/youtube.ts` — parse & validasi URL YouTube (youtube.com/watch dan youtu.be)
- `src/lib/article/slug.ts` — generate slug unik dari judul (+ suffix collision)
- `src/lib/article/sanitize.ts` — sanitasi HTML allowlist (p, h2/h3, ul, ol, li, blockquote, a, img, code, strong, em, s)
- API: `POST /api/artikel` (submit member), `GET /api/admin/artikel` (list + filter), `PUT /api/admin/artikel` (update admin), `POST /api/admin/artikel/review` (approve/reject + note), CRUD `/api/admin/artikel/kategori` (SUPER_ADMIN)
- `src/app/hall-of-fame/page.tsx` — tab Apresiasi (HoF entri tetap) + Artikel & Cerita (kartu artikel approved)
- `src/app/hall-of-fame/artikel/[slug]/page.tsx` — halaman baca publik: Fraunces serif, metadata, foto, YouTube embed
- Member: `/dashboard/artikel` (daftar + status/review note), `/dashboard/artikel/baru` (TipTap editor custom palette cream/forest/gold + upload foto lewat `/api/upload/media`)
- Admin: `/admin/artikel` (antrean filter status/kategori), `/admin/artikel/[id]` (detail + form review approve/reject), `/admin/artikel/kategori` (CRUD inline)
- `src/components/artikel/ArticleEditor.tsx` — TipTap dengan toolbar custom (bold, italic, strike, headings, list, quote, link, image)
- `src/components/artikel/ArticleForm.tsx` — form submit dengan editor + upload foto + validasi YouTube
- `src/components/artikel/ArticleCard.tsx` — kartu untuk Hall of Fame
- `src/components/artikel/ArticleDetail.tsx` — tampilan baca tipografi bersih + YouTube embed
- `src/components/artikel/HallOfFameTabs.tsx` — panel tab aksesibel
- `src/components/admin/ArticleReview.tsx` — form approve/reject + catatan
- `src/components/admin/ArticleCategoryManager.tsx` — CRUD kategori inline
- Seed 4 kategori: Sejarah Keluarga, Biografi, Kenangan, Prestasi
- Sanitasi HTML server-side pada POST/PUT artikel; excerpt auto-generated dari body
- Slug di-generate ulang saat judul berubah
- TypeScript & lint: tidak ada error di seluruh file artikel baru; error pre-existing di import parser/template di luar scope

---

## 🚀 Deployment Plan

1. Semua fase selesai → build + test lokal
2. Push branch `develop` ke origin
3. PR `develop` → `main` (review)
4. Merge ke `main`
5. Rebuild Docker image (no-cache)
6. Restart container `wirjodihardjo-app`
7. Smoke test produksi
8. Monitor audit log & error

---

**Catatan:**
- Password import default: `WD26`
- NEXTAUTH_SECRET produksi: generate baru, simpan di env server
- TipTap toolbar: custom build, konsisten dengan palet cream/forest/gold
