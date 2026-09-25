# Product Requirements Document: Website Keluarga Besar Wirjodihardjo

**Version**: 1.0
**Date**: 25 September 2026
**Author**: Sarah (Product Owner)
**Quality Score**: 93/100

---

## Executive Summary

Keluarga besar Wirjodihardjo, berakar dari pasangan Tn. & Ny. Wirjodihardjo dengan 10 anak, kini telah berkembang menjadi ratusan hingga ribuan keturunan yang tersebar lintas generasi. Tanpa sistem pencatatan yang terpusat, data silsilah, kenangan, dan koordinasi reuni berisiko hilang atau terpecah di banyak dokumen pribadi.

Website ini menjadi **rumah digital** keluarga: arsip silsilah yang hidup dan interaktif, galeri kenangan bersama, ajang apresiasi (Hall of Fame), serta pusat koordinasi reuni. Nilai utamanya adalah melestarikan identitas dan ikatan keluarga, sekaligus mempermudah anggota saling mengenal lintas cabang dan generasi.

Diferensiasi produk terletak pada **silsilah interaktif dengan penamaan generasi adat Jawa** (Anak, Putu, Buyut, Canggah, Wareng, dan seterusnya hingga Trah Tumerah) yang divisualisasikan sebagai pohon eksploratif, bukan sekadar tabel. Ini menyelesaikan masalah "siapa masih keluarga kita?" dengan cara yang sekaligus mendidik dan membanggakan.

---

## Problem Statement

**Current Situation**
- Data silsilah hanya tersimpan di ingatan sesepuh, dokumen cetak, atau file spreadsheet yang tidak terhubung.
- Anggota lintas cabang sulit mengenal satu sama lain dan tidak tahu hubungan kekerabatan mereka.
- Informasi reuni tersebar lewat grup pesan dan mudah tenggelam.
- Tidak ada kanal resmi untuk menyimpan foto dan kenangan bersama.
- Penambahan anggota baru tidak punya mekanisme validasi, sehingga rawan data ganda atau salah relasi.

**Proposed Solution**
Portal web keluarga dengan empat pilar: **(1) Silsilah Interaktif**, **(2) Arsip & Galeri**, **(3) Apresiasi & Reuni**, **(4) Dashboard Keluarga** dengan login. Mekanisme pengajuan anggota baru divalidasi admin cabang sebelum masuk ke pohon keluarga.

**Business Impact**
- Silsilah tertata dan tervalidasi: setiap perubahan punya jejak persetujuan.
- Keterlibatan keluarga meningkat karena ada pusat komunikasi dan kenangan.
- Warisan budaya Jawa terjaga lewat label generasi yang distandarkan.

---

## Success Metrics

**Primary KPI** (metrik utama: jumlah anggota & kelengkapan data)

| Metrik | Target | Cara Ukur |
|--------|--------|-----------|
| Anggota terdaftar | ≥ 70% dari estimasi populasi keluarga | Jumlah `Person` di database |
| Kelengkapan profil | ≥ 60% anggota punya foto + bio + minimal 1 kontak | Query kelengkapan per record |
| Akurasi relasi | 100% relasi terverifikasi admin | Setiap relasi berasal dari pengajuan `approved` |

**Secondary KPI**

| Metrik | Target | Cara Ukur |
|--------|--------|-----------|
| Partisipasi reuni | ≥ 50% anggota mengonfirmasi kehadiran | Pendaftaran reuni |
| Engagement galeri | ≥ 500 foto terunggah 6 bulan pertama | Jumlah media di DB |
| Retensi login | ≥ 40% anggota login aktif bulanan | Analytics auth |

**Validation**: dashboard analitik internal, dievaluasi saat bulan ke-3 dan ke-6 setelah rilis.

---

## User Personas

### Primary: Pakde Harto (Sesepuh / Penjaga Silsilah), 62 tahun
- **Role**: Anggota generasi ke-2 atau 3, disegani di cabangnya.
- **Goals**: Memastikan silsilah akurat dan diwariskan ke cucu.
- **Pain Points**: Data di buku tua rusak; sulit melacak relasi jauh.
- **Tech Level**: Menengah (bisa WhatsApp dan browser).

### Secondary: Rina (Anggota Muda), 27 tahun
- **Role**: Generasi ke-4/5, aktif di media sosial.
- **Goals**: Mengenal keluarga besar, cari saudara sebaya, ikut reuni.
- **Pain Points**: Tidak tahu panggilan kekerabatan yang benar; canggung bertanya.
- **Tech Level**: Advanced.

