# Phase 0: Database Finalization
- [x] Write updated schema with all new fields and models
- [x] One migration: `finalize_admin_and_family_support`
- [ ] Seed data: family with divorce/remarriage (Rangga-Sari-Wati)

# Phase 1: Foundation UI Kit & Helpers
- [ ] requireRole() helper function
- [ ] logAudit() helper function
- [ ] Zod validations per entity
- [ ] Shared components: DataTable, Dialog, ConfirmDialog, FormField, Toast, Pagination

# Phase 2: Kinship Relation Engine
- [ ] getParents, getChildren, getSpouses, getSiblings functions
- [ ] classifySibling() → FULL / PATERNAL_HALF / MATERNAL_HALF / STEP / ADOPTED
- [ ] generationLevel auto-calculation + cycle detection
- [ ] Javanese kinship labels for all relation types
- [ ] Tests for scenarios A-E

# Phase 3: Profile & Family Panel
- [x] Inline family section: Bapak, Ibu, Bojo, Saudara (per type), Anak
- [x] Mini-graph modal (React Flow, 1-hop default, 2-hop toggle)
- [x] Javanese labels + original-term tooltip
- [x] Responsive, keyboard, contrast verified

# Phase 4: Tree Upgrade
- [x] Couple-grouped layout (partners side-by-side, children grouped per couple)
- [x] Half-sibling rendering (different partner → different family group)
- [x] Dashed lines: divorce (red dash), step-child (brown dash), adopted (green dot)
- [x] Marriage status badges (Menikah/Cerai/Alm./?) on person nodes
- [x] Filter: branch, generation, status hidup/meninggal

# Phase 5: Member Submission Flow
- [x] New submission form: /dashboard/pengajuan/baru (tambah anak)
- [x] "From which marriage" selector for add-child
- [x] Detail page: /dashboard/pengajuan/[id]
- [x] Notification on status change (createNotification + notifySubmissionStatus)

# Phase 6: Admin Shell + Overview
- [x] Sidebar with 9 menu items, breadcrumb, role indicator
- [x] /admin overview page with statistics
- [x] Role-based menu visibility

# Phase 7: Member CRUD (Data Anggota)
- [x] List with search, filter (branch, generation, status), pagination
- [x] Create / Edit Person (public + private data)
- [x] Mark deceased (birthDate, deathDate, isDeceased)
- [x] Soft delete + restore
- [x] Relation editor: parents, partners (order/status/divorce), children
- [x] Upload profile photo
- [x] AdminNote CRUD

# Phase 8: Submission Approval
- [x] Queue + filter (status, branch, type, date)
- [x] Detail with before/after diff (beforeSnapshot ditangkap saat approve)
- [x] Approve (transaction + appliedPersonId) / Reject (note required)
- [x] Duplicate detection (cek nama duplikat sebelum apply)
- [x] Recalculate generationLevel after approval

# Phase 9: Gallery Moderation
- [x] Album CRUD + publish/unpublish (admin/galeri, admin/galeri/baru, admin/galeri/[slug])
- [x] Upload media + moderate (approve/reject + reason) via admin/media
- [x] Album publishing metadata (publishedByUserId, publishedAt)

# Phase 10: Hall of Fame CRUD
- [x] CRUD entries + publish/unpublish + upload photo + filter
- [x] Admin: /admin/hall-of-fame, /admin/hall-of-fame/baru, /admin/hall-of-fame/[id]

# Phase 11: Reunion CRUD
- [x] CRUD reunion + status transitions + upload hero
- [x] Participant management (confirm/cancel/waitlist) via admin/reuni/[id]
- [x] Public detail page /reuni/[slug] with registration button
- [x] Registration API + dashboard registrations

# Phase 12: Branch CRUD
- [x] CRUD branch + set root person + set admin + activate/deactivate + cover photo
- [x] Admin: /admin/cabang, /admin/cabang/baru, /admin/cabang/[id]

# Phase 13: User CRUD
- [x] List + create account + change role + activate/deactivate + verify
- [x] Password reset (mustChangePassword) + delete account (User only)
- [x] Admin: /admin/pengguna (belum integrasi full client component, tunggu page rewrite)

# Phase 14: Audit Log
- [x] List + filter (actor, entity type, date range, action)
- [x] Detail entry + before/after JSON diff viewer

# Phase 15: Notifications & Overview
- [x] Auto-notifications: submission (new + approved/rejected), media moderation, upcoming reunion reminder
- [x] Enhanced admin overview statistics (6 metrics: total/hidup/wafat anggota, pending, cabang, pengguna)
- [x] Dashboard page reunian reminder (7 hari sebelum) via recordUpcomingReunionReminders

# Phase 16: QA & Delivery Gate
- [x] Clean build (43 pages, TypeScript zero errors, Turbopack compiled)
- [x] Smoke test publik: /, silsilah, galeri, hall-of-fame, reuni, tentang, login → 200 OK; /admin → 307 ke /login (guard berfungsi); profil ID tidak dikenal → 404
- [x] Login 3 peran + click-through halaman admin
- [x] Responsive + keyboard + WCAG AA contrast: semua pasangan teks diverifikasi dengan contrast checker script (FAIL gold #b4872a pada cream 2.89:1, FAIL gold-deep #8a6519 pada parchment 4.17:1 → perbaiki: gold-deep→#7d5b16, footer gold→gold-light #d4af5c). Semua pairing lolos AA (≥4.5 normal, ≥3.0 large).
- [x] Antislop audit: palet terbatas, tidak ada slop patterns, tidak ada teks palsu, setiap decision punya alasan (R-31)
- [x] Update PHASES.md + dokumentasi