# Desain Workflow Operasional — Keluarga Besar Wirjodihardjo

Dasar: kode di `main` (c091b21 = release/des2026), skema Prisma, route API, komponen UI. Tanggal: 19 Nov 2026.

Status tiap alur dikonfirmasi dari kode nyata (route/komponen/lib) — bukan asumsi.

---

## W1. Tambah Anggota Baru (verifikasi → tampil di silsilah)

Ada **dua jalur resmi** (dua-bukan-satu, sengaja karena peran berbeda):

### W1a. Jalur anggota (MEMBER) — pengajuan

```mermaid
flowchart TD
    A[Anggota login] --> B[Beranda → /dashboard/pengajuan/baru]
    B --> C{Pilih jenis: ADD_PERSON / ADD_CHILD / ADD_SPOUSE / EDIT_PERSON / EDIT_RELATION}
    C --> D[Isi form sesuai jenis]
    D --> E[POST /api/pengajuan/create]
    E --> F[Status PENDING + notifikasi admin]
    F --> G[Admin buka /admin/pengajuan]
    G --> H{Review}
    H -->|Setujui| I[POST /api/pengajuan/review: terapkan payload ke DB + status APPROVED]
    H -->|Tolak| J[Tulis reviewNote + status REJECTED]
    I --> K[Person baru muncul di /silsilah & /profil]
    J --> L[Anggota lihat alasan di /dashboard/pengajuan/[id]]
```

- Pelaku: anggota (MEMBER/BRANCH_ADMIN/SUPER_ADMIN) → admin (BRANCH_ADMIN untuk cabangnya; SUPER_ADMIN untuk semua).
- Halaman: `/dashboard/pengajuan/baru` → `/admin/pengajuan` → status di `/dashboard/pengajuan/[id]`.
- Skema: `Submission{type, payload Json, status PENDING→APPROVED/REJECTED/CANCELLED, reviewNote, reviewedAt, appliedPersonId, reviewer}`.
- Aturan kode: submit harus `PENDING`; approve di luar cabang ditolak 403; duplikat → 409.
- End: person baru (dengan `appliedPersonId`) langsung tampil di `/silsilah` (silsilah query DB) dan profil publik.

### W1b. Jalur admin langsung (tanpa antrean)

```mermaid
flowchart TD
    A[Admin login] --> B[AdminSidebar → /admin/keluarga]
    B --> C[Pilih cabang (SUPER_ADMIN) / otomatis (BRANCH_ADMIN)]
    C --> D[KeluargaDashboard → Tambah Anggota / AnggotaCreateModal]
    D --> E[POST /api/admin/keluarga/members]
    E --> F[Person terbentuk + audit log PERSON_CREATE]
    F --> G[Muncul di /silsilah]
```

- Halaman: `/admin/keluarga` (dashboard), modal `AnggotaCreateModal`; deep-link `/admin/anggota/tambah?branchId=...` tetap ada.
- Catatan audit: halaman `/admin/anggota/tambah` (full page) = duplikat modal (lihat audit B).

---

## W2. Event Kalender: buat → undang → RSVP → rekap

```mermaid
flowchart TD
    A[Admin buka /admin/kalender] --> B[Form event: title, tipe MILAD/HAUL/REUNI/HALAL_BIHALAL/LAINNYA, startsAt/endsAt, lokasi, repeatYearly, isPublished]
    B --> C[POST /api/admin/kalender]
    C --> D[Event tersimpan, isPublished=false default]
    D --> E{Publikasikan?}
    E -->|Ya| F[PUT /api/admin/kalender/[id] isPublished=true]
    E -->|Belum| G[Event hanya tampil di panel admin]
    F --> H[Anggota lihat /kalender (grid + agenda)]
    H --> I[Anggota RSVP: POST /api/kalender/[id]/rsvp status GOING/MAYBE/NOT_GOING]
    I --> J[Admin lihat jumlah RSVP per event di /admin/kalender]
```

- Pelaku: admin (buat/publish) → anggota login (RSVP; wajib login, event harus published — 401/403).
- Halaman: `/admin/kalender` ↔ `/kalender`.
- Rekap saat ini: hanya `_count.rsvps` per event (jumlah total, bukan rincian per status).
- **Gap (rekomendasi):** rekap rincian per status (GOING/MAYBE/NOT_GOING) + daftar nama + unduh daftar hadir untuk panitia reuni. Tambah tampilan "Hadir" di detail event admin.
- Hapus event → RSVP ikut terhapus (onDelete Cascade).

---

## W3. Moderasi Memori (submit → approve/reject → tampil)

```mermaid
flowchart TD
    A[Anggota/keluarga buka /profil/[id]] --> B[MemorySection → Tambah memori: kind STORY/AUDIO/DOCUMENT/IMAGE + title/content/file]
    B --> C[Status PENDING]
    C --> D[Admin buka /admin/memori]
    D --> E{Moderasi}
    E -->|Setujui| F[PUT /api/admin/memories action=APPROVE → status APPROVED]
    E -->|Tolak| G[action=REJECT + rejectionReason → status REJECTED]
    F --> H[Memori tampil di /profil/[id] untuk semua]
    G --> I[Memori disembunyikan (retensi REJECTED 30 hari di daftar admin)]
```

- Pelaku: siapa pun login (submit) → admin (moderasi, scope cabang: BRANCH_ADMIN hanya cabangnya 403 di luar).
- Halaman: `/profil/[id]` → `/admin/memori`.
- Skema: `PersonMemory{kind, status MediaStatus PENDING→APPROVED/REJECTED, moderatedBy, moderatedAt, rejectionReason}`.

---

## W4. Import GEDCOM (preview → commit → rollback kalau salah)

**Status nyata: engine lengkap (parser/validasi/analisis/preview/commit/export + tes), TAPI belum ada UI.** API: `/api/admin/gedcom` (upload+validasi), `/api/admin/gedcom/commit`, `/api/admin/gedcom/export`. Halaman `/admin/impor` hanya menerima XLSX/CSV.

```mermaid
flowchart TD
    A[Super Admin buka /admin/impor] --> B[Pilih tab GEDCOM (REKOMENDASI UI BARU)]
    B --> C[Upload file .ged/.gedcom]
    C --> D[POST /api/admin/gedcom → validasi + preview (rename, duplikat, missing parent)]
    D --> E[Preview: tabel Person + Family + analisis]
    E --> F{Periksa}
    F -->|Salah| G[Batalkan batch — hapus/ulangi upload]
    F -->|Benar| H[POST /api/admin/gedcom/commit → transaksi, status COMMITTED]
    H --> I[Verifikasi di /silsilah]
    I --> J{Salah?}
    J -->|Ya| K[REKOMENDASI: rollback → batch commit id disimpan di ImportBatch; tambah endpoint restore/snapshot]
    J -->|Tidak| L[Selesai]
```

- Pelaku: hanya SUPER_ADMIN (`requireImportAdmin`).
- **Gap (rekomendasi):**
  1. UI tab GEDCOM di `/admin/impor` (upload, preview table, tombol Commit, tombol Export).
  2. **Rollback**: belum ada endpoint undo. Usulan: sebelum commit, simpan `reportJson` = snapshot (id person/keluarga yang akan dibuat); tambah `POST /api/admin/gedcom/rollback {batchId}` yang menghapus baris hasil commit (dalam transaksi) atau restore state. Alternatif: bilang ke admin "backup manual via export GEDCOM sebelum commit".
  3. Export GEDCOM: `/api/admin/gedcom/export` ada tapi tanpa tombol UI — pasang di halaman impor/laporan.

---

## W5. Export Data untuk Arsip

| Format | Jalur saat ini | Status UI | Rekomendasi |
|---|---|---|---|
| PDF laporan silsilah | `FamilyPdfDownload` di `/silsilah` → GET `/api/export/family-report` → render PDF client | ✅ Ada tombol "Unduh laporan PDF" | PERTAHANKAN |
| CSV anggota | GET `/api/export/csv` (wajib login 401) | ❌ Tidak ada tombol/pemanggil UI manapun | Tambah tombol Unduh CSV (mis. di `/admin/keluarga` atau `/admin/pengguna`) |
| GEDCOM | GET `/api/admin/gedcom/export` | ❌ Tidak ada UI | Pasang di `/admin/impor` (tab GEDCOM) |

---

## Prioritas implementasi (diusulkan untuk Alpha → task card)

1. **P0** — UI GEDCOM (import preview/commit/export + rollback) di `/admin/impor`.
2. **P1** — Tombol export CSV di halaman admin yang memuat data anggota.
3. **P1** — Rekap RSVP per status di `/admin/kalender`.
4. **P2** — Konsolidasi jalur Tambah (modal vs halaman).
5. **P2** — Hapus route legacy `/admin/cabang/*` + dead code (lihat analisa fitur C1).