### Tertiary: Mas Dwi (Admin Cabang), 40 tahun
- **Role**: Ditunjuk mengelola data satu cabang keturunan.
- **Goals**: Menjaga data cabangnya bersih dan mutakhir.
- **Pain Points**: Tidak punya alat untuk memvalidasi pengajuan anggota.
- **Tech Level**: Menengah.

---

## User Stories & Acceptance Criteria

### Story 1: Menjelajahi silsilah
**As a** anggota keluarga
**I want to** melihat pohon keluarga besar secara interaktif dengan pencarian dan filter
**So that** saya tahu posisi dan hubungan saya di keluarga besar

**Acceptance Criteria:**
- [ ] Pohon tampil dengan simpul akar Tn. & Ny. Wirjodihardjo, dapat di-zoom, pan, dan dilipat/dibuka per cabang.
- [ ] Search menemukan orang berdasarkan nama/nama panggilan, hasil muncul < 1 detik untuk 5.000 simpul.
- [ ] Filter tersedia: cabang (10 anak), generasi (label Jawa), status (hidup/wafat), dan jenis kelamin.
- [ ] Setiap simpul menampilkan nama, label generasi Jawa, dan foto (jika ada).
- [ ] Data publik (nama, hubungan, foto) tampil tanpa login; data sensitif (alamat, telepon/WA, email) hanya tampil setelah login.

### Story 2: Menambahkan anggota baru dengan approval
**As a** anggota terautentikasi
**I want to** mengajukan penambahan anak/pasangan ke silsilah
**So that** data keluarga bertambah tanpa mengubah pohon secara sembarangan

**Acceptance Criteria:**
- [ ] Form pengajuan meminta relasi ke `Person` yang sudah ada, tipe relasi, dan data orang baru.
- [ ] Pengajuan masuk status `pending` dan muncul di antrean admin cabang terkait.
- [ ] Admin cabang dapat `approve` atau `reject` dengan catatan; keputusan terkirim sebagai notifikasi ke pengaju.
- [ ] Hanya setelah `approve` simpul baru muncul di pohon.
- [ ] Sistem menolak pengajuan duplikat (nama + tanggal lahir sama dalam satu orang tua).

### Story 3: Mengisi profil keluarga
**As a** anggota terautentikasi
**I want to** memperbarui profil saya (foto, bio, kontak)
**So that** keluarga lain mengenal saya dan dapat menghubungi bila perlu

**Acceptance Criteria:**
- [ ] Anggota dapat mengunggah foto profil (maks 5MB, JPG/PNG/WebP).
- [ ] Field publik dan privat terpisah jelas di form.
- [ ] Perubahan data relasi (orang tua/anak) tidak bisa diubah sendiri, harus lewat pengajuan.
- [ ] Viewer anonim hanya melihat field publik; field privat menampilkan ajakan login.

### Story 4: Reuni
**As a** anggota keluarga
**I want to** melihat jadwal reuni mendatang dan mendaftar
**So that** saya tidak ketinggalan acara keluarga

**Acceptance Criteria:**
- [ ] Halaman reuni menampilkan acara mendatang dan arsip acara lampau.
- [ ] Detail acara: tanggal, lokasi, deskripsi, penyelenggara, dan status pendaftaran.
- [ ] Anggota dapat mendaftar (jumlah peserta), membatalkan, dan melihat status konfirmasi.
- [ ] Non-anggota melihat info acara publik, tombol daftar mengarah ke login.

### Story 5: Galeri & Hall of Fame
**As a** anggota keluarga
**I want to** mengunggah foto kenangan dan melihat apresiasi anggota berprestasi
**So that** kenangan dan kontribusi keluarga terdokumentasi

**Acceptance Criteria:**
- [ ] Album dapat dibuat per acara/kategori; foto punya caption dan pengunggah.
- [ ] Foto dari anggota masuk moderasi admin sebelum tayang publik.
- [ ] Hall of Fame menampilkan entri (nama, kategori, deskripsi, tahun) yang hanya bisa dibuat admin.
- [ ] Tidak ada testimoni/statistik fiktif; semua entri berasal dari data nyata.

---

## Functional Requirements

