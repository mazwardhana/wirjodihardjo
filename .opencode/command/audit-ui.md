---
description: Audit mutu UI halaman live (kontras, tap target, font input, gambar). Wajib sebelum klaim "selesai" untuk pekerjaan tampilan.
agent: build
---

# Audit UI

Ukur halaman dengan angka. Jangan klaim tanpa output.

Langkah:

1. Jalankan audit dari root repo:

```bash
node .opencode/scripts/audit-ui.mjs <url-halaman>
```

(Di host, chrome-headless ada di
`~/.cache/ms-playwright/chromium_headless_shell-1243/`. Bila path beda, set
`CHROME_BIN`.)

2. Tempel JSON hasilnya ke jawabanmu secara utuh, termasuk `PASS`/`FAIL`.

3. Bila `pass: false`, perbaiki **di sumber token, bukan per elemen**:
   - Pelanggaran kontras yang berulang biasanya satu kelas, bukan N tempat.
     Perbaiki pola satu kali (lihat matriks kontras di `DESIGN.md`).
   - Baca aturan warna `DESIGN.md` bagian 2 sebelum mengganti warna: banyak
     kombinasi yang terlihat oke tapi terukur gagal.

4. Ulangi audit sampai `pass: true`, tempel angka sebelum/sesudah.

5. Laporan akhir wajib bentuk ini:

```
Halaman: <path>  (viewport 360x800)
  kontras gagal       : <n>  -> <teks> <fg> on <bg> = <rasio>
  tap target < 44px   : <n>  -> <selector> <ukuran>
  font input < 16px   : <n>
  gambar tanpa ukuran : <n>
  scroll horizontal   : <ya/tidak>
  PASS                : <ya/tidak>
```

Catatan: bila halaman butuh login, audit bagian publik saja dan catat itu.
Jangan pernah menebak hasil; tidak ada angka, tidak ada klaim selesai.
