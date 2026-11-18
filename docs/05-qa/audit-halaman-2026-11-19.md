# AUDIT HALAMAN — wirjodihardjo (release/des2026 = main pasca-merge c091b21)

**Tanggal audit:** 19 Nov 2026 · **Dasar kode:** worktree `/opt/projects/wirjodihardjo-wt-mainmerge` di `c091b21` (HEAD main setelah merge, isi = release/des2026) · **Metode:** analisis statis rujukan lintas file (script Python di host), pemeriksaan file route/page, smoke test HTTP build produksi lokal (`next start -p 3212`, GET-only, tanpa sentuh produksi).

## Daftar halaman (61 route `page.tsx`)

| URL | Fungsi | Status | Bukti | Rekomendasi |
|---|---|---|---|---|
| `/` | Landing / beranda keluarga (cerita, cabang, reuni, CTA) | UNIK | `src/app/page.tsx` (278 baris) | PERTAHANKAN |
| `/dashboard` | Ringkasan profil pribadi + keluarga saya + pengajuan + notifikasi | UNIK | `src/app/dashboard/page.tsx`; dirujuk 46 file | PERTAHANKAN |
| `/dashboard/artikel` | Artikel yang dimoderasi user | UNIK | `src/app/dashboard/artikel/page.tsx` | PERTAHANKAN |
| `/dashboard/artikel/baru` | Form tulis artikel | UNIK | `src/app/dashboard/artikel/baru/page.tsx`; link dari `/dashboard/artikel` | PERTAHANKAN |
| `/dashboard/notifikasi` | Pusat notifikasi (RSVP/dll.) | UNIK | `src/app/dashboard/notifikasi/page.tsx`; Navbar + MobileBottomNav | PERTAHANKAN |
| `/dashboard/pengajuan` | Daftar pengajuan saya (anggota/perubahan) | UNIK | `src/app/dashboard/pengajuan/page.tsx` | PERTAHANKAN |
| `/dashboard/pengajuan/baru` | Form pengajuan baru | UNIK | `src/app/dashboard/pengajuan/baru/page.tsx`; link di DataKeluargaSaya | PERTAHANKAN |
| `/dashboard/pengajuan/[id]` | Detail pengajuan | UNIK | `src/app/dashboard/pengajuan/[id]/page.tsx`; link dari list + notifikasi | PERTAHANKAN |
| `/dashboard/profil` | Profil lengkap (edit) | UNIK | `src/app/dashboard/profil/page.tsx` | PERTAHANKAN |
| `/dashboard/reuni` | Reuni yang saya ikuti | UNIK | `src/app/dashboard/reuni/page.tsx`; link dari `/dashboard` | PERTAHANKAN |
| `/profil/[id]` | Profil publik per orang (keluarga, timeline, peta, memori) | UNIK | `src/app/profil/[id]/page.tsx`; dirujuk dinamis 9 file (silsilah, HoF, pengurus, dll.) | PERTAHANKAN |
| `/silsilah` | Pohon silsilah (3 mode: Pohon/Pedigree/Fan) + pencarian + kalkulator relasi + unduh PDF | UNIK | `src/app/silsilah/page.tsx` (206); Navbar/Footer/BottomNav | PERTAHANKAN |
| `/galeri` | Katalog album publik | UNIK | `src/app/galeri/page.tsx`; Navbar/Footer | PERTAHANKAN |
| `/galeri/[slug]` | Isi album + lightbox | UNIK | `src/app/galeri/[slug]/page.tsx`; dinamis dari galeri | PERTAHANKAN |
| `/hall-of-fame` | HoF publik (prestasi + in memoriam + artikel apresiasi) | UNIK | `src/app/hall-of-fame/page.tsx` (156); Navbar/Footer | PERTAHANKAN |
| `/hall-of-fame/artikel/[slug]` | Detail artikel | UNIK | `src/app/hall-of-fame/artikel/[slug]/page.tsx`; link dari ArticleCard (HoF/home) | PERTAHANKAN |
| `/kalender` | Kalender keluarga (milad/haul/reuni) + RSVP | UNIK | `src/app/kalender/page.tsx` (67); Navbar | PERTAHANKAN |
| `/reuni` | Daftar reuni | UNIK | `src/app/reuni/page.tsx`; Navbar/Footer/beranda | PERTAHANKAN |
| `/reuni/[slug]` | Detail reuni (RSVP, buku tamu) | UNIK | `src/app/reuni/[slug]/page.tsx`; dinamis dari list | PERTAHANKAN |
| `/reuni/buku-tamu` | Catat kehadiran + rombongan | UNIK | `src/app/reuni/buku-tamu/page.tsx`; link dari `/reuni` | PERTAHANKAN |
| `/statistik` | Statistik publik (kondisi anggota, sebaran cabang, reuni, form registrasi) | UNIK | `src/app/statistik/page.tsx` (557); Navbar | PERTAHANKAN (lihat analisa C) |
| `/registrasi` | Registrasi/penambahan anggota oleh keluarga | UNIK | `src/app/registrasi/page.tsx`; Navbar/Footer | PERTAHANKAN |
| `/registrasi/anggota` | Daftar anggota tercatat | UNIK | `src/app/registrasi/anggota/page.tsx`; link dari `/statistik`, MemberRegistryCard | PERTAHANKAN |
| `/pengurus` | Struktur pengurus publik | UNIK | `src/app/pengurus/page.tsx`; Navbar/Footer | PERTAHANKAN |
| `/tentang` | Sejarah keluarga | UNIK | `src/app/tentang/page.tsx`; Navbar/Footer | PERTAHANKAN |
| `/login` | Masuk | UNIK | `src/app/login/page.tsx` | PERTAHANKAN |
| `/onboarding` | Lengkapi akun setelah login pertama | UNIK | `src/app/onboarding/page.tsx`; redirect dari auth/`/dashboard` | PERTAHANKAN |
| `/offline` | Halaman cadangan PWA saat luring | UNIK | `src/app/offline/page.tsx`; dirujuk `scripts/build-sw.mjs` (OFFLINE_URL) | PERTAHANKAN |
| `/admin` | Overview admin | UNIK | `src/app/admin/page.tsx`; sidebar | PERTAHANKAN |
| `/admin/anggota` | Kelola data anggota | UNIK | `src/app/admin/anggota/page.tsx` (212); sidebar | PERTAHANKAN |
| `/admin/anggota/[id]` | Detail anggota | UNIK | `src/app/admin/anggota/[id]/page.tsx`; link dari list/`/dashboard`/sidebar | PERTAHANKAN |
| `/admin/anggota/tambah` | Tambah anggota (halaman penuh) | **DUPLIKAT** | form sama dengan modal `AnggotaCreateModal` (`src/app/admin/anggota/AnggotaCreateModal.tsx`); komentar file modal: "form sama dengan halaman … tanpa pindah" | **GABUNGKAN** (pertahankan salah satu; lihat C) |
| `/admin/cabang` | Redirect ke `/admin/keluarga/cabang` | **DUPLIKAT-ORPHAN** | `src/app/admin/cabang/page.tsx` = murni `redirect("/admin/keluarga/cabang")`; keberadaan route ini membuat /admin/cabang/[id] & /admin/cabang/baru ikut hidup tapi tak di-link | **HAPUS** (migrasi penuh sudah selesai; file redirect dibiarkan) |
| `/admin/cabang/baru` | Form tambah cabang (halaman) | **DUPLIKAT** | form sama dengan `CabangCreateModal` (`src/app/admin/cabang/CabangCreateModal.tsx`); tidak ada link ke halaman ini (0 referensi non-test) | **GABUNGKAN** |
| `/admin/cabang/[id]` | (kosong) | **TIDAK-BERGUNA** | `src/app/admin/cabang/[id]/page.tsx` hanya 22 baris, render kosong tanpa UI (cek `git diff` — file kosong dari rilis); tidak di-link | **HAPUS** |
| `/admin/keluarga` | Dashboard keluarga (pilih cabang, anggota, grafik) | UNIK | `src/app/admin/keluarga/page.tsx` (90); sidebar | PERTAHANKAN |
| `/admin/keluarga/cabang` | Kelola cabang terpadu (list + create modal) | UNIK | `src/app/admin/keluarga/cabang/page.tsx` (92); sidebar `Keluarga Cabang` → route ini; dibanjiri ref (7) | PERTAHANKAN |
| `/admin/keluarga/cabang/[id]` | Detail cabang terpadu | UNIK | `src/app/admin/keluarga/cabang/[id]/page.tsx`; link dari list | PERTAHANKAN |
| `/admin/galeri` | Kelola album | UNIK | `src/app/admin/galeri/page.tsx` (204); sidebar | PERTAHANKAN |
| `/admin/galeri/[slug]` | Detail album admin (moderasi media) | UNIK | `src/app/admin/galeri/[slug]/page.tsx`; link dari list | PERTAHANKAN |
| `/admin/galeri/baru` | Form album baru (halaman) | **DUPLIKAT** | form sama dengan `AlbumCreateModal`; 0 referensi non-test | **GABUNGKAN** |
| `/admin/hall-of-fame` | Kelola HoF | UNIK | `src/app/admin/hall-of-fame/page.tsx`; sidebar | PERTAHANKAN |
| `/admin/hall-of-fame/baru` | Form HoF baru (halaman) | **DUPLIKAT** | form sama dengan `HallOfFameCreateModal`; 0 referensi non-test | **GABUNGKAN** |
| `/admin/hall-of-fame/[id]` | Edit HoF | UNIK | `src/app/admin/hall-of-fame/[id]/page.tsx`; link dari list | PERTAHANKAN |
| `/admin/artikel` | Moderasi artikel | UNIK | `src/app/admin/artikel/page.tsx` (170); sidebar | PERTAHANKAN |
| `/admin/artikel/[id]` | Review artikel | UNIK | `src/app/admin/artikel/[id]/page.tsx`; link dari list | PERTAHANKAN |
| `/admin/artikel/kategori` | Kelola kategori artikel | UNIK | `src/app/admin/artikel/kategori/page.tsx`; link dari ArticleCategoryManager (halaman artikel) | PERTAHANKAN |
| `/admin/memori` | Moderasi memori | UNIK | `src/app/admin/memori/page.tsx`; sidebar | PERTAHANKAN |
| `/admin/kalender` | Kelola event kalender + RSVP | UNIK | `src/app/admin/kalender/page.tsx` (107); sidebar | PERTAHANKAN |
| `/admin/pengajuan` | Moderasi pengajuan | UNIK | `src/app/admin/pengajuan/page.tsx` (177); sidebar | PERTAHANKAN |
| `/admin/pengguna` | Kelola akun | UNIK | `src/app/admin/pengguna/page.tsx` (109); sidebar | PERTAHANKAN |
| `/admin/pengguna/[id]` | Detail akun | UNIK | `src/app/admin/pengguna/[id]/page.tsx`; link dari list | PERTAHANKAN |
| `/admin/pengguna/baru` | Form akun baru (halaman) | **DUPLIKAT** | form sama dengan `PenggunaCreateModal` (dipakai di `/admin/pengguna`); 0 referensi non-test | **GABUNGKAN** |
| `/admin/pengurus` | Kelola struktur pengurus | UNIK | `src/app/admin/pengurus/page.tsx` (129); sidebar | PERTAHANKAN |
| `/admin/registrasi` | Impor registrasi keluarga (CSV template) | UNIK | `src/app/admin/registrasi/page.tsx`; sidebar | PERTAHANKAN |
| `/admin/impor` | Impor data keluarga (umum) + GEDCOM | UNIK | `src/app/admin/impor/page.tsx`; sidebar | PERTAHANKAN (lihat C, fitur GEDCOM) |
| `/admin/impor/preview` | Pratinjau batch impor | UNIK | `src/app/admin/impor/preview/page.tsx`; link dari ImporClient | PERTAHANKAN |
| `/admin/impor/laporan/[id]` | Laporan batch | UNIK | `src/app/admin/impor/laporan/[id]/page.tsx`; link dinamis dari ImporReport | PERTAHANKAN |
| `/admin/reuni` | Kelola reuni | UNIK | `src/app/admin/reuni/page.tsx` (166); sidebar | PERTAHANKAN |
| `/admin/reuni/baru` | Form reuni (halaman) | **DUPLIKAT** | form sama dengan `ReunionCreateModal`; 0 referensi non-test | **GABUNGKAN** |
| `/admin/reuni/[id]` | Detail reuni admin (registrasi, checkin, QR) | UNIK | `src/app/admin/reuni/[id]/page.tsx` (215); link dari list | PERTAHANKAN |
| `/admin/audit-log` | Riwayat audit | UNIK (tapi lihat C) | `src/app/admin/audit-log/page.tsx`; sidebar | PERTAHANKAN (perbaiki pagination) |
| `/admin/statistik` | Statistik admin (ringkasan, cabang, reuni, kredensial akun) | UNIK (tapi lihat C) | `src/app/admin/statistik/page.tsx` (504); sidebar; SUPER_ADMIN only | PERTAHANKAN (bedakan peran) |
| `/admin/gedcom` | (TIDAK ADA) | **ORPHAN-RUTE** | Tidak ada `page.tsx`! Route `/admin/gedcom` tidak ada; API GEDCOM exist tapi tidak ada UI. Smoke test GET `/admin/gedcom` → 200 = fallback catch-all? (verifikasi: Next return 200 dgn halaman 404 hanya jika ada route; cek `src/app/admin/gedcom` tidak ada di `find`) | **Buat UI atau hapus API** (lihat C) |

## Temuan non-halamanangkan- Halaman `/admin/cabang/[id]` (22 baris) render kosong — tidak ada komponen; kemungkinan placeholder yang terlupakan.
- **GEDCOM: hanya API, tanpa UI.** `src/app/api/admin/gedcom/{route,commit,export}.ts` + `src/lib/gedcom/*` (parser/validate/analyze/preview/commit/export, 6 file tes) tidak dirujuk SATU PUN komponen `.tsx` (0 hasil grep `gedcom` di `src/**/*.tsx`). Fitur import/export GEDCOM (inti rilis release/des2026) tidak terjangkau dari UI. `/admin/impor` hanyalah impor XLSX/CSV.
- **Debugging smoke test:** semua 500 di dev-mode = bug Turbopack parse CSS (`env()` di `globals.css`), sudah divergen dgn build produksi.
- **Dead code:** `src/components/ui/DataTable.tsx` (0 referensi non-test), `src/components/ui/FormField.tsx` (0), `src/components/profile/ProfileEditModal.tsx` (0 — hanya deklarasi sendiri), `src/components/kalender/KalenderComponents.tsx` (dipakai KalenderClient — bukan dead).
- **API tanpa pemanggil klien/lib non-route:** `/api/admin/audit-log` (0), `/api/admin/gedcom/*` (0, hanya dipakai route lain? cek: tidak), `/api/profil/education` & `/api/profil/education/[id]` (0 — komponen `useProfileCollection` dipakai utk education & social; education mungkin dead path — verifikasi `ProfileForm` pakai education?), `/api/auth/[...nextauth]` (via library, wajar).
