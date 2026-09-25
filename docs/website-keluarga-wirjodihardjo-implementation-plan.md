# Rencana Implementasi: Website Keluarga Wirjodihardjo

**Domain**: wirjodihardjo.teknoloka.id
**Server**: Debian 13 (IP 157.20.176.66) — Docker + Nginx reverse proxy
**Teknologi**: Next.js 15 + TypeScript + PostgreSQL + Redis
**Tanggal**: 25 September 2026

---

## 1. Arsitektur Infrastruktur (Mengikuti Pola Existing)

Server sudah punya ekosistem Docker yang matang:
- **Nginx** sebagai container `teknoloka-nginx`, konfigurasi bind-mount dari `/opt/teknoloka/nginx/conf.d/`
- **Network** `teknoloka-network` — bridge Docker yang menghubungkan semua container
- **TLS** di-terminasi oleh Cloudflare (origin di port 80)
- **Pola existing**: tiap subdomain punya `.conf` file di `/opt/teknoloka/nginx/conf.d/` + container sendiri

### 1.1 Layout di Server

```
/opt/projects/wirjodihardjo/
├── docker-compose.yml          # Definisi service wirjodihardjo-app, db, redis
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma           # Schema sesuai dokumen data-architecture
│   └── seed.ts                 # Seed: GenerationLabel, pendiri, 10 cabang
├── src/
│   ├── app/                    # App Router (Next.js 15)
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing page scrollytelling
│   │   ├── silsilah/           # Pohon interaktif
│   │   ├── profil/[slug]/      # Profil publik
│   │   ├── galeri/
│   │   ├── hall-of-fame/
│   │   ├── reuni/
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/
│   │   │   ├── profil/
│   │   │   ├── pengajuan/
│   │   │   ├── reuni/
│   │   │   └── notifikasi/
│   │   └── admin/
│   │       ├── pengajuan/
│   │       ├── anggota/
│   │       ├── cabang/
│   │       ├── galeri/
│   │       ├── hall-of-fame/
│   │       ├── reuni/
│   │       ├── pengguna/
│   │       └── audit-log/
│   ├── components/             # Shared UI components
│   │   ├── silsilah/           # D3.js / React Flow tree components
│   │   ├── galeri/             # Lightbox, masonry grid
│   │   ├── ui/                 # Button, Card, Modal, Skeleton, dll.
│   │   └── layout/             # Navbar, Footer, Sidebar
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client singleton
│   │   ├── auth.ts             # Auth.js konfigurasi
│   │   └── utils.ts
│   ├── server/                 # Server actions & API routes
│   │   ├── actions/            # Server Actions (mutasi)
│   │   └── api/                # REST endpoints (data publik)
│   └── styles/
│       └── globals.css
├── public/                     # Static assets
├── .env.local
└── Dockerfile
```

### 1.2 Docker Compose

```yaml
services:
  wirjodihardjo-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: wirjodihardjo-app
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
      - /app/.next
    ports:
      - "127.0.0.1:3100:3000"
    environment:
      DATABASE_URL: postgresql://wirjo:wirjo_secret@wirjodihardjo-db:5432/wirjodihardjo
      REDIS_URL: redis://wirjodihardjo-redis:6379
      NEXTAUTH_URL: https://wirjodihardjo.teknoloka.id
      NEXTAUTH_SECRET: (generated)
    depends_on:
      wirjodihardjo-db:
        condition: service_healthy
      wirjodihardjo-redis:
        condition: service_started
    networks:
      - teknoloka-network

  wirjodihardjo-db:
    image: postgres:17-alpine
    container_name: wirjodihardjo-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: wirjodihardjo
      POSTGRES_USER: wirjo
      POSTGRES_PASSWORD: wirjo_secret
    volumes:
      - wirjodihardjo-pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5434:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wirjo -d wirjodihardjo"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - teknoloka-network

  wirjodihardjo-redis:
    image: redis:7-alpine
    container_name: wirjodihardjo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - wirjodihardjo-redisdata:/data
    ports:
      - "127.0.0.1:6381:6379"
    networks:
      - teknoloka-network

volumes:
  wirjodihardjo-pgdata:
  wirjodihardjo-redisdata:

networks:
  teknoloka-network:
    external: true
```

Catatan:
- Port 3100 (app), 5434 (postgres), 6381 (redis) — semuanya bind ke localhost saja
- Port 3000 di container → tidak terekspos ke host, cuma lewat network Docker
- Nginx akan `proxy_pass` ke `http://wirjodihardjo-app:3000`

### 1.3 Nginx Config

File: `/opt/teknoloka/nginx/conf.d/wirjodihardjo.conf`

