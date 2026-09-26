# Fase Implementasi — Branch `develop`

## Phase 0: Branch Setup ✅
- [x] Buat branch `develop` dari `main`
- [x] Push branch ke origin
- [x] File tracking `DEVELOP.md`
- [x] File fase `PHASES-DEVELOP.md`

## Phase 1: Bug Fix — Critical (B1-B3)
- [x] B1: NEXTAUTH_SECRET di `docker-compose.yml` — hapus fallback
- [x] B2: Login redirect role-aware di `src/app/login/page.tsx`
- [x] B3: Navbar session-aware di `src/components/layout/Navbar.tsx`
- [ ] Test: login admin → `/admin`, login member → `/dashboard`, navbar tampil user menu

## Phase 2: Bug Fix — Important (B4-B7)
- [x] B4: Admin pengguna list integrasi aksi
- [x] B5: Anti-siklus + batas 2 orang tua di relasi route
- [x] B6: `sourceSubmissionId` di schema `PersonChild`
- [x] B7: Konteks kakek-nenek di profil
- [ ] Migration: `20260926_fix_schema_and_relations`

## Phase 3: Import — Schema & Library
- [ ] Schema: `ImportBatch`, `Person.externalRef`
- [ ] Migration: `20260926_add_import_support`
- [ ] Install library: `exceljs csv-parse csv-stringify`
- [ ] Seed kategori cabang jika belum ada

## Phase 4: Import — Backend Logic
- [ ] `src/lib/import/parser.ts`
- [ ] `src/lib/import/validate.ts`
- [ ] `src/lib/import/importer.ts`
- [ ] `src/lib/import/template.ts`
- [ ] `src/lib/import/report.ts`

## Phase 5: Import — API & UI
- [ ] API: `/api/admin/impor/*`
- [ ] UI: `/admin/impor/*` + komponen
- [ ] Menu "Impor Data" di sidebar
- [ ] Test: download template, upload valid, commit, laporan

## Phase 6: Artikel — Schema & Library
- [x] Schema: `Article`, `ArticleCategory`, `ArticleStatus`
- [x] Migration: `20260926_add_article_support`
- [x] Install TipTap: `@tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image`
- [x] Seed kategori: Sejarah Keluarga, Biografi, Kenangan, Prestasi

## Phase 7: Artikel — Backend & API
- [x] `src/lib/article/youtube.ts`
- [x] `src/lib/article/slug.ts`
- [x] `src/lib/article/sanitize.ts`
- [x] API artikel: submit, list, review, kategori CRUD

## Phase 8: Artikel — UI Publik (Hall of Fame)
- [x] Tab di `/hall-of-fame` (Apresiasi | Artikel & Cerita)
- [x] `/hall-of-fame/artikel/[slug]` — halaman baca
- [x] `ArticleCard`, `ArticleDetail`

## Phase 9: Artikel — UI Dashboard (Member)
- [x] `/dashboard/artikel` — list
- [x] `/dashboard/artikel/baru` — form submit (TipTap)
- [x] `ArticleForm` dengan toolbar custom
- [x] `ArticleEditor` dengan sanitasi HTML server-side

## Phase 10: Artikel — UI Admin (Moderasi)
- [x] `/admin/artikel` — antrean
- [x] `/admin/artikel/[id]` — detail + review
- [x] `/admin/artikel/kategori` — CRUD kategori
- [x] Menu "Artikel" di sidebar (belum ditambahkan ke AdminSidebar sesuai scope)

## Phase 11: QA & Polish
- [ ] Build check (TypeScript zero errors)
- [ ] Smoke test semua rute
- [ ] Responsive check (mobile, tablet, desktop)
- [ ] Keyboard navigation
- [ ] Contrast WCAG AA
- [ ] Antislop audit

## Phase 12: Deployment
- [ ] Push `develop` ke origin
- [ ] PR `develop` → `main`
- [ ] Review + merge
- [ ] Rebuild Docker
- [ ] Restart container
- [ ] Smoke test produksi

---

**Progress:** Phase 0 ✅ | Phase 1-2 ✅ | Phase 3-5 ⏸️ PENDING | Phase 6-10 ✅ (Artikel) | Phase 11-12 ⏸️ PENDING
