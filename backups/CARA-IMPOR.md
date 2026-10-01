# Cara Impor Backup Database Wirjodihardjo

Dokumen ini ditujukan untuk manusia dan agen AI yang perlu memulihkan atau
membangun ulang database aplikasi keluarga Wirjodihardjo.

## Ringkasan singkat

- Yang ada di folder ini hanya **skema** (`skema-wirjodihardjo.sql`), tanpa satu
  baris data pribadi.
- **Dump penuh (berisi data asli) sengaja tidak di-commit.** Dump itu berisi nama,
  tanggal lahir, alamat, nomor telepon, dan hash password bcrypt milik keluarga
  asli. Repo ini publik, jadi dump penuh disimpan di luar repo.
- Lokasi dump penuh ada di bagian "Di mana dump penuh disimpan" di bawah.

## Isi folder ini

| Berkas | Isi | Aman di-push |
| --- | --- | --- |
| `skema-wirjodihardjo.sql` | Skema saja: tabel, enum, indeks, foreign key, constraint. Tanpa data. | Ya |
| `CARA-IMPOR.md` | Dokumen ini. | Ya |
| `README.md` | Penjelasan singkat folder. | Ya |

Dump penuh (`*.dump`, `*.dump.sql`) diblokir oleh `backups/.gitignore`, jadi tidak
akan ikut ter-commit walaupun tersimpan di folder ini.

## Di mana dump penuh disimpan

Pada saat backup ini dibuat, dump penuh disimpan di luar repo:

```
/opt/projects/backups/wirjodihardjo/wirjodihardjo-20261001-075105.dump
/opt/projects/backups/wirjodihardjo/wirjodihardjo-20261001-075105.dump.sql
/opt/projects/backups/wirjodihardjo/LATEST.txt   # berisi stempel waktu backup terakhir
```

Kalau folder itu tidak ada lagi, minta pemilik server menjalankan ulang perintah
dump di bagian "Membuat dump baru". Jangan mengarang isi data.

## Metadata backup

| Field | Nilai |
| --- | --- |
| Tanggal backup | 2026-10-01 07:51:05 (waktu server) |
| Commit repo saat backup | `1eee500` |
| Versi `pg_dump` | 17.11 |
| Versi PostgreSQL server | 17.11 |
| Format dump penuh | custom (`pg_dump -Fc`), plus salinan plain SQL |
| Nama database | `wirjodihardjo` |
| Nama service Docker | `wirjodihardjo-db` |
| Port database di host | `127.0.0.1:5434` |
| Ukuran dump penuh | 120K (custom), 224K (plain) |
| Jumlah tabel | 27 |
| Jumlah migrasi Prisma | 5 |
| SHA256 dump penuh (custom) | `b04dfca49e263d9c3d763c5175d878a28586287a16916a61146409e4b3a5e535` |
| SHA256 dump penuh (plain) | `047ea05b91310167fe3784f53ddbcbac4e3efe4b392dfa57dc61a58b94d244c4` |

## Yang dibutuhkan sebelum impor

1. Docker dan Docker Compose terpasang.
2. Repo ini sudah di-clone dan `docker compose` bisa dijalankan dari root repo.
3. Dump penuh sudah ada di tangan (lihat bagian sebelumnya).
4. Tidak ada koneksi aplikasi yang sedang menulis ke database tujuan.

## Langkah impor ke database kosong

Semua perintah dijalankan dari root repo.

### 1. Nyalakan container database saja

```bash
docker compose up -d wirjodihardjo-db
```

Tunggu sampai status `healthy`:

```bash
docker compose ps wirjodihardjo-db
```

### 2. Pastikan database kosong

```bash
docker compose exec -T wirjodihardjo-db \
  psql -U wirjo -d postgres -c "DROP DATABASE IF EXISTS wirjodihardjo WITH (FORCE);"

docker compose exec -T wirjodihardjo-db \
  psql -U wirjo -d postgres -c "CREATE DATABASE wirjodihardjo;"
```

### 3. Pulihkan dump penuh

Pilih salah satu. Cara A memakai dump custom dan lebih disarankan.

Cara A, format custom:

```bash
docker compose exec -T wirjodihardjo-db \
  pg_restore -U wirjo -d wirjodihardjo --no-owner --no-privileges --clean --if-exists \
  < /opt/projects/backups/wirjodihardjo/wirjodihardjo-20261001-075105.dump
```

Cara B, format plain SQL:

```bash
docker compose exec -T wirjodihardjo-db \
  psql -U wirjo -d wirjodihardjo -v ON_ERROR_STOP=1 \
  < /opt/projects/backups/wirjodihardjo/wirjodihardjo-20261001-075105.dump.sql
```

Cara C, kalau dump penuh tidak tersedia dan hanya ingin struktur kosong:

```bash
docker compose exec -T wirjodihardjo-db \
  psql -U wirjo -d wirjodihardjo -v ON_ERROR_STOP=1 \
  < backups/skema-wirjodihardjo.sql
```

### 4. Periksa hasil impor

```bash
docker compose exec -T wirjodihardjo-db psql -U wirjo -d wirjodihardjo -c "
select 'Person' as tabel, count(*) from \"Person\"
union all select 'User', count(*) from \"User\"
union all select 'Branch', count(*) from \"Branch\"
union all select 'PersonChild', count(*) from \"PersonChild\"
union all select 'PersonPartner', count(*) from \"PersonPartner\";"
```

Kalau memakai Cara C, semua hitungan harus 0. Kalau memakai Cara A atau B,
hitungan harus sama dengan nilai pada saat backup dibuat. Tabel acuan lengkap:

| Tabel | Baris saat backup |
| --- | --- |
| `AdminNote` | 0 |
| `Album` | 0 |
| `Article` | 0 |
| `ArticleCategory` | 4 |
| `AuditLog` | 147 |
| `Branch` | 10 |
| `BranchRepresentative` | 0 |
| `Education` | 0 |
| `GalleryMedia` | 0 |
| `GenerationLabel` | 19 |
| `GovernanceAssignment` | 0 |
| `GovernancePosition` | 0 |
| `GovernanceStructure` | 0 |
| `HallOfFameEntry` | 0 |
| `ImportBatch` | 6 |
| `Notification` | 0 |
| `Person` | 87 |
| `PersonChild` | 63 |
| `PersonPartner` | 12 |
| `PersonPrivate` | 1 |
| `Reunion` | 0 |
| `ReunionRegistration` | 0 |
| `SocialLink` | 1 |
| `SocialPlatform` | 1 |
| `Submission` | 0 |
| `User` | 76 |
| `_prisma_migrations` | 5 |

`AuditLog` bertambah terus selama aplikasi dipakai, jadi angkanya boleh lebih
besar dari 147. Tabel lain harus sama persis.

### 5. Cek migrasi Prisma

```bash
docker compose exec -T wirjodihardjo-db psql -U wirjo -d wirjodihardjo -c \
  "select migration_name from \"_prisma_migrations\" order by started_at;"
```

Harus muncul 5 baris:

```
20260925043754_init
20260926134000_add_import_and_article_support
20260927134214_add_branch_number_profiles_and_governance
20260927170000_add_username_and_onboarding
20260928000000_add_person_death_place
```

Dump penuh sudah membawa tabel `_prisma_migrations` beserta barisnya, jadi tidak
perlu menjalankan `prisma migrate deploy` lagi setelah impor. Kalau ingin
memastikan, jalankan saja, Prisma akan melaporkan tidak ada migrasi tertunda.

### 6. Nyalakan aplikasi

```bash
docker compose up -d wirjodihardjo-app
```

## Catatan untuk agen AI

Bagian ini berisi petunjuk yang bisa dijalankan mesin.

### Fakta lingkungan

- Service database: `wirjodihardjo-db`, image `postgres:17-alpine`.
- Database: `wirjodihardjo`, user: `wirjo`, password: `wirjo_secret`.
- Dari host: `postgresql://wirjo:wirjo_secret@127.0.0.1:5434/wirjodihardjo`.
- Dari container lain: `postgresql://wirjo:wirjo_secret@wirjodihardjo-db:5432/wirjodihardjo`.
- Prisma 7 membutuhkan driver adapter `PrismaPg`, bukan koneksi URL langsung.
- Skrip Prisma dijalankan di host, bukan di dalam container aplikasi, karena
  container aplikasi tidak punya `tsx`.
- Enum PostgreSQL harus sudah ada sebelum data masuk. Dump penuh dan skema sama
  sama membuatnya, jadi jangan membuat enum manual.

### Daftar tabel, 27 buah

`AdminNote`, `Album`, `Article`, `ArticleCategory`, `AuditLog`, `Branch`,
`BranchRepresentative`, `Education`, `GalleryMedia`, `GenerationLabel`,
`GovernanceAssignment`, `GovernancePosition`, `GovernanceStructure`,
`HallOfFameEntry`, `ImportBatch`, `Notification`, `Person`, `PersonChild`,
`PersonPartner`, `PersonPrivate`, `Reunion`, `ReunionRegistration`, `SocialLink`,
`SocialPlatform`, `Submission`, `User`, `_prisma_migrations`.

### Daftar enum

| Nama | Nilai |
| --- | --- |
| `ArticleStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `EntryType` | `ACHIEVEMENT`, `IN_MEMORIAM` |
| `Gender` | `MALE`, `FEMALE`, `OTHER` |
| `ImportStatus` | `VALIDATED`, `COMMITTED`, `PARTIAL`, `FAILED` |
| `MediaStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `ParentRole` | `FATHER`, `MOTHER`, `UNKNOWN` |
| `PartnerStatus` | `MARRIED`, `DIVORCED`, `WIDOWED`, `UNKNOWN` |
| `RegistrationStatus` | `CONFIRMED`, `CANCELLED`, `WAITLIST` |
| `ReunionStatus` | `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED` |
| `Role` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `MEMBER` |
| `SubmissionStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `SubmissionType` | `ADD_CHILD`, `ADD_SPOUSE`, `ADD_PERSON`, `EDIT_PERSON`, `EDIT_RELATION` |

### Kalau hanya skema yang diimpor

Database kosong tapi lengkap. Untuk memakai aplikasi:

1. Buat akun SUPER_ADMIN dengan `prisma/create-admin.ts`. Skrip itu memakai
   `bcrypt` dengan 12 putaran, membuat `Person` lebih dulu lalu `User`, dan
   menyetel `mustChangeCredentials`.
2. Isi `GenerationLabel` bila diperlukan. Tabel ini berisi 19 baris di produksi.
3. `prisma/seed.ts` tidak membuat user dan berhenti lebih awal bila
   `Tn. Wirjodihardjo` sudah ada, jadi aman dijalankan di database kosong.

### Membuat dump baru

```bash
cd /opt/projects/wirjodihardjo

STAMP=$(date +%Y%m%d-%H%M%S)
OUT=/opt/projects/backups/wirjodihardjo
mkdir -p "$OUT"

docker compose exec -T wirjodihardjo-db \
  pg_dump -U wirjo -d wirjodihardjo --format=custom --no-owner --no-privileges \
  > "$OUT/wirjodihardjo-$STAMP.dump"

docker compose exec -T wirjodihardjo-db \
  pg_dump -U wirjo -d wirjodihardjo --format=plain --no-owner --no-privileges \
  > "$OUT/wirjodihardjo-$STAMP.dump.sql"

echo "$STAMP" > "$OUT/LATEST.txt"
sha256sum "$OUT/wirjodihardjo-$STAMP.dump"
```

Perbarui juga metadata di dokumen ini setiap kali dump baru dibuat.

## Pantangan

- Jangan commit atau push dump penuh ke repo publik ini.
- Jangan menempelkan isi dump penuh ke dalam percakapan, tiket, atau log.
- Jangan mengubah `backups/.gitignore` sehingga dump penuh ikut ter-commit.