### 6.1 Silsilah Interaktif
- **Deskripsi**: Pohon keluarga berlabel generasi Jawa, eksploratif dan cepat.
- **User flow**: Login/anon → buka silsilah → zoom/pan atau search/filter → klik simpul → panel detail profil.
- **Aturan generasi**: label dihitung dari jarak terhadap akar keluarga. Tingkat 1..18: Anak, Putu/Wayah, Buyut, Canggah, Wareng, Udheg-udheg, Gantung siwur, Gropak senthe, Debog bosok, Galih asem, Gropak waton, Cendheng, Giyeng, Cumpleng, Ampleng, Menyaman, Menya-menya, Trah tumerah. Di luar 18, tampilkan "Generasi ke-N".
- **Edge case**: anggota dengan orang tua tidak diketahui; anggota wafat (ditandai visual); pernikahan antar cabang.
- **Error handling**: bila data gagal dimuat, tampilkan state error dengan tombol coba lagi; bila cabang terlalu besar, batasi render dengan pemuatan bertahap (lazy).

### 6.2 Pencarian & Filter
- **Deskripsi**: Temukan orang cepat dalam ribuan simpul.
- **User flow**: ketik nama → hasil instan → pilih → pohon memfokuskan simpul.
- **Edge case**: ejaan berbeda/alias; nama panggilan; hasil kosong → tampilkan saran kata kunci.
- **Error handling**: bila indeks pencarian tidak tersedia, fallback ke pencarian database.

### 6.3 Login, Peran & Dashboard
- **Deskripsi**: Autentikasi anggota dan kontrol akses berbasis peran.
- **Peran**: `Super Admin` (pengelola pusat), `Admin Cabang` (validasi cabang), `Anggota` (lihat data privat, ajukan, isi profil), `Publik` (data publik saja).
- **User flow**: daftar → verifikasi (diundang/disetujui admin) → login → dashboard personal.
- **Edge case**: lupa password, akun belum diverifikasi, akun dinonaktifkan.
- **Error handling**: kredensial salah memberi pesan aman tanpa membocorkan data.

### 6.4 Pengajuan & Approval Anggota
- **Deskripsi**: Workflow validasi penambahan/ubah relasi.
- **User flow**: anggota ajukan → status pending → notifikasi admin cabang → approve/reject → notifikasi pengaju → pohon diperbarui.
- **Edge case**: admin cabang tidak aktif (eskalasi ke Super Admin); pengajuan ganda; pengajuan terkait orang yang sudah wafat.
- **Error handling**: konflik data saat approval ditolak dengan alasan yang jelas.

### 6.5 Profil Anggota
- **Field publik**: nama lengkap, nama panggilan, foto, jenis kelamin, tahun/tempat lahir, bio singkat, label generasi, cabang.
- **Field privat (login)**: alamat lengkap, nomor telepon/WhatsApp, email, status pernikahan, catatan keluarga.
- **Edge case**: anggota yang tidak ingin kontak tampil dapat menandai "jangan tampilkan" ke sesama anggota.

### 6.6 Galeri
- **Deskripsi**: Album foto keluarga dengan moderasi.
- **User flow**: buat album → unggah → moderasi admin → tayang.
- **Edge case**: file terlalu besar/format tidak didukung; unggahan gagal sebagian.
- **Error handling**: validasi tipe dan ukuran file, progres unggah, retry.

### 6.7 Hall of Fame
- **Deskripsi**: Apresiasi kontribusi/prestasi anggota.
- **User flow**: admin buat entri (nama, kategori, tahun, deskripsi, foto) → publikasi.
- **Edge case**: entri untuk anggota yang wafat (in memoriam).
- **Aturan**: hanya data nyata, tanpa klaim/statistik fiktif.

### 6.8 Reuni
- **Deskripsi**: Jadwal, detail, dan pendaftaran reuni.
- **User flow**: lihat acara → daftar → kelola peserta (admin) → pengingat.
- **Edge case**: kapasitas terlampaui; acara dibatalkan; pendaftaran lewat batas waktu.
- **Error handling**: konfirmasi jelas saat pendaftaran gagal.

### 6.9 Landing Page & Profil Publik
- **Deskripsi**: Etalase keluarga yang imersif.
- **User flow**: pengunjung melihat hero bercerita (scrollytelling), ringkasan keluarga, sorotan galeri, reuni mendatang, ajakan login.
- **Aturan**: tanpa statistik/testimoni palsu; angka hanya bila ada sumber nyata.

### 6.10 Out of Scope (rilis ini)
- Aplikasi mobile native (iOS/Android).
- Chat/messaging internal keluarga.
- Transfer data keuangan/internal (iuran, kas).
- Sinkronisasi otomatis ke media sosial.
- Multi-bahasa selain Indonesia.
- Penggabungan otomatis dari GEDCOM/CSV (masuk fase 2).

