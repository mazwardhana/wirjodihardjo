# 05 — Evaluasi CMS: Pindah atau Tidak?

Kartu 2/4 dari riset tampilan silsilah Wirjodihardjo. Pertanyaan Bos: *"pakai CMS apa
supaya tampilan mobile lebih baik?"*

## 1. Jawaban singkat

**Tidak pindah CMS. Tetap Next.js 16 + Prisma 7 + admin sendiri.**

Alasannya satu kalimat: **nol dari empat opsi CMS memperbaiki tampilan mobile**, karena
tampilan mobile rusak di lapisan render (`FamilyTreeCanvas.tsx` 133 baris +
`treeLayout.ts` 706 baris), sedangkan CMS hanya mengurus cara data disimpan dan
diedit. Dua opsi yang benar-benar "siap pakai untuk silsilah" (webtrees, Gramps Web)
memperbaiki tampilan dengan cara **mengganti seluruh aplikasi**, bukan dengan cara
memperbaiki yang ada.

## 2. Diagnosis: kenapa CMS bukan obatnya

Temuan terverifikasi dari repo HEAD `7a36c68`:

| Gejala mobile | Sebab nyata | Bisa diperbaiki CMS? |
|---|---|---|
| Teks terlalu kecil saat seluruh pohon tampil | `NODE_W = 260`, `NODE_H = 130`, `COUPLE_SPACING = 300` dipaksa masuk viewport 375 px oleh `fitView` dengan `minZoom={0.1}` | **Tidak.** Ini ukuran kartu dan strategi zoom di komponen React |
| Navigasi hanya pinch-zoom | Tidak ada tampilan bertingkat/outline; `MiniMap` sudah `!hidden` di bawah `sm` | **Tidak.** Butuh tampilan baru, bukan sumber data baru |
| Melipat cabang sulit di HP | Hanya terpetakan ke klik ganda (`onNodeDoubleClick`), tanpa padanan keyboard | **Tidak.** Butuh penanganan event dan ARIA di `PersonNode` |
| Semua 250–300 orang dirender sekaligus | `onlyRenderVisibleElements` tidak dipakai | **Tidak.** Prop React Flow, bukan skema basis data |
| Data berat / lambat | `getFamilyTree()` mengirim `persons` + `childEdges` + `partnerEdges` sekaligus; `src/app/api/family/graph/route.ts` (111 baris) memakai query per simpul | **Sebagian.** Bisa diperbaiki di endpoint yang ada, tanpa CMS |

Kesimpulan: masalahnya ada di lapisan presentasi. Mengganti CMS berarti menulis ulang
lapisan presentasi juga — hanya saja kini di atas tumpukan teknologi yang belum
dikuasai tim.

## 3. Perbandingan empat opsi

Kolom pertama adalah jawaban langsung atas pertanyaan Bos.

