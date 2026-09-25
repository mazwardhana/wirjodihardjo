# Wirjodihardjo

Website keluarga besar **Wirjodihardjo** — rumah digital untuk silsilah
interaktif, galeri kenangan, Hall of Fame, dan Reuni keluarga.

## Fitur

- **Silsilah interaktif** — pohon keluarga dengan zoom, pan, lipat cabang,
  pencarian, dan pelabelan generasi adat Jawa (Anak, Putu, Buyut, Canggah,
  hingga Trah tumerah).
- **Profil anggota** — data publik (nama, generasi, bio, foto) dan data privat
  (alamat, kontak) yang hanya tampil setelah login.
- **Upload foto profil** — foto yang diunggah tampil di halaman profil **dan**
  pada simpul silsilah.
- **Pengajuan & persetujuan** — penambahan anggota divalidasi admin cabang.
- **Galeri** — album foto dengan moderasi admin.
- **Hall of Fame** — apresiasi kontribusi anggota.
- **Reuni** — jadwal, detail, dan pendaftaran reuni keluarga.
- **Panel admin** — kelola anggota, cabang, pengguna, audit log, dan moderasi.

## Teknologi

| Lapisan | Teknologi |
|---------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 17 + Prisma 7 (driver adapter `pg`) |
| Autentikasi | NextAuth v5 (Credentials) |
| Pohon silsilah | D3-hierarchy + React Flow |
| Animasi | Scrollytelling CSS + IntersectionObserver, Framer Motion |
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

# 5. Buat akun Super Admin
npx tsx prisma/create-admin.ts

# 6. Jalankan
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

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
| `SUPER_ADMIN` | Akses penuh, kelola cabang, pengguna, audit log |
| `BRANCH_ADMIN` | Kelola data cabangnya, moderasi, setujui pengajuan cabang |
| `MEMBER` | Lihat data privat, ajukan anggota, kelola profil |

## Struktur Proyek

```
src/
├── app/            # Rute App Router (publik, dashboard, admin, API)
├── components/     # Komponen UI, silsilah, galeri, landing
├── lib/            # Prisma, auth, generasi Jawa, util
└── proxy.ts        # Penjaga rute (auth guard)
prisma/
├── schema.prisma   # 13 entitas
├── seed.ts         # Seed generasi Jawa + keluarga pendiri
└── create-admin.ts # Pembuat akun Super Admin
docs/               # PRD, arsitektur data, wireframe, rencana implementasi
```

## Lisensi

Proyek internal keluarga. Hak cipta Keluarga Besar Wirjodihardjo.