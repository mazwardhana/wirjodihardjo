# Admin UX Rework — Progress Log

**Task:** Fix blocking bug + modernize admin UX (modal forms, instant filter/search, mobile bottom nav)
**Branch:** `develop`
**Mulai:** 27 September 2026
**Base commit:** `6605b57 docs: mark develop progress final state`

---

## Ringkasan Masalah

1. **Bug blocking:** 3 halaman admin crash dengan error `516787906` / `4273547074`:
   `Event handlers cannot be passed to Client Component props` (Next.js 16 strict).
   Terdampak: `/admin/artikel` (baris 80, 94), `/admin/pengajuan` (baris 97), `/admin/anggota` (baris 103).
2. **UX:** form kecil pakai modal (kecuali artikel), bukan halaman `/baru`.
3. **Filter/search:** tersedia di semua list admin, instan (debounce).
4. **Mobile:** bottom nav bar (maks 5 ikon, target 44px).

---

## Keputusan User

| Pertanyaan | Keputusan |
|-----------|-----------|
| Modal vs halaman | Modal untuk semua form, kecuali artikel (halaman tersendiri) |
| Filter | Semua list admin |
| Search | Instant (debounce) |
| Mobile nav | Bottom nav bar, maks 5 ikon |

---

## Hasil Audit Fungsionalitas (27 Sep 2026)

Tidak ada modul kosong. Semua fungsional:

| Modul | Status |
|-------|--------|
| PersonPrivate / PersonChild / PersonPartner | FUNCTIONAL (inline di AnggotaDetail) |
| GalleryMedia | FUNCTIONAL (`/admin/galeri/[slug]`) |
| HallOfFameEntry | FUNCTIONAL (baru + [id]) |
| AdminNote | FUNCTIONAL (AnggotaDetail) |
| ReunionRegistration | FUNCTIONAL (`/admin/reuni/[id]`) |
| Notification | FUNCTIONAL (`/dashboard/notifikasi`) |
| GenerationLabel | SEED ONLY |

---

## Rencana Implementasi (Multi-Agent)

- **Agent 1** (mulai pertama): Core components — `FilterBar.tsx`, `ModalForm.tsx`, `MobileBottomNav.tsx` + extend `ui/Dialog.tsx` + `admin/layout.tsx`.
- **Agent 2-5** (parallel setelah Agent 1): per halaman — artikel, anggota+pengajuan, cabang+pengguna+reuni, galeri+hall-of-fame+audit-log.

---

## Checklist Verifikasi

- [ ] `npx tsc --noEmit` exit 0
- [ ] `npx eslint` scope bersih
- [ ] `npm run build` sukses
- [ ] `/admin/artikel` tidak crash (error 516787906 hilang)
- [ ] `/admin/pengajuan` tidak crash
- [ ] `/admin/anggota` tidak crash
- [ ] Modal keyboard (Enter/Space buka, Escape tutup, focus kembali)
- [ ] Filter instan update URL + data
- [ ] Bottom nav <640px, target >=44px
- [ ] Kontras WCAG AA
- [ ] Commit + rebuild container + smoke test produksi

---

## Kronologi

### 27 Sep 2026
- Audit bug: error `516787906` akar masalah `onChange` di Server Component.
- Audit fungsionalitas (parent + subagent explore): semua modul berfungsi.
- User setujui Opsi B (bug fix + UX sekaligus) + multi-agent.
- Log ini dibuat. Implementasi dimulai.
- Core components (parent): `FilterBar`, `MobileBottomNav`, `Dialog` (size + scroll lock), layout + sidebar mobile.
- Agent 1 (artikel): bug fix + `KategoriModal`. Agent 2 (anggota/pengajuan): bug fix + filter. Agent 3 (cabang/pengguna/reuni): modal create + filter.
- Commit pertama `841bec4`. Code review (subagent) menemukan 2 Critical + 6 Important.
- Fix pasca-review:
  - Critical: hapus link `/baru` mati di `PenggunaList`; kembalikan filter `type` di pengajuan.
  - Important: hapus filter status ganda di pengajuan (pakai tabs); tabs `<a>` jadi `<Link>`; `FilterBar` reset pakai `usePathname`; `router.push` jadi `router.replace` + guard loop debounce; `KategoriModal` `router.refresh()` saat tutup; fallback Batal form ke list route.
  - Minor: Dialog body scroll lock.
- Task 4 (galeri/hall-of-fame/audit-log) menghasilkan 0 perubahan; ditugaskan ulang ke agent baru.

---

## Status Verifikasi Final

- `npx tsc --noEmit`: PASS
- `npm run build`: PASS (Next.js 16.3.6)
- ESLint: PASS (FilterBar rewritten, 0 errors)
- Bug 516787906 (onChange in Server Component): ELIMINATED
- Unit tests: audit-log query 5/5 PASS
- Browser regression tests: 18/19 PASS
  - FilterBar: search resets pagination, URL navigation syncs input, reset preserves status tab
  - Mobile 390px: 8/9 pages no horizontal scroll (pengguna has 20px overflow from positioned elements, known issue)
  - Modal keyboard: 6/6 PASS (cabang, pengguna, reuni, galeri, hall-of-fame, artikel)
  - Mobile overflow menu: focus + Escape PASS

Commits:
- `7f63fbd` feat: admin UX rework - fix Server Component crashes + instant filters + mobile nav
- `9f80aa9` fix(FilterBar): rewrite state sync to fix ESLint + browser regressions
- `0f960fd` fix(PenggunaList): replace sr-only label with aria-label to prevent overflow

Build production: ready for deployment

---

## Catatan

- `develop` sudah push ke origin (`6605b57`).
- Produksi image `sha256:541e3842` (commit `ee18c0b`), rebuild setelah selesai.
- Tidak ada operasi git destruktif. Commit hanya dari parent.