```nginx
map $http_x_forwarded_proto $wirjo_forwarded_proto {
    default $http_x_forwarded_proto;
    ""      https;
}

server {
    listen 80;
    server_name wirjodihardjo.teknoloka.id;

    client_max_body_size 50M;

    location / {
        proxy_pass http://wirjodihardjo-app:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $wirjo_forwarded_proto;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeout untuk long-running (unggah foto, render silsilah)
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
    }
}
```

### 1.4 Dockerfile

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### 1.5 DNS

**Domain**: `wirjodihardjo.teknoloka.id`
- DNS record: CNAME atau A record mengarah ke 157.20.176.66
- Cloudflare proxy: ON (HTTPS termination, caching)
- Saat ini DNS sudah di kelola oleh `teknoloka.cloudflared` container

---

## 2. Tahapan Implementasi

### Phase A: Foundation (Hari 1-2)
1. Buat struktur direktori & file proyek
2. Init Next.js 15 + TypeScript + Tailwind
3. Setup Prisma + PostgreSQL schema (person, person_child, person_partner, user, submission, dll — dari dokumen data-architecture)
4. Seed data: GenerationLabel (1-18), pasangan pendiri, 10 anak, 10 Branch
5. Docker Compose up & verifikasi koneksi DB
6. Buat nginx config & reload
7. Verifikasi: `https://wirjodihardjo.teknoloka.id` tampil

### Phase B: Auth & RBAC (Hari 3-4)
1. Setup Auth.js (NextAuth) dengan email + password
2. Role system: SUPER_ADMIN, BRANCH_ADMIN, MEMBER
3. Halaman login, register, lupa password
4. Middleware untuk proteksi route
5. Verifikasi akun, nonaktifkan akun
6. Buat 1 user SUPER_ADMIN manual di seed

### Phase C: Silsilah Interaktif — Backend (Hari 5-7)
1. API recursive CTE untuk subtree per cabang
2. Search dengan tsvector + pg_trgm
3. Endpoint filter: cabang, generasi, status, gender
4. Cache layer (Redis)
5. Hitung & simpan generationLevel pada approval

### Phase D: Silsilah Interaktif — Frontend (Hari 8-12)
1. Integrasi D3.js / React Flow untuk pohon
2. Kanvas zoom/pan, fit-to-screen
3. Simpul: foto, nama, label generasi Jawa, status wafat
4. Panel detail (slide-over) dengan data publik/privat
5. Search & filter UI (bisa dari mana saja)
6. Lazy load cabang (expand on click)
7. Mobile: fullscreen kanvas + bottom sheet filter

### Phase E: Approval Workflow (Hari 13-15)
1. Form pengajuan (tambah anak, tambah pasangan, perbaiki data)
2. Antrean admin (approve/reject dengan catatan)
3. Notifikasi internal
4. Transaksi: saat approve → create/update Person + relasi
5. Anti-duplikat, anti-siklus
6. Audit log

### Phase F: Profil, Dashboard, dan Konten (Hari 16-19)
1. Profil publik & edit profil (publik/privat terpisah)
2. Dashboard personal (ringkasan, pengajuan saya, reuni saya)
3. Galeri: album, unggah, moderasi, lightbox
4. Hall of Fame: admin CRUD
5. Reuni: jadwal, pendaftaran, manajemen peserta

### Phase G: Animasi & Polish Landing (Hari 20-23)
1. Landing page scrollytelling (4 babak: Pendiri → 10 Anak → Generasi → Kini)
2. GSAP + ScrollTrigger parallax
3. React Three Fiber node 3D halus di hero
4. Lenis smooth scroll
5. Transition & micro-interaction
6. Mode reduced-motion

### Phase H: Responsive, Aksesibilitas, QA (Hari 24-26)
1. Responsif mobile (semua halaman)
2. Keyboard navigasi + focus indicator
3. WCAG AA contrast
4. prefers-reduced-motion
5. Empty / loading / error states semua halaman
6. Verifikasi R-26 (setiap tombol punya behaviour)

### Phase I: Delivery Gate & Deploy (Hari 27-28)
1. Antislop Delivery Gate (checklist R-01 s.d. R-38)
2. Click-through: setiap halaman, setiap kontrol
3. Console error audit
4. Image optimization auditan
5. Deploy final ke Docker

---

## 3. Prioritas untuk Agent Build

Saat sesi pindah ke **agent build**, urutan eksekusi yang langsung bisa dimulai:

