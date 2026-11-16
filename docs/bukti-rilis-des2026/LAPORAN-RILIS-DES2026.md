# LAPORAN — Wirjodihardjo Opsi 1: Merge 3 branch → release/des2026 + migrasi DB dev + verifikasi

Tanggal: 16 Nov 2026 · Pengerja: Delta (kanban t_a5efbee9) · Host: orca@100.66.50.103

## 1. Ringkasan hasil

| Item | Hasil |
|---|---|
| Branch rilis | `release/des2026` @ worktree `/opt/projects/wirjodihardjo-wt-release` |
| HEAD rilis | Kode final: **a1eef17** (di atas merge 207e706 + 3732009). Di atasnya ada 1 commit docs bukti (screenshot + laporan) — lihat `git log --oneline -3` |
| Merge timeline-memori | `3732009` — 0 konflik |
| Merge kalender-keluarga | `207e706` — 0 konflik |
| Regresi merge ditemukan & diperbaiki | 1 (test AdminSidebar) → commit `a1eef17` |
| `npx tsc --noEmit` | **exit 0** (setelah `prisma generate`; sebelumnya error TS2305 karena client belum di-generate — artefak `npm ci` baru, bukan kode) |
| `npm run build` (background) | **exit 0**, 90 halaman, semua route baru terpasang |
| Suite penuh (`npx tsx --test`, 101 file test) | Run 1: 1168 test, 1119 pass / 48 fail (47 pre-existing + 1 regresi merge AdminSidebar). Setelah fix `a1eef17`, **run final: 1168 test, 1120 pass / 47 fail** — pembandingan file-per-file dengan baseline `feat/gedcom` @1e47c6f (1103 test, 1055 pass / 47 fail): **set file & jumlah gagal identik 100%**. Netto: **0 regresi baru** |
| Migrasi DB | **HANYA di DB dev `wd-dev-db`** (port 5435): 8 migration terpasang (6 tertinggal + 2 fitur baru `20261116130000_add_family_event_calendar`, `20261116140000_add_person_timeline_memories`). Tabel `FamilyEvent`, `FamilyEventRsvp`, `PersonLifeEvent`, `PersonMemory` + 4 enum terverifikasi via information_schema |
| Smoke test | `/` 200, `/silsilah` 200, `/kalender` (login) 200 + event tampil, `/admin/kalender` 200, `/admin/memori` 200 + antrean moderasi tampil, `/profil/<id>` 200 + "Jejak Hidup" + memori approved tampil, `POST /api/admin/kalender` 201, `POST /api/kalender/<id>/rsvp` 201, `GET /api/kalender` 200, `POST /api/person/<id>/memories` 201, `GET /api/admin/gedcom/export` 200 (GEDCOM 5.5.1 valid), API admin 401 tanpa sesi (RBAC jalan) |
| Screenshot bukti | 7 PNG + 3 JSON, `/opt/projects/wirjodihardjo-wt-release/docs/bukti-rilis-des2026/` (6 PNG dasar di-retake bila perlu; 04 & 05 versi final memuat data uji) |
| Backup | `/home/orca/backups/wirjo-release-merge-20261116T080449Z` — `repo.bundle` (git bundle --all, verified complete) + `working-tree.patch` + `status.txt` + `wd-dev-db.sql` (pg_dump, 28 COPY) |
| Restore one-liner | repo: `cd /opt/projects/wirjodihardjo && git fetch /home/orca/backups/wirjo-release-merge-20261116T080449Z/repo.bundle 'refs/heads/*:refs/heads/*'` · DB dev: `docker exec -i wd-dev-db psql -U wirjo -d wirjodihardjo < /home/orca/backups/wirjo-release-merge-20261116T080449Z/wd-dev-db.sql` |

## 2. Regresi merge yang ditemukan & diperbaiki

`feat/silsilah-timeline-memori` dan `feat/kalender-keluarga` masing-masing menambah 1 menu admin (Memori "♪", Kalender "◫") dan masing-masing membetulkan assertion jumlah ikon sidebar 15→16. Setelah merge keduanya ada → 17 menu, assertion tertinggal di 16 → test `no two menu entries share the same icon glyph` gagal.

Perbaikan (commit `a1eef17`, file `src/components/admin/AdminSidebar.test.ts`): assertion 16→17, komentar diperbarui, `/admin/kalender` ditambahkan ke fixture `ALL_VISIBLE`. Re-run: 5/5 pass.

## 3. Temuan penting untuk Alpha/Bos

1. **DB produksi SUDAH punya kedua migrasi fitur** (`20261116130000` applied 15 Nov 23:54 UTC, `20261116140000` applied 16 Nov 02:52 UTC) — terpasang SEBELUM kartu ini berjalan, bukan oleh saya. Tabel baru sudah ada di prod + ada data uji (4 PersonLifeEvent, 2 PersonMemory — kemungkinan sisa smoke test kartu lain). 4 tabel baru di prod sementara branch rilis belum di-deploy ke container prod (image prod dibangun 14 Nov) — kemungkinan dari worktree lain yang memakai DATABASE_URL prod. Perlu klarifikasi pemiliknya.
2. Dev DB ternyata tertinggal 6 migration (Okt 2026) — saya deploy sekalian supaya konsisten; semuanya additif dan aman.
3. Pre-existing 47 fail adalah satu pola: tes RBAC admin relasi/anggota/keluarga mengharapkan 400/409 tapi dapat 403, di 6 file test — sudah ada sebelum `feat/gedcom`, di luar scope kartu ini.
4. Smoke server dev (`next start -p 3103`) sudah dihentikan; data uji dev dihapus (0 baris tersisa); worktree baseline verifikasi dihapus. Worktree rilis & node_modules dibiarkan untuk verifikasi lanjutan.
5. Tidak ada push, tidak ada merge ke main/develop, tidak ada deploy/restart produksi, tidak ada migrasi produksi. `PROD _prisma_migrations` tetap 16 (tidak berubah sebelum/sesudah).

## 4. Sisa risiko

- 47 test RBAC pre-existing harus dibenahi terpisah (polanya konsisten: urutan pengecekan role vs validasi payload).
- Kredensial dev admin masih `admin/admin123` (sudah saya temukan via hash check) — pertimbangkan reset saat rilis.
- `node_modules` worktree rilis 2.3GB; kalau disk jadi kendala, bisa dihapus (build bisa diulang dari `npm ci`).
