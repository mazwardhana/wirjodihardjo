# Fase Implementasi — Branch `develop`

**Update terakhir:** 26 September 2026  
**HEAD:** `6b7c90d fix: auth navigation and family data integrity`

---

## Phase 0: Branch Setup ✅
- [x] Buat branch `develop` dari `main`
- [x] File tracking `DEVELOP.md`
- [x] File fase `PHASES-DEVELOP.md`
- [ ] Push `develop` (dengan commit baru) ke origin

## Phase 1: Bug Fix — Critical (B1-B3) ✅
- [x] B1: `NEXTAUTH_SECRET` di `docker-compose.yml` — hapus fallback
- [x] B2: Login redirect role-aware di `src/app/login/page.tsx`
- [x] B3: Navbar session-aware di `src/components/layout/Navbar.tsx`
- [ ] Test manual: login admin → `/admin`, login member → `/dashboard`, navbar user menu

## Phase 2: Bug Fix — Important (B4-B7) ✅
- [x] B4: Admin pengguna list integrasi aksi
- [x] B5: Anti-siklus + batas 2 orang tua di relasi route
- [x] B6: `sourceSubmissionId` di schema + diteruskan saat approval
- [x] B7: Konteks kakek-nenek di profil

## Phase 3: Schema & Migration (shared) ✅
- [x] Enum `ArticleStatus`, `ImportStatus`
- [x] Model `ImportBatch`, `ArticleCategory`, `Article`
- [x] `Person.externalRef`, `PersonChild.sourceSubmissionId`
- [x] Migrasi `20260926134000_add_import_and_article_support` di-apply tanpa reset
- [x] `prisma generate`

## Phase 4: Import — Library ⏸️ PARTIAL
- [x] Install `exceljs csv-parse csv-stringify`
- [x] `src/lib/import/types.ts`
- [ ] `src/lib/import/parser.ts`
- [ ] `src/lib/import/validate.ts`
- [ ] `src/lib/import/importer.ts`
- [ ] `src/lib/import/template.ts`
- [ ] `src/lib/import/report.ts`
- [ ] `src/lib/import/index.ts`

## Phase 5: Import — API ⏸️ PENDING
- [ ] `GET/POST /api/admin/impor` — template + upload/validasi
- [ ] `POST /api/admin/impor/commit` — commit batch
- [ ] `GET /api/admin/impor/laporan` — laporan

## Phase 6: Import — UI ⏸️ PENDING
- [ ] `/admin/impor` — upload + preview
- [ ] `/admin/impor/laporan/[id]` — laporan
- [ ] `ImporUpload`, `ImporPreview`, `ImporReport`
- [x] Menu "Impor Data" di `AdminSidebar`

## Phase 7: Artikel — Library & API ✅ (belum commit)
- [x] `youtube.ts`, `slug.ts`, `sanitize.ts`
- [x] API submit/list publik
- [x] API admin list/update/review
- [x] API kategori CRUD
- [x] Seed 4 kategori

## Phase 8: Artikel — UI ✅ (belum commit)
- [x] Tab Hall of Fame + halaman baca publik
- [x] Dashboard member (list + form TipTap)
- [x] Admin (antrean + review + kategori)
- [x] Menu "Artikel" di `AdminSidebar`

## Phase 9: Commit & Push ⏸️ PENDING
- [ ] Commit seluruh pekerjaan artikel + import + sidebar
- [ ] Push `develop` ke origin

## Phase 10: QA & Polish ⏸️ PENDING
- [ ] Build check (TypeScript zero errors)
- [ ] Smoke test semua rute
- [ ] Responsive check (mobile, tablet, desktop)
- [ ] Keyboard navigation
- [ ] Contrast WCAG AA
- [ ] Antislop audit

## Phase 11: Deployment ⏸️ PENDING
- [ ] PR `develop` → `main`
- [ ] Review + merge
- [ ] Rebuild Docker (no-cache)
- [ ] Restart container `wirjodihardjo-app`
- [ ] Smoke test produksi

---

**Progress:** Phase 0-3 ✅ | Phase 4 ⏸️ PARTIAL (hanya fondasi) | Phase 5-6 ⏸️ PENDING (import) | Phase 7-8 ✅ belum commit (artikel) | Phase 9-11 ⏸️ PENDING