---

## Technical Constraints

### Performance
- Pemuatan awal landing < 2,5 detik pada 4G (LCP).
- Search silsilah < 1 detik untuk 5.000 simpul.
- Pohon dengan virtualisasi / pemuatan bertahap.
- Query relasi memakai recursive CTE yang di-cache.

### Security
- Autentikasi JWT + hashing bcrypt/argon2.
- RBAC ketat: data privat hanya lewat endpoint terautentikasi.
- Validasi input dan proteksi SQL injection/XSS.
- Rate limiting pada login dan pengajuan.
- Hak hapus/ubah data pribadi bagi pemilik akun.

### Integration
- **Penyimpanan media**: object storage (S3/Cloudinary/UploadThing).
- **Email/notifikasi**: SMTP atau layanan transaksional.
- **WhatsApp**: tautan `wa.me`.

### Technology Stack

| Lapisan | Teknologi | Alasan |
|---------|-----------|--------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript | Full-stack, SSR/ISR, API routes |
| Styling | Tailwind CSS + design tokens | Cepat, adaptasi arah budaya Jawa |
| Animasi & 3D | Framer Motion, GSAP + ScrollTrigger, React Three Fiber + Drei, Lenis | Sesuai permintaan UI interaktif |
| Visualisasi silsilah | D3.js (d3-hierarchy) atau React Flow | Layout pohon kompleks |
| Database | PostgreSQL + Prisma ORM | Recursive CTE, tipe kuat |
| Auth | Auth.js (NextAuth) atau Supabase Auth | Peran & sesi aman |
| Search | PostgreSQL full-text (mulai), Meilisearch bila perlu | Ukuran masih nyaman di Postgres |
| Media | UploadThing/S3 + Cloudinary | Optimasi gambar |
| Hosting | Vercel + Neon/Supabase Postgres | Deploy mudah untuk Next.js |

### Kompatibilitas
- Browser modern 2 tahun terakhir.
- Responsif penuh: mobile, tablet, desktop.
- Aksesibilitas: keyboard, kontras AA, `prefers-reduced-motion`.

---

## MVP Scope & Phasing

### Phase 1: MVP
1. Landing page imersif (publik).
2. Silsilah interaktif + search + filter.
3. Login, peran, dan dashboard keluarga.
4. Profil anggota (publik + privat).
5. Pengajuan & approval anggota.
6. Galeri (album + moderasi).
7. Hall of Fame (kurasi admin).
8. Reuni (jadwal + pendaftaran).

### Phase 2: Enhancements
- Import data massal (CSV/Excel/GEDCOM).
- Notifikasi WhatsApp/email otomatis.
- Peta sebaran keluarga & statistik nyata.
- Mode dwibahasa.
- Pencetakan buku silsilah / ekspor PDF.

### Future Considerations
- Aplikasi mobile.
- Fitur iuran & kas keluarga.
- Narasi audio sesepuh / arsip cerita lisan.

---

## Risk Assessment

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Data silsilah awal tidak lengkap | Tinggi | Tinggi | Peluncuran bertahap per cabang, libatkan sesepuh |
| Pohon besar lambat (1K-5K simpul) | Sedang | Tinggi | Virtualisasi render, lazy load, cache recursive CTE |
| Adopsi rendah pada anggota sepuh | Sedang | Sedang | UI sederhana, onboarding, pendampingan admin cabang |
| Konflik/duplikasi data | Sedang | Sedang | Workflow approval + deteksi duplikat |
| Kebocoran data pribadi | Rendah | Tinggi | RBAC, audit log, pemisahan publik/privat di level API |
| Animasi berat mengganggu aksesibilitas | Sedang | Sedang | `prefers-reduced-motion`, opsi matikan animasi |

---

## Dependencies & Blockers

**Dependencies**
- Data silsilah & daftar cabang dari sesepuh keluarga (owner: pihak keluarga).
- Penunjukan Super Admin & Admin Cabang per cabang (owner: pihak keluarga).
- Ketersediaan foto arsip untuk galeri dan profil.

**Known Blockers**
- Data awal belum tersedia → mulai dengan struktur kosong dan pengisian manual.
- Keputusan domain dan identitas visual final (logo) perlu dikonfirmasi keluarga.

---

*PRD ini dibuat melalui proses requirements gathering interaktif dengan skoring kualitas untuk memastikan cakupan bisnis, fungsional, UX, dan teknis yang menyeluruh.*