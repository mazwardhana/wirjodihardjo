# ADR-010: Strategi Upload Media — Local vs Uploadthing

**Tanggal:** 28 Oktober 2026  
**Status:** Dipertimbangkan  
**Pembuat:** Beta (audit O6)  
**Branch:** `fix/opsional-o1-o8-s11`  

---

## Konteks

Aplikasi menyimpan foto profil dan media gallery di storage lokal (`/app/uploads` dalam
container, di-mount ke `./uploads` di host). File disajikan lewat `/api/media/[nama]`.

File konfigurasi sudah menyiapkan variabel lingkungan Uploadthing:

```
UPLOADTHING_SECRET=      # KOSONG di .env
UPLOADTHING_APP_ID=      # KOSONG di .env
```

Namun implementasi Uploadthing SDK tidak pernah diintegrasikan — kode hanya
memakai `src/lib/upload.ts` yang menggunakan storage lokal.

---

## Opsi

### Opsi A: Pertahankan storage lokal (selected)

**Keuntungan:**
- Tidak ada biaya S3 / Uploadthing
- Tidak ada dependensi pihak ketiga saat runtime
- Sederhana: satu direktori, satu route handler
- Sudah berjalan di produksi dengan data nyata

**Kerugian:**
- Tidak scale secara horizontal (multi-instance): volume Docker lokal hanya
  tersedia di satu container. Jika container di-scaling, file upload di instance
  lain tidak能找到 file yang diunggah.
- Cadangan (backup) harus menyertakan `./uploads/` secara terpisah dari DB.
- Tidak ada transformasi/optimasi gambar otomatis.

### Opsi B: Migrasi ke Uploadthing / S3

**Keuntungan:**
- Scale horizontal: semua instance baca dari object storage yang sama.
- CDN integration (Uploadthing punya built-in).
- Backup otomatis dari pihak provider.

**Kerugian:**
- Biaya langganan ($0 per 3 GB + $0.004/GB di Uploadthing).
- Perlu set-up billing account, ambil API key, update semua
  komponen upload (`PhotoUploader`, `GalleryUpload`, dll.).
- Effort implementasi tidak trivial.

---

## Keputusan

**Opsi A — Pertahankan storage lokal.** Volume `./uploads` di-host di-bind mount
ke `/app/uploads` dalam container (lihat `docker-compose.yml`). Ini cukup untuk
setup single-instance saat ini dan tidak memerlukan perubahan kode.

---

## Kapan Harus Migrasi

Migrasi ke Uploadthing/S3 diperlukan jika:

1. **Scaling multi-instance** — lebih dari satu container `wirjodihardjo-app`
   menjalankan aplikasi secara bersamaan (load balancer).
2. **Backup otomatis media** — saat ini file `./uploads` harus dicadangkan
   terpisah dari database. Migrasi ke cloud storage menyertakan redundancy
   bawaan.
3. **CDN / transformasi gambar** — Uploadthing/Cloudinary otomatis menghasilkan
   thumbnail, WebP conversion, dll.

---

## Perintah Migrasi (saat perlu)

```bash
# 1. Buat akun Uploadthing, ambil secret + app ID dari dashboard.uploadthing.com
# 2. Set variabel lingkungan
export UPLOADTHING_SECRET="sk_live_..."
export UPLOADTHING_APP_ID="..."

# 3. Install SDK (opsional, jika mau dipakai)
npm install uploadthing

# 4. Jalankan script konversi untuk memindahkan file lokal ke S3
# 5. Update PhotoUploader + GalleryUpload komponen
# 6. Hapus volume bind ./uploads dari docker-compose.yml
```

---

## Audit Trail

| Tanggal | Aksi |
|---------|------|
| 28 Okt 2026 | ADR dibuat, status \"dipertimbangkan\" (storage lokal masih cukup) |
