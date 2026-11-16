# Laporan Kartu t_63ebbdd8 — Kalender Keluarga (Milad/Haul/Reuni) + Pengingat

Repo: `/opt/projects/wirjodihardjo` — dikerjakan di **worktree** `/opt/projects/wirjodihardjo-wt-kalender`,
branch **`feat/kalender-keluarga`** (dari `1e47c6f`, HEAD `feat/gedcom`). Tanpa push/merge/deploy.

## Status: SELESAI — semua AC terpenuhi

| AC | Status | Bukti |
|---|---|---|
| Model event keluarga + kalender bulanan/tanggal | ✅ | `FamilyEvent`, `FamilyEventRsvp`, enum `FamilyEventType` (MILAD/HAUL/REUNI/HALAL_BIHALAL/LAINNYA) & `RsvpStatus`; migrasi `20261116130000_add_family_event_calendar` |
| RSVP / pengingat (reuse notifikasi) | ✅ | RSVP 3-status via `POST/DELETE /api/kalender/[id]/rsvp`; pengingat 7 hari `recordUpcomingFamilyEventReminders` (idempoten type+link), di-wire ke dashboard; bukti DB: `EVENT_REMINDER | Haul: Haul Eyang Siti segera tiba` |
| Tampilan kalender + daftar agenda mendatang | ✅ | `/kalender`: grid bulanan Senin-awal, "Agenda Bulan Ini" + "Agenda Mendatang" (lintas bulan via `?agenda=1`), RSVP bar, empty/loading state |
| RBAC: admin kelola, member lihat | ✅ | `/admin/kalender` + API admin (pola sama `admin/reuni`): CRUD + audit log; E2E: member POST admin API → 401, halaman admin → redirect, anonim → /login |
| Build exit 0, tsc exit 0, tes lulus | ✅ | Build ✓ (89/89 halaman, 6 route kalender), tsc 0 error, tes kartu 12/12 + sidebar 5/5; suite penuh 1067 lulus / 47 gagal (semua pra-eksisting, lihat bawah) |
| Screenshot bukti | ✅ | `docs/bukti-kalender/*.png` (8 PNG + hasil-e2e.json), dilampirkan ke kartu |
| Commit terverifikasi; tanpa push/merge/deploy | ✅ | 4 commit lokal di `feat/kalender-keluarga` |

## Commit (terverifikasi `git log`)

1. `13133bd` feat(kalender): skema FamilyEvent + FamilyEventRsvp dan migrasi DB
2. `4ea66a8` feat(kalender): API kalender, RSVP, pengingat, dan lib perhitungan perayaan
3. `6a2569e` feat(kalender): tampilan kalender bulanan, daftar agenda, RSVP, dan panel admin
4. `3fe367f` fix(kalender): ikon sidebar Kalender unik (◫) + tes jumlah menu 16

Total: 20 file, +1735/−2 (`git diff --stat 1e47c6f..HEAD`).

## Perubahan utama

- `prisma/schema.prisma` — 66 baris tambahan murni (enum, 2 model, relasi User). `repeatYearly` menyimpan
  tanggal makna di `startsAt` (mis. lahir 1940) dan perayaan dihitung ulang tiap tahun (`lib/calendar.ts`,
  29 Feb dilandasi 28 Feb). RSVP unik per (event, user).
- `src/lib/calendar.ts` (+134) — `occurrenceForYear`, `buildMonthCells` (grid Senin-awal),
  `occurrenceInWindow`, `nextOccurrenceOnOrAfter`, label tipe. Diuji 12 kasus.
- `src/lib/notifications.ts` (+52) — pengingat H-7 untuk RSVP GOING pada event terbit, dedup via
  `notificationExists` (type `EVENT_REMINDER`, link `/kalender#event-<id>`); dipanggil dari
  `src/app/dashboard/page.tsx` berdampingan dengan reminder reuni existing.
- API: `GET /api/kalender` (filter bulan / `agenda=1` maks 20 perayaan berikutnya), `POST|DELETE
  /api/kalender/[id]/rsvp`, admin `GET|POST /api/admin/kalender` + `[id]` PUT/DELETE dengan `logAudit`.
- UI: `/kalender` (KalenderClient + KalenderComponents), `/admin/kalender` (tabel event + EventForm/
  EventModals/EventRowActions), nav "Kalender" di Navbar publik + sidebar admin.

## Verifikasi (angka tercatat)

- `npx tsc --noEmit` → 0 error (worktree & snapshot arsip).
- `next build` → exit 0, `✓ Compiled successfully`, 89/89 halaman statis, 6 route kalender terdaftar.
  Build final dijalankan dari **snapshot bersih `git archive HEAD`** (`/home/orca/wirjo-kalender-pristine`).
- Tes kartu: `calendar.test.ts` 12/12 lulus; `AdminSidebar.test.ts` 5/5 lulus (ikon entri menu wajib unik).
- Suite penuh: **1115 tes → 1067 lulus, 47 gagal, 1 skip**. Seluruh 47 gagal pra-eksisting di luar kartu ini
  (23 `api/admin/relasi/route.test.ts` + 24 `api/admin/keluarga|anggota/*`), cocok dengan baseline yang
  tercatat di memori proyek; 0 regresi dari kalender (sebelum perbaikan ikon sempat 48, kini 47).
- E2E puppeteer (DB uji terpisah `kalender_e2e_*`, server `next start` port 3112): **14/14 langkah lulus**
  — login admin, panel memuat seed, buat event via modal, unpublish→publish (verifikasi API), uji kebocoran
  draft, kalender member (agenda bulan ini + mendatang), RSVP Hadir tersimpan, RBAC 401/redirect/login,
  dashboard member memicu pengingat (baris `Notification` muncul di DB), mobile 390px.

## Catatan teknis untuk pengerjaan berikutnya

- Port **3111 sudah terisi** server uji kartu lain → server uji kartu ini di **3112** dengan `AUTH_SECRET`
  dummy lokal + `DATABASE_URL` DB uji; jangan matikan `next-server` lain di host.
- DNS host mati ke luar (fonts.googleapis.com tidak terjangkau) → `next build` gagal fetch font Google.
  Solusi: seed `.next/cache` Turbopack (v16.3.6-a758ffcf) dari build sukses sebelumnya sebelum build offline.
- `prisma migrate deploy` di DB segar gagal karena satu migration lama memvalidasi "exactly 10 branches"
  (script data, bukan skema) → untuk DB uji segar dipakai `prisma db push --accept-data-loss`.
- Draft fitur ini ditemukan tersebar di working tree utama (sisa run 24 yang crash); diadopsi ke worktree,
  diperbaiki (bug serialisasi `startsAt` Date→ISO, wiring pengingat, seksi agenda mendatang), lalu di-commit
  rapi per kelompok. Diff AGENTS.md/DESIGN.md rusak di working tree utama **tidak** diadopsi.

## Cara pakai singkat

Admin: `/admin/kalender` → "Event Baru" (judul, tipe, tanggal, lokasi, centang "Terbitkan"; milad/haul
centang "Berulang tiap tahun"). Member: `/kalender` → pilih tanggal/agenda → RSVP Hadir/Mungkin/Tidak
Hadir; pengingat otomatis muncul di notifikasi dashboard H-7 (RSVP Hadir).