| # | Opsi | Benar-benar memperbaiki UX mobile? | Biaya migrasi data dari Prisma | Fitur yang hilang | Lisensi + maintenance | Dukungan bahasa Indonesia | Risiko |
|---|---|---|---|---|---|---|---|
| a | **Tetap Next + Prisma + admin sendiri** | **Ya — kalau lapisan render diperbaiki.** Rendering tetap harus ditulis ulang/dioptimalkan (lihat kartu `02`): outline bertingkat untuk mobile + culling + kartu lebih kecil. CMS tidak menyentuh masalah ini, tapi juga tidak menambah masalah | **Nol.** Tidak ada migrasi. Schema Prisma 30+ model tetap | **Nihil.** Auth anggota (next-auth 5), dashboard admin, reuni + registrasi reuni + QR buku tamu, privasi kontak (`PersonPrivate.visibleToMembers`), unggah foto/media, pengajuan (Submission), audit log, impor CSV/Excel — semua tetap | Stack sendiri tim; Next 16.3.6, React 19.2.8, Prisma 7.10.0 sudah berjalan di produksi | Native. Seluruh UI sudah berbahasa Indonesia | **Rendah.** Tidak ada migrasi; risiko terbatas pada scope pekerjaan render |
| b | **Headless CMS (Payload / Directus / Strapi)** | **Tidak.** Headless CMS hanya mengganti lapisan data + panel admin. Tampilan pohon tetap harus ditulis ulang dari nol — lapisan render tetap harus ditulis ulang, eksplisit | **Tinggi.** 30+ model Prisma harus dipetakan ke collections. Tidak ada semantik genealogis: `parentRole` (FATHER/MOTHER/UNKNOWN), `isStep`, `isAdopted`, `PartnerStatus` (MARRIED/DIVORCED/WIDOWED), `orderIndex`, `generationLevel`, `isMarriedInto` tidak punya padanan alami; harus jadi custom fields + hook validasi | Reuni/QR, dashboard admin, audit log, alur pengajuan, privasi kontak bertingkat, impor Excel — semuanya dibangun ulang sebagai plugin/hook. Tambahan: satu lagi sistem yang harus diamankan, di-backup, dan di-upgrade | Payload: MIT, 45.6k bintang, 1451 issue terbuka [24]. Directus: **MSCL-1.0-GPL**, lisensi kustom — bukan GPL biasa, penggunaan komersial "core" punya ketentuan sendiri [22]. Strapi: MIT Expat untuk non-`ee/`, **Enterprise Edition berlinsensi terpisah** [23] | Payload/Directus/Strapi punya i18n admin, tapi konten dan UI publik tetap tanggungan kita | **Sedang–tinggi.** Dua sistem, dua model keamanan, dua siklus upgrade; tambahan kompleksitas operasional tanpa keuntungan mobile |
| c | **CMS silsilah: webtrees** | **Ya untuk tampilan, tidak untuk aplikasi.** webtrees punya tampilan silsilah yang responsif dan matang (GEDCOM asli, multi-bahasa) [16], tetapi memakainya berarti meninggalkan aplikasi kita — halaman `/silsilah` jadi aplikasi PHP terpisah, bukan komponen di dalam Next | **Tinggi.** Perlu ekspor GEDCOM dari Prisma. GEDCOM kehilangan: `generationLevel`, `branch`/`branchId`, `registrationBatchId`, `PersonStatus`, `Reunion`, `Submission`, `AuditLog`, `Education`, `SocialLink`. Pemetaan harus ditulis manual dan diperiksa satu per satu | Auth anggota (next-auth 5) → sistem user webtrees; dashboard admin; reuni + QR check-in (harus jadi modul PHP webtrees [8]); unggah foto → media manager webtrees; privasi kontak → aturan privasi webtrees (untuk orang hidup) | **GPL-3.0**, PHP, 835 bintang, **396 issue terbuka** [17]. Maintenance: upgrade PHP + modul + tema | webtrees punya terjemahan komunitas [16]; komponen bahasa Indonesia harus diverifikasi | **Tinggi.** Runtime PHP di lingkungan Node; seluruh alur anggota (registrasi, pengajuan, reuni) harus dibangun ulang sebagai modul PHP |
| d | **CMS silsilah: Gramps Web** | **Ya untuk tampilan.** Chart ancestor/descendant/hourglass/relationship/**fan** [6], perluas satu generasi per cabang [6], dan batas jumlah gambar "untuk performa" [6] — pola yang tepat untuk mobile. Tapi lagi-lagi: ini pengganti aplikasi, bukan komponen | **Tinggi.** Impor GEDCOM atau Gramps XML [7]; kehilangan field kustom Prisma yang sama seperti opsi (c), plus relasi `isStep`/`isAdopted` perlu dipetakan ke model GEDCOM | Auth anggota, dashboard admin, reuni + QR, pengajuan, audit log, impor Excel — semua hilang. Editing kanvas langsung ("build your tree right in the chart") [7] justru jadi fitur yang harus dikorbankan bila tidak pindah | **AGPL-3.0** untuk frontend (JavaScript, 1786 bintang) [18] **dan** backend API (Python, 229 bintang) [14]. AGPL berarti kewajiban penawaran source kepada pengguna layanan — perlu persetujuan Bos sebelum dijalankan sebagai layanan | **"over 50 languages"** [7]; keberadaan bahasa Indonesia harus diverifikasi di daftar locale | **Tinggi.** Stack baru (Python + JS), dua repo, dan AGPL mengubah kewajiban hukum |
| e | **WordPress + plugin silsilah** | **Belum terverifikasi.** Tidak masuk anggaran riset kartu ini; ditulis jujur sebagai belum terverifikasi | **Belum terverifikasi.** Plugin silsilah WP umumnya memakai skema sendiri dan mengimpor GEDCOM; biaya migrasi kira-kira setara opsi (c)/(d) | Sama seperti (c)/(d), plus kehilangan seluruh stack Next yang sudah berjalan | **Belum terverifikasi** (plugin komersial/gratis bervariasi) | **Belum terverifikasi** | **Tinggi** (taksiran, bukan temuan) |

## 4. Rekomendasi

**Tetap Next.js + Prisma + admin sendiri (opsi a). Tidak pindah ke CMS apa pun.**

Alasan, berurutan dari yang paling menentukan:

1. **Tidak ada CMS yang memperbaiki mobile tanpa mengganti aplikasi.** Opsi (b)
   memperbaiki lapisan admin saja. Opsi (c) dan (d) memperbaiki tampilan dengan
   membuang aplikasi kita — termasuk reuni, QR, auth anggota, dan privasi kontak yang
   sudah berjalan.
2. **Biaya migrasi data nyata dan mahal.** Ekspor GEDCOM dari 30+ model Prisma
   kehilangan `generationLevel`, `branch`, `PersonStatus`, `Reunion`, `Submission`,
   `AuditLog`, `Education`, `SocialLink`. Itu bukan dump-and-restore; itu proyek
   pemetaan data tersendiri.
3. **Lisensi mengubah kewajiban, bukan hanya biaya.** Gramps Web ber-AGPL-3.0 di
   frontend dan backend [18][14]; webtrees GPL-3.0 [17]; Directus memakai lisensi
   kustom MSCL-1.0-GPL [22]; Strapi memisahkan fitur EE dengan lisensi terpisah [23].
   Keputusan ini milik Bos, bukan keputusan teknis yang bisa diambil di kartu ini.
4. **Yang sebenarnya diperbaiki mobile murah.** Optimasi render di kartu `02`
   (culling, kartu lebih kecil, tampilan outline untuk mobile, keyboard) biayanya
   **2–4 hari + 2–3 minggu**, bukan 2–4 bulan migrasi.

### Apa yang harus dikorbankan kalau tetap di opsi (a)

Jujur, ini harga yang dibayar:

- **Tidak ada editing pohon langsung di kanvas.** Fitur "build your tree right in the
  chart" milik Gramps Web [7] tidak akan ada; penambahan anggota tetap lewat form
  pengajuan/admin yang sudah ada.
- **Tidak ada chart fan/hourglass bawaan.** Gramps Web menyediakan lima tipe chart
  termasuk fan chart [6]; kita hanya punya satu tampilan node-link. Tampilan fan per
  generasi bisa dibangun sendiri (opsi (e) kartu `02`, pakai `d3-hierarchy` yang sudah
  terpasang), tapi itu pekerjaan tambahan.
- **Tidak ada interoperabilitas GEDCOM siap pakai.** Pertukaran data dengan
  aplikasi genealogi lain perlu eksporter GEDCOM sendiri (±1 minggu); belum ada.
- **Tidak ada UI multi-bahasa 50+ bahasa** seperti Gramps Web [7]. Cukup satu bahasa
  (Indonesia) — dan itu memang kebutuhan kita.
- **Tanpa chat AI atas data silsilah** seperti fitur Gramps Web [7]. Bukan kebutuhan.

## 5. Yang harus dilakukan, urut

1. **Perbaiki lapisan render** sesuai kartu `02` — inilah yang menjawab keluhan
   mobile. 2–4 hari untuk optimasi React Flow, 2–3 minggu untuk tampilan outline.
2. **Kurangi payload `getFamilyTree()`** (kirim hanya yang terlihat, atau paginasi per
   generasi) dan hapus `src/app/api/family/graph/route.ts` yang memakai query per
   simpul — dua implementasi layout adalah utang teknis.
3. **Tambahkan eksporter GEDCOM** bila pertukaran data dengan keluarga lain memang
   dibutuhkan (±1 minggu, opsional).
4. **Jangan tambahkan CMS.** Bila suatu saat dashboard admin terasa berat, evaluasi
   ulang dengan pertanyaan "apa yang tidak bisa dilakukan admin hari ini" — bukan
   "CMS apa yang lebih modern".

## 6. Yang belum terverifikasi

- **WordPress + plugin silsilah (opsi e):** tidak diriset sesuai batas anggaran kartu
  ini. Ditulis sebagai belum terverifikasi, bukan sebagai penilaian.
- **Komponen bahasa Indonesia di webtrees dan Gramps Web:** webtrees punya sistem
  terjemahan [16] dan Gramps Web menyebut "over 50 languages" [7], tetapi keberadaan
  locale `id` yang lengkap tidak diverifikasi langsung.
- **Responsivitas tema bawaan webtrees:** halaman "Modules and themes" ditemukan [8],
  tetapi kualitas mobile tema default tidak diuji.
- **Kompatibilitas `family-chart` dengan React 19.2 / Next 16:** tidak ada pernyataan
  resmi [19] — relevan hanya bila opsi (c) kartu `02` dibangkitkan kembali.
## Sources

[6] https://github.com/gramps-project/gramps-web-docs/blob/main/docs/en/user-guide/tree.md — Gramps Web docs: Family Tree (chart types, navigation)
[7] https://www.grampsweb.org/features — Gramps Web: features (timeline, map, charts)
[8] https://webtrees.net/download/modules — webtrees: modules and themes
[14] https://github.com/gramps-project/gramps-web-api — Gramps Web API (GitHub)
[16] https://webtrees.net — webtrees - online collaborative genealogy
[17] https://api.github.com/repos/fisharebest/webtrees — fisharebest/webtrees (GitHub API: GPL-3.0, PHP)
[18] https://api.github.com/repos/gramps-project/gramps-web — gramps-project/gramps-web (GitHub API: AGPL-3.0, JS)
[19] https://raw.githubusercontent.com/donatso/family-chart/master/README.md — donatso/family-chart README
[22] https://raw.githubusercontent.com/directus/directus/main/license — Directus license (MSCL-1.0-GPL)
[23] https://raw.githubusercontent.com/strapi/strapi/main/LICENSE — Strapi LICENSE (MIT + EE)
[24] https://api.github.com/repos/payloadcms/payload — payloadcms/payload (GitHub API: MIT)