1. **Create project** → `npx create-next-app@latest` dengan TypeScript, Tailwind, App Router, src dir
2. **Install dependencies**:
   - `prisma @prisma/client` (DB)
   - `next-auth@beta` (auth)
   - `framer-motion` + `gsap` + `@gsap/react` + `lenis` (animasi)
   - `@react-three/fiber` + `@react-three/drei` + `three` (3D)
   - `react-flow` atau `@xyflow/react` (pohon) + `d3-hierarchy` (layout)
   - `uploadthing` (media)
   - `bcryptjs` + `jsonwebtoken`
   - `tailwindcss-animate` + `clsx` + `tailwind-merge` (UI helpers)
3. **Setup Prisma** → salin schema dari dokumen data-architecture
4. **Buat Dockerfile & docker-compose.yml**
5. **Buat nginx config** di `/opt/teknoloka/nginx/conf.d/wirjodihardjo.conf`
6. **Setup Auth.js** + middleware
7. **Mulai build halaman** sesuai urutan wireframe

---

## 4. Catatan Penting untuk Agent Build

- **Domain sudah pointing**: tinggal tambah nginx config + DNS record di Cloudflare dashboard
- **File yang sudah ada di `/opt/projects/wirjodihardjo/`**: saat ini direktori sudah ada tapi kosong (hanya supervisord config). Proyek build akan menimpa/isi dari awal.
- **Database**: PostgreSQL 17 di container sendiri, port 5434 ke host
- **Port**: app di 3100 (localhost), nginx reverse proxy ke container
- **Nginx template**: ikuti pola `raia.conf` yang sudah ada
- **Semua container** harus join ke `teknoloka-network` biar bisa diakses nginx
- **TLS**: Cloudflare handle, origin pakai HTTP port 80
- **Dokumen referensi** (sudah ada di `/home/orca/.opencode/plan/`):
  - `website-keluarga-wirjodihardjo-prd.md`
  - `website-keluarga-wirjodihardjo-data-architecture.md`
  - `website-keluarga-wirjodihardjo-pages-wireframe.md`

---

## 5. Estimasi

| Fase | Hari | Hasil |
|------|------|-------|
| A. Foundation | 1-2 | Proyek bisa diakses via domain |
| B. Auth & RBAC | 3-4 | Login/daftar, 3 role |
| C. Silsilah Backend | 5-7 | API silsilah, search, filter |
| D. Silsilah Frontend | 8-12 | Pohon interaktif lengkap |
| E. Approval Workflow | 13-15 | Pengajuan & validasi |
| F. Profil, Dashboard, Konten | 16-19 | Semua fitur konten |
| G. Landing & Animasi | 20-23 | UI imersif sesuai arah desain |
| H. QA & Aksesibilitas | 24-26 | Responsive, keyboard, kontras |
| I. Delivery Gate | 27-28 | Audit & deploy final |

**Total estimasi**: 28 hari kerja

---

## 6. File yang akan dibuat (checklist)

### Infrastructure
- [ ] `/opt/projects/wirjodihardjo/docker-compose.yml`
- [ ] `/opt/projects/wirjodihardjo/Dockerfile`
- [ ] `/opt/projects/wirjodihardjo/.env.local`
- [ ] `/opt/teknoloka/nginx/conf.d/wirjodihardjo.conf`
- [ ] `CNAME` or `A` record di Cloudflare untuk `wirjodihardjo.teknoloka.id`

### Application
- [ ] `package.json` + `tsconfig.json` + `next.config.ts` + `tailwind.config.ts`
- [ ] `prisma/schema.prisma` + `prisma/seed.ts`
- [ ] `src/app/layout.tsx` (global layout: navbar, footer, providers)
- [ ] `src/app/page.tsx` (landing scrollytelling)
- [ ] `src/app/silsilah/page.tsx` (pohon interaktif)
- [ ] `src/app/profil/[slug]/page.tsx`
- [ ] `src/app/galeri/page.tsx` + `src/app/galeri/[slug]/page.tsx`
- [ ] `src/app/hall-of-fame/page.tsx`
- [ ] `src/app/reuni/page.tsx` + `src/app/reuni/[slug]/page.tsx`
- [ ] `src/app/login/page.tsx` + `src/app/register/page.tsx`
- [ ] `src/app/dashboard/...(6 subpages)`
- [ ] `src/app/admin/...(8 subpages)`
- [ ] `src/lib/prisma.ts` + `src/lib/auth.ts`
- [ ] All shared components di `src/components/`
- [ ] Server actions di `src/server/actions/`
- [ ] API routes di `src/server/api/`

---

*Dokumen ini adalah panduan untuk agent build. Semua detail teknis sudah dipecah dari PRD, data-architecture, dan wireframe yang sudah divalidasi.*