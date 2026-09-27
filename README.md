# Wirjodihardjo

Website keluarga besar **Wirjodihardjo** — rumah digital untuk silsilah
interaktif, galeri kenangan, Hall of Fame, dan Reuni keluarga.

**Live:** https://wirjodihardjo.teknoloka.id

## Fitur

### Inti
- **Silsilah interaktif** — pohon keluarga dengan zoom, pan, lipat cabang,
  pencarian, dan pelabelan generasi adat Jawa (Anak, Putu, Buyut, Canggah,
  hingga Trah tumerah).
- **Profil anggota** — data publik (nama, generasi, bio, foto) dan data privat
  (alamat, kontak) yang hanya tampil setelah login.
- **Profil lengkap** — pendidikan, pekerjaan, status, dan tautan sosial
  (Instagram, WhatsApp, dll) dengan editor berbasis modal.
- **Pengajuan & persetujuan** — penambahan anggota divalidasi admin cabang.
- **Galeri** — album foto dengan moderasi admin.
- **Hall of Fame** — apresiasi kontribusi anggota.
- **Reuni** — jadwal, detail, dan pendaftaran reuni keluarga.

### Autentikasi & Akun (baru)
- **Login username atau email** — username wajib, email opsional.
- **Onboarding paksa** — akun baru (atau hasil import) wajib ganti
  username & sandi di halaman `/onboarding` sebelum masuk dashboard.
- **Bulk user import** — admin mengunggah CSV (`username,password,nama_lengkap,email`),
  seluruh user dibuat dengan sandi sementara dan wajib onboarding.

### Kepengurusan (baru)
- **Struktur organisasi** — posisi bertingkat, kapasitas fleksibel,
  penugasan personel dengan validasi atomic.
- **Perwakilan cabang** — 2 slot per cabang (Ketua/Sekretaris cabang)
  dengan catatan slot kosong (mis. almarhum Suwito, Cabang 2).
- **Halaman publik `/pengurus`** — tree desktop + accordion mobile,
  data hanya dari struktur aktif, empty state jujur bila belum ada data.

### Galeri & Media (baru)
- **Upload oleh anggota** — semua member login dapat upload,
  status awal `PENDING`, notifikasi ke admin.
- **Moderasi ter-scoping** — `BRANCH_ADMIN` hanya memoderasi media
  yang diunggah oleh anggota cabangnya; `SUPER_ADMIN` bebas semua.
- **Media serving aman** — file `PENDING`/`REJECTED` hanya dapat diakses
  uploader, admin cabang sesuai scope, atau super admin. Media publik
  wajib `APPROVED` + album published.

### Keamanan (baru)
- **RBAC fail-closed** — helper `getActorScope` / `requireAdminScope` /
  `assertBranchAccess`. `BRANCH_ADMIN` tanpa penugasan = tanpa akses
  (bukan wildcard).
- **Semua endpoint admin ter-scoping** — anggota, relasi, Hall of Fame,
  cari orang, galeri, governance.
- **Enforcement server-side** — layout `/dashboard/*` memaksa redirect ke
  `/onboarding` bila `mustChangeCredentials=true` (bukan cuma client-side).

### PWA (baru)
- **Manifest + icon** — installable, heritage palette.
- **Service worker** — cache-first aset statis, network-first HTML/API,
  **tidak pernah** cache `/admin`, `/api/admin`, `/api/auth`, response
  `Cache-Control: private`, atau navigasi `/dashboard`.
- **Install prompt** — muncul 2 detik, dismiss 7 hari di localStorage,
  instruksi manual untuk iOS Safari.

### Lainnya
- **Landing page** — 10 kartu cabang dengan scroll-reveal stagger,
  hover lift, keyboard focus.
- **Panel admin** — kelola anggota, cabang, pengguna, audit log, artikel,
  galeri, governance, import, dan moderasi.

## Changelog

### 2026-09-27 — Revamp Keluarga Platform

Merge: `9b08574..58bd6cb` (184 files, +20.752 / −1.858)

| Komit | Perubahan |
|-------|-----------|
| `1510a3c` | Skema username + flag onboarding (reset data dummy: user/person) |
| `27ad76e` | Adaptasi 7 file ke skema username/email nullable |
| `88f6fd1` | Halaman publik `/pengurus` (desktop tree + mobile accordion) |
| `1feb5d4` | PWA manifest, service worker, install prompt |
| `64f9be1` | Moderasi galeri di-scope ke cabang admin |
| `dba06e3` | Login fleksibel username/email + endpoint onboarding |
| `9c46aab` | Halaman UI `/onboarding` (form ganti kredensial) |
| `7ef1ae2` | Bulk user import CSV (parser/validator/importer transaksional) |
| `4bc1bed` | Perbaikan review keamanan: guard onboarding, SW cache, validasi case-insensitive |
| `db8538d` | Guard onboarding via `dashboard/layout` untuk seluruh subroute |
| `76abe37` | Batas ukuran JSON 10MB untuk bulk import |
| `69c858f` | Detail & daftar album di-scope per cabang (metadata) |

**Fase sebelumnya (Phase 1–6):**

| Komit | Perubahan |
|-------|-----------|
| `2c2e7bb` | Skema: nomor cabang permanen 1–10, profil (occupation/status/pendidikan), model governance |
| `2622906` | Helper RBAC fail-closed (`src/lib/rbac.ts`) |
| `700382e` | Aturan assignment admin cabang + scoping endpoint admin |
| `b9702dc` | Import disederhanakan: 1 sheet CSV mentah 8 kolom |
| `5e1789c` | Hardening validasi import (branch, parser tanggal, tabrakan ref) |
| `d654de9` | Perbaikan keamanan hapus relasi |
| `690939e` | API CRUD education & social profile |
| `ae47213` | Tampilan profil + modal editor (allowlist projection) |
| `9a66fb5` | CRUD governance (structure/position/assignment, kapasitas atomic) |
| `ddc8f0a` | Upload galeri member (status PENDING + notifikasi admin) |
| `77486d2` | Media serving cek status moderasi + publikasi album |
| `7bc48e7` | Kartu cabang animasi di landing page |
| `0159d18` | Fix scope GET governance, rollback upload, lint |

## Teknologi

| Lapisan | Teknologi |
|---------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 17 + Prisma 7 (driver adapter `pg`) |
| Autentikasi | NextAuth v5 (Credentials, username/email) |
| Pohon silsilah | D3-hierarchy + React Flow |
| Animasi | IntersectionObserver, Framer Motion |
| PWA | Service worker native (Cache API) |
| Deployment | Docker Compose + Nginx reverse proxy |

## Menjalankan Secara Lokal

```bash
# 1. Pasang dependensi
npm install

# 2. Siapkan environment
cp .env.example .env.local
# sesuaikan DATABASE_URL dan NEXTAUTH_SECRET

# 3. Jalankan database
docker compose up -d wirjodihardjo-db wirjodihardjo-redis

# 4. Migrasi & seed data awal
npx prisma migrate dev
npx prisma db seed

# 5. Buat akun Super Admin (wajib isi username)
npx tsx prisma/create-admin.ts

# 6. Jalankan
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

> **Catatan migrasi 2026-09-27:** migrasi username menghapus seluruh data
> User/Person (dikonfirmasi data dummy, dibuat ulang). Jalankan
> `npx prisma migrate deploy` di production lalu buat ulang admin.

## Deployment (Docker)

```bash
# Build & jalankan seluruh layanan
docker compose up -d --build

# Aplikasi berjalan di 127.0.0.1:3100, dilayani Nginx sebagai reverse proxy
```

Konfigurasi Nginx contoh tersedia pada `docs/` atau ikuti pola pada server:
`/opt/teknoloka/nginx/conf.d/wirjodihardjo.conf`.

## Peran Pengguna

| Peran | Hak Akses |
|-------|-----------|
| `SUPER_ADMIN` | Akses penuh, kelola cabang, pengguna, governance, audit log |
| `BRANCH_ADMIN` | Hanya cabang yang ditugaskan (artikel & fitur global dikecualikan). Tanpa penugasan = tanpa akses |
| `MEMBER` | Lihat data privat, ajukan anggota, kelola profil, upload galeri |

## Struktur Proyek

```
src/
├── app/
│   ├── (publik)      # /, /silsilah, /profil, /galeri, /pengurus, /tentang
│   ├── dashboard/    # area member (ada layout guard onboarding)
│   ├── admin/        # panel admin (ter-scoping per cabang)
│   ├── login/        # login username/email
│   ├── onboarding/   # paksa ganti kredensial
│   └── api/          # endpoint REST
├── components/       # UI, silsilah, galeri, governance, pwa, landing
├── lib/              # auth, rbac, import, user-import, generators
└── proxy.ts          # guard rute (cek cookie sesi)
prisma/
├── schema.prisma     # model & relasi
├── migrations/       # migrasi additive
├── seed.ts           # seed cabang + keluarga pendiri
└── create-admin.ts   # pembuat akun Super Admin
public/
├── manifest.json     # PWA manifest
├── sw.js             # service worker
└── icon-*.png        # icon PWA (placeholder)
docs/                 # PRD, arsitektur, wireframe, rencana implementasi
```

## Pengujian

```bash
# Fokus (jalankan per file, tidak ada agregator otomatis)
npx tsx --test src/lib/rbac.test.ts
npx tsx --test src/app/api/auth/onboarding/route.test.ts \
              src/app/api/profil/username/route.test.ts \
              src/app/onboarding/page.test.ts
npx tsx --test src/lib/user-import/*.test.ts \
              src/app/api/admin/pengguna/import-bulk/route.test.ts
npx tsx --test src/app/api/media/\[...path\]/route.test.ts \
              src/app/api/admin/media/route.test.ts \
              src/app/api/admin/galeri/route.test.ts \
              src/app/admin/galeri/\[slug\]/page.test.ts

# Typecheck & build
npx tsc --noEmit
npm run build
```

Status verifikasi terakhir (2026-09-27): `tsc` 0 error, `build` sukses,
seluruh suite terarah lulus (auth 23, bulk import 69, gallery 38, governance 65).

## Lisensi

Proyek internal keluarga. Hak cipta Keluarga Besar Wirjodihardjo.
