# Struktur Halaman & Wireframe: Website Keluarga Wirjodihardjo

**Version**: 1.0
**Date**: 25 September 2026
**Pendamping**: PRD v1.0
**Dials**: Landing PUBLIK ENERGY 3 / RHYTHM 3 / MOTION 3, Dashboard ENERGY 1 / RHYTHM 1 / MOTION 1

---

## 1. Peta Situs

```
PUBLIK
├── /                      Landing (scrollytelling)
├── /silsilah              Pohon keluarga interaktif
├── /profil/[slug]         Profil publik anggota
├── /galeri                Daftar album
├── /galeri/[slug]         Isi album + lightbox
├── /hall-of-fame          Daftar apresiasi
├── /reuni                 Reuni mendatang + arsip
├── /reuni/[slug]          Detail & pendaftaran
├── /tentang               Sejarah & struktur keluarga
├── /login, /register, /lupa-password

AREA ANGGOTA (login)
└── /dashboard
    ├── /dashboard/profil          Edit profil (publik & privat)
    ├── /dashboard/pengajuan       Daftar & buat pengajuan
    ├── /dashboard/pengajuan/[id]  Detail & status
    ├── /dashboard/reuni           Pendaftaran reuni saya
    └── /dashboard/notifikasi      Notifikasi

AREA ADMIN (login + role)
└── /admin
    ├── /admin/pengajuan       Antrean approve/reject
    ├── /admin/anggota         CRUD Person & relasi
    ├── /admin/cabang          Kelola cabang & admin cabang
    ├── /admin/galeri          Moderasi album & media
    ├── /admin/hall-of-fame    Kelola entri
    ├── /admin/reuni           Kelola acara & peserta
    ├── /admin/pengguna        Peran & verifikasi akun
    └── /admin/audit-log       Riwayat perubahan
```

---

## 2. Navigasi Global

**Navbar (publik)**: Logo/wordmark Wirjodihardjo, menu: Silsilah, Galeri, Hall of Fame, Reuni, Tentang. Aksi kanan: tombol "Masuk". Mobile: menu drawer dengan tap target ≥ 44px.

**Navbar (anggota)**: sama + item "Dashboard" dan avatar profil dengan menu (Profil, Notifikasi, Keluar). Jika role admin, tambah "Admin".

**Footer**: satu baris identitas keluarga + tautan nyata (Tentang, Kontak), tanpa kolom template 4-kolom. Tidak ada tautan ke halaman yang belum ada (R-24).

---

## 3. Wireframe Halaman Publik

### 3.1 Landing `/`
```
┌───────────────────────────────────────────────┐
│ Navbar                                        │
├───────────────────────────────────────────────┤
│ HERO (full viewport)                          │
│  Latar: tekstur batik halus + parallax        │
│  Judul besar: "Keluarga Besar Wirjodihardjo"  │
│  Sub: satu baris makna (bukan buzzword)       │
│  Aksi: [Jelajahi Silsilah] [Lihat Reuni]      │
│  Elemen 3D halus: node pohon melayang         │
├───────────────────────────────────────────────┤
│ SCROLLYTELLING SEJARAH                        │
│  Pin + progress: 4 babak (Pendiri → 10 Anak → │
│  Generasi → Kini) tiap babak mengubah visual  │
├───────────────────────────────────────────────┤
│ SOROTAN SILSILAH (preview, bukan data penuh)  │
│  Mini-pohon interaktif + pencarian cepat      │
│  CTA: "Buka Silsilah Lengkap"                 │
├───────────────────────────────────────────────┤
│ GALERI SOROTAN (3-5 foto nyata, link album)   │
├───────────────────────────────────────────────┤
│ REUNI MENDATANG (kartu acara + hitung mundur) │
├───────────────────────────────────────────────┤
│ HALL OF FAME SOROTAN (2-3 entri nyata)        │
├───────────────────────────────────────────────┤
│ Ajakan: "Bergabung sebagai anggota keluarga"  │
├───────────────────────────────────────────────┤
│ Footer                                        │
└───────────────────────────────────────────────┘
```
Aturan: tidak ada angka/testimoni fiktif. Statistik hanya bila ada sumber nyata (mis. jumlah anggota terdaftar dari DB), dengan label jujur.

### 3.2 Silsilah `/silsilah`
```
┌───────────────────────────────────────────────┐
│ Navbar + breadcrumb                           │
├──────────────┬────────────────────────────────┤
│ PANEL FILTER │  KANVAS POHON                  │
│ • Search     │  Zoom / pan / fit-to-screen    │
│ • Cabang     │  Simpul: foto + nama + label   │
│ • Generasi   │  Garis: parent-child & partner │
│ • Status     │  Klik simpul → panel samping   │
│ • Gender     │  Legenda label generasi Jawa   │
│ • Reset      │                                │
├──────────────┴────────────────────────────────┤
│ PANEL DETAIL (slide-over saat simpul diklik)  │
│  - Nama, foto, label generasi, cabang         │
│  - Bio                                         │
│  - Data privat → jika anon: "Masuk untuk      │
│    melihat kontak" (tombol ke /login)         │
│  - Aksi: "Jadikan pusat pandang", "Lihat      │
│    profil lengkap"                            │
└───────────────────────────────────────────────┘
```
State: **loading** (skeleton kanvas), **empty** (belum ada data → ajakan ajukan anggota), **error** (gagal muat → tombol coba lagi). Mobile: filter jadi bottom sheet; kanvas penuh layar.

### 3.3 Profil Publik `/profil/[slug]`
- Header: foto, nama lengkap & panggilan, label generasi Jawa, cabang.
- Blok publik: bio, tempat/tahun lahir, status (hidup/wafat).
- Blok privat (gated): alamat, telepon/WA, email. Untuk anon tampil placeholder terkunci + CTA login. Untuk member tampil bila `visibleToMembers`.
- Konteks keluarga: "Anak dari ...", "Cucu dari ...", daftar saudara/anak (tautan ke simpul).
- Aksi: if own profile → "Edit profil".

### 3.4 Galeri `/galeri` dan `/galeri/[slug]`
- Daftar album: grid asimetris (RHYTHM 3) dengan cover, judul, tanggal, jumlah foto.
- Isi album: masonry + lightbox (keyboard: ←/→/Esc), caption & pengunggah.
- Aksi member: "Buat album", "Unggah foto". Media berstatus pending diberi label "Menunggu moderasi".

### 3.5 Hall of Fame `/hall-of-fame`
- Grid entri dengan foto, nama, kategori, tahun, deskripsi singkat.
- Filter kategori & tahun.
- Penanda "In Memoriam" untuk yang wafat.
- Tanpa entri → empty state jujur ("Belum ada entri"), bukan contoh palsu.

### 3.6 Reuni `/reuni` dan `/reuni/[slug]`
- Daftar: tab "Mendatang" & "Arsip". Kartu acara: judul, tanggal, lokasi, status pendaftaran.
- Detail: hero gambar acara, deskripsi, peta/link lokasi, kapasitas, tenggat pendaftaran, daftar peserta (opsional, sesuai privasi).
- Aksi: "Daftar" (member) atau "Masuk untuk mendaftar" (anon). Setelah daftar: ubah jumlah peserta / batalkan.

### 3.7 Tentang `/tentang`
- Narasi sejarah keluarga Wirjodihardjo (kaya scroll, tipografi serif).
- Penjelasan penamaan generasi adat Jawa (tabel 1-18) sebagai konten edukatif.
- Struktur 10 cabang.

---

## 4. Wireframe Area Anggota (dial rendah, fokus & ramah usia)

### 4.1 Dashboard `/dashboard`
```
┌───────────────┬───────────────────────────────┐
│ SIDEBAR       │  KONTEN                       │
│ • Ringkasan   │  Kartu ringkasan:             │
│ • Profil      │   - Kelengkapan profil saya   │
│ • Pengajuan   │   - Pengajuan menunggu saya   │
│ • Reuni saya  │   - Reuni yang saya ikuti     │
│ • Notifikasi  │   - Aksi cepat: Isi profil,   │
│               │     Ajukan anggota            │
└───────────────┴───────────────────────────────┘
```
Semua kartu punya state kosong/loading/error.

### 4.2 Edit Profil `/dashboard/profil`
- Form dua seksi jelas: **Publik** dan **Privat** (dengan catatan siapa yang bisa melihat).
- Upload foto (preview, validasi tipe/ukuran).
- Toggle "Tampilkan kontak saya ke sesama anggota".
- Data relasi (orang tua/anak) tidak bisa diubah di sini → tautan ke pengajuan.

### 4.3 Pengajuan `/dashboard/pengajuan`
- Daftar pengajuan : status (pending/approved/rejected), tanggal, catatan admin.
- Tombol "Buat pengajuan": pilih tipe (Tambah anak / Tambah pasangan / Perbaiki data), pilih orang acuan, isi data, kirim.
- Detail pengajuan: pratinjau perubahan, riwayat keputusan.

### 4.4 Reuni Saya, Notifikasi
- Daftar reuni yang diikuti + status konfirmasi.
- Notifikasi: daftar, tanda dibaca, tautan ke entitas terkait.

---

## 5. Wireframe Area Admin

### 5.1 Antrean Pengajuan `/admin/pengajuan`
```
┌───────────────────────────────────────────────┐
│ Filter: status | cabang | tipe | tanggal      │
├───────────────────────────────────────────────┤
│ Tabel pengajuan                               │
│  - Pengaju | tipe | target | tanggal | aksi   │
│  Aksi baris: [Lihat] [Setujui] [Tolak]        │
├───────────────────────────────────────────────┤
│ Panel detail (slide-over)                     │
│  - Perbandingan data sebelum/sesudah          │
│  - Kotak catatan (wajib saat menolak)         │
│  - Peringatan duplikat bila terdeteksi        │
└───────────────────────────────────────────────┘
```
Admin cabang hanya melihat pengajuan cabangnya; Super Admin melihat semua. Aksi tulis `AuditLog` + kirim `Notification` ke pengaju.

### 5.2 Anggota `/admin/anggota`
- Tabel Person: nama, generasi (label Jawa), cabang, status hidup, kelengkapan.
- Aksi: tambah, edit, tandai wafat, pindahkan cabang, putus relasi.
- Editor relasi: pilih orang tua (maks 2), pasangan, anak.

### 5.3 Cabang, Pengguna, Audit Log
- Cabang: daftar 10 cabang, admin, akar, deskripsi.
- Pengguna: verifikasi akun, ubah role, aktif/nonaktif.
- Audit Log: tabel perubahan dengan filter entitas/aktor/tanggal.

---

## 6. Komponen Bersama

- **Node silsilah**: kartu kecil dengan foto, nama, label generasi; varian "wafat" (redup + penanda).
- **Badge generasi Jawa**: label bukan hiasan kosong, tapi informasi fungsional.
- **Kartu acara reuni**, **kartu album**, **kartu entri Hall of Fame**: punya variasi hierarki, bukan salinan identik (R-14).
- **EmptyState**, **LoadingSkeleton**, **ErrorState**: dipakai konsisten di semua daftar.

---

## 7. Aturan UX & Aksesibilitas (lintas halaman)

- Navigasi keyboard penuh: Tab/Shift+Tab, Enter/Space untuk aksi, Esc menutup modal/lightbox.
- Fokus terlihat jelas; tidak menghapus outline tanpa pengganti.
- Kontras WCAG AA (4.5:1 teks normal, 3:1 teks besar).
- Hormati `prefers-reduced-motion`: matikan parallax/3D/transisi berat, sisakan fade sederhana.
- Animasi berat (3D, scrollytelling) **hanya di area publik**; area data (silsilah, dashboard, admin) mengutamakan kecepatan dan ketenangan.
- Mobile: tanpa overflow horizontal, kanvas silsilah penuh layar, filter jadi bottom sheet, tap target ≥ 44px.
- Setiap tombol/tautan punya perilaku nyata (R-26) dan tujuan yang ada (R-24).

---

## 8. Peta State per Halaman (ringkas)

| Halaman | Empty | Loading | Error | Auth-gated |
|---------|:-----:|:-------:|:-----:|:----------:|
| Silsilah | ✅ | ✅ | ✅ | sebagian |
| Profil | ✅ | ✅ | ✅ | field privat |
| Galeri/Album | ✅ | ✅ | ✅ | unggah & buat album |
| Hall of Fame | ✅ | ✅ | ✅ | - |
| Reuni | ✅ | ✅ | ✅ | pendaftaran |
| Dashboard | ✅ | ✅ | ✅ | penuh |
| Admin | ✅ | ✅ | ✅ | penuh |