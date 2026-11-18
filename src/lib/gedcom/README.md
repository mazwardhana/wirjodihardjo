# GEDCOM 5.5.1 Import & Ekspor

Fitur impor dan ekspor silsilah keluarga besar Wirjodihardjo dalam format
GEDCOM 5.5.1 (LINEAGE-LINKED). Parser murni tanpa paket eksternal.

## API

| Metode | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/admin/gedcom` | Daftar batch impor GEDCOM terakhir (25). |
| POST | `/api/admin/gedcom` | Unggah `.ged`/`.gedcom` → parse + validasi + rencana + simpan batch. |
| POST | `/api/admin/gedcom/commit` | Komit batch yang sudah divalidasi (body: `{ batchId }`). |
| GET | `/api/admin/gedcom/export` | Ekspor seluruh data keluarga ke file `.ged`. |

Semua endpoint memakai autentikasi fail-closed: GET/POST impor memakai
`requireImportAdmin()` (Super Admin aktif + sudah ganti password), ekspor
memakai `auth()` + cek `isActive`.

## Alur impor

1. **Unggah** (`POST`) → `parseGedcom(buffer)` membaca baris, `validateGedcom`
   memvalidasi, `analyzeGedcom` menghitung rencana dedup, lalu batch
   `ImportBatch` dibuat dengan status `VALIDATED` dan `type="GEDCOM"`.
2. **Pratinjau**: respons POST memuat `preview` (maks 100 baris) dan `counts`.
3. **Commit** (`POST /commit`) → `commitGedcomImport` dalam transaksi
   serializable + `FOR UPDATE`. Membuat Person/PersonChild/PersonPartner dan
   menandai batch `COMMITTED`.

## Batas

- Ukuran file maks 10MB (`MAX_GEDCOM_BYTES`), maks 5000 baris, baris maks
  32767 karakter.
- Baris pertama harus `0 HEAD`, terakhir `0 TRLR`; level harus 0..99 dan
  tidak boleh melonjak > 1 per baris.
- Hanya catatan `INDI` dan `FAM` yang diambil; lainnya dilewati.
- Dedup person: `gedcomId+nama` atau `nama+tanggal lahir` (Person terarsip
  tidak menghalangi impor ulang).
- Commit tidak membuat akun User (GEDCOM tidak membawa kredensial).
- Angka duplikat P2002 (mis. relasi yang sudah ada) dilewati dan dihitung.
