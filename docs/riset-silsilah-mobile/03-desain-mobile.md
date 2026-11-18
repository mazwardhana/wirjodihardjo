# 03 — Desain Varian Tampilan Mobile Silsilah

Kartu 3/4 riset tampilan silsilah Wirjodihardjo. Cakupan: varian tampilan untuk HP
(viewport 390x844 px) dan spesifikasi alur tap, wireframe, serta estimasi usaha.
Membaca `01-benchmark-ux.md` (baseline terukur + 8 produk) dan
`02-evaluasi-teknologi-render.md` (keputusan teknologi) sebagai prasyarat.

Fakta repo/DB di bawah dibaca langsung, bukan diasumsikan:

| Item | Nilai terukur |
|---|---|
| Person total di DB | 95 (84 simpul ter-render) |
| Person punya `photoUrl` | 2 |
| Person tanpa relasi apa pun | 11 (tetap dirender karena `buildTreeGraph` menyembunyikan yang tak berelasi kecuali `showDisconnected`) |
| `generationLevel` terpakai | 0 (3), 1 (13), 2 (11), 3 (13), 4 (22), 5 (19) |
| User login | 80 → hampir semua pengguna punya "saya" |
| Edge anak | 114 (`PersonChild`) |
| Edge pasangan | 23 (`PersonPartner`) |
| Gender | 56 MALE, 39 FEMALE |
| Status | 85 hidup, 10 almarhum |
| Kartu orang | `NODE_W = 260`, `NODE_H = 130`, `COUPLE_SPACING = 300` |
| Kotak kanvas | 358 x 591 px, zoom efektif 0,1 |

## 0. Ringkasan

Tiga varian dirancang, dua di antaranya memenuhi syarat wajib kartu:

| # | Varian | Kanvas? | Kelas | Usaha |
|---|---|---|---|---|
| **V1** | Buku Keluarga per Cabang (outline bertingkat non-kanvas) | tidak | wajib hadir | **M** |
| **V2** | Daftar Silsilah (kartu vertikal + sort + paginasi) | tidak | jalur masuk utama | **S** |
| **V3** | Hybrid: HP daftar/outline, desktop tetap React Flow | ya (desktop) | **rekomendasi** | **M** (V1+V2+S) |

Rekomendasi: **V3**. V1 dan V2 dibangun lebih dulu sebagai tampilan HP; V3 adalah
cara V1/V2 dipasang di satu rute `/silsilah?view=` sehingga desktop tidak
kehilangan kanvas. Detail di §5.

## 1. Metode

Setiap varian dinilai dari empat pertanyaan yang sama: (a) berapa orang yang
terbaca per layar tanpa zoom/pan, (b) bagaimana pengguna menemukan posisinya
sendiri, (c) apa yang hilang dibanding kanvas, (d) berapa usaha di repo ini.
Angka "orang per layar" dihitung manual dari tinggi baris kartu yang diusulkan.

## 2. V1 — Buku Keluarga per Cabang (outline bertingkat, non-kanvas)

Tampilan bersarang: satu baris per orang, rincian relasi muncul lewat expand
per keluarga. Dipakai `getFamilyTree()` yang sudah ada, lalu **pemilihan data**
dari `buildTreeGraph` (union-find komponen, urutan akar, urutan anak,
pengelompokan pasangan) — bukan geometri x/y. Ini persis opsi (e) di `02`.

### 2.1 Wireframe ASCII

```
┌──────────────────────────────────────┐ 390 px
│ ← Jelajahi / Silsilah        [Pencarian]
│ Keluarga Soedjinah        ▾ 84 orang  │ header: cabang + hitungan
│ ┌──────────────────────────────────┐ │
│ │ ▾ ♂ Wirjodihardjo  Leluhur       │ │ baris akar, ter-expand
│ │   ▸ ♀ Pasangan 1                 │ │
│ │     ▾ ♂ Anak A         Anak      │ │
│ │       ▸ ♂ Cucu 1       Putu      │ │ indent 1 tingkat = 12 px +
│ │       ▸ ♀ Cucu 2       Putu      │ │ penanda 16 px
│ │     ▾ ♂ Anak B         Anak      │ │
│ │       ▸ ♀ Cucu 3       Putu      │ │
│ │ ▸ ♂ Cabang lain (disembunyikan)  │ │ cabang terlipat = default
│ └──────────────────────────────────┘ │
│ [Daftar] [Pohon] [Galeri]            │ tab bawah, tinggi 56 px
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ │ safe-area inset
└──────────────────────────────────────┘
```

Satu layar = **8-10 baris orang** (baris 44 px + pemisah). Dengan cabang terlipat,
84 orang tetap terjangkau dalam 3-4 gestur expand.

### 2.2 Alur tap nyata

1. Beranda → ketuk "Jelajahi / Silsilah".
2. Halaman membuka **Buku Keluarga** (default di HP). Header menampilkan cabang
   aktif + "84 orang".
3. Ketuk baris **Wirjodihardjo** (akar) → baris itu membuka satu tingkat; saudara
   dan pasangan tampil di bawahnya.
4. Untuk mencari orang: ketuk ikon pencarian di kanan atas, ketik nama →
   daftar hasil muncul; ketuk satu hasil.
5. Hasil itu bukan dialog, tapi **jalur keluarga**: halaman orang menampilkan
   orang tua → pasangan → anak → saudara, tiap tautan bisa diketuk lagi.
6. Ketuk tautan orang tua → pindah ke orang itu, posisi di outline ditandai
   (kelas `bg-parchment` pada baris terpilih), tombol "Kembali" browser pulih
   posisi gulir.
7. Ketuk nama yang sama di dua tempat → tidak ada duplikat: satu node per orang
   dipertahankan sebagai invarian (sudah diuji di `treeLayout.test.ts`).

### 2.3 "Posisi saya di pohon" — jawaban konkret

Tiga lapis, bekerja tanpa kanvas:

1. **Tombol "Fokus ke saya"** — bulat, 56 px, pojok kanan bawah di atas tab
   bawah. Muncul hanya bila pengguna login (80 dari 95 orang punya akun) dan
   `session.user` bisa dipetakan ke `personId` lewat `prisma.user.findUnique`.
   Ketukan menjalankan `scrollIntoView({ block: "center" })` pada baris milik
   pengguna, lalu meng-expand semua leluhur di jalur itu secara otomatis.
2. **Breadcrumb jalur atas** — `Saya → Anak → Ayah → Kakek → Wirjodihardjo`.
   Dibangun dari `PersonChild.parentId` naik sampai `generationLevel = 0`.
   Setiap segmen bisa diketuk untuk melompat ke orang itu. Inilah jawaban
   langsung pertanyaan kartu: **tanpa men-scroll kanvas raksasa**, pengguna
   membaca posisinya dari breadcrumb, lalu memakai breadcrumb untuk berpindah.
3. **Penanda baris terpilih** — baris pengguna diberi `aria-current="true"` dan
   warna `--color-parchment`, tetap terlihat setelah gulir balik.

Tambahan murah yang sudah terbukti di produk lain: `localStorage` menyimpan
cabang terakhir yang dibuka (pola Preferences Gramps Web `[6]` di `01`), supaya
kembali ke halaman tidak selalu mulai dari akar.

### 2.4 Usaha: **M** (2-3 minggu, sejalan dengan opsi (e) di `02`)

Alasan: bukan tampilan baru dari nol — data sama (`getFamilyTree`), komponen
kartu sudah ada (`Avatar`), pola tab sudah ada (`HallOfFameTabs.tsx`). Yang baru:
(1) fungsi `buildOutlineTree()` yang memakai ulang union-find + urutan anak dari
`treeLayout.ts`, (2) komponen baris bersarang dengan `role="tree"` +
`aria-expanded` + `aria-level`, (3) breadcrumb jalur leluhur, (4) tombol fokus
ke saya. Yang **tidak** perlu: 15 tes geometri di `treeLayout.test.ts` tidak
disentuh karena geometri tidak dipakai; ±8 tes data tetap relevan dan hijau.

## 3. V2 — Daftar Silsilah (kartu vertikal + sort + paginasi)

Jalur masuk non-kanvas paling murah. Bukan pengganti pohon di desktop, tapi
tampilan default di HP untuk "saya cuma ingin cari nama".

### 3.1 Wireframe ASCII

```
┌──────────────────────────────────────┐ 390 px
│ [Cari nama…                    ] [Cari]
│ [Cabang ▾] [Generasi ▾] [+2 filter]  │ chip, bukan 3 select berjejer
│ ┌──────────────────────────────────┐ │
│ │ ( foto ) Wirjodihardjo           │ │ kartu vertikal, 72 px tinggi
│ │         Leluhur · 1930           │ │
│ ├──────────────────────────────────┤ │
│ │ ( foto ) Anak A                  │ │
│ │         Anak · 1955              │ │
│ └──────────────────────────────────┘ │
│ Menampilkan 1–25 dari 84             │
│ [◀ Sebelumnya]           [Berikutnya ▶]
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ │
└──────────────────────────────────────┘
```

Satu layar = **5-6 kartu** (kartu 72 px + gap 12 px). Lebih sedikit daripada
outline, tapi tiap kartu memperlihatkan foto, nama, generasi, dan tahun —
lebih padat informasi per orang, tanpa interpretasi hierarki.

### 3.2 Alur tap nyata

1. Beranda → "Jelajahi / Silsilah" → tab **Daftar**.
2. Daftar terbuka terurut **nama A–Z**, halaman 1 (25 orang).
3. Ketuk chip "Generasi" → bottom-sheet memunculkan pilihan; pilih "Anak" →
   URL berubah, daftar dirender ulang server-side, chip menunjukkan "Generasi:
   Anak ✕".
4. Ketuk chip "+2 filter" → bottom-sheet "Filter & Urutkan" berisi semua
   kontrol (spesifikasi lengkap di `04-sorting-filtering-spec.md`).
5. Ketuk satu kartu → dialog detail (pola `DetailPanel` yang sudah ada, modal
   di desktop / bottom-sheet di HP sesuai `Dialog.tsx` baris 92 & 101).
6. Dari dialog detail: tombol "Lihat di pohon" → pindah ke tab Pohon dengan
   orang itu terpusat (hanya bermakna di desktop; di HP tombol ini disembunyikan
   dan diganti "Lihat keluarga" yang membuka V1).
7. Akhir daftar: "Berikutnya" → halaman 2; halaman terakhir menonaktifkan
   tombol, konsisten dengan `DataTable.tsx`.

### 3.3 "Posisi saya di pohon" — jawaban konkret

Daftar **tidak** menjawab pertanyaan posisi, dan itu diakui terbuka. Yang
disediakan: (a) kolom "Generasi" pada setiap kartu supaya kedalaman terlihat
sebagai angka, bukan sebagai posisi spasial; (b) filter **"Dalam N langkah dari
saya"** (`?near=1|2|3`, lihat `04` §5) yang memfilter daftar ke kerabat terdekat
pengguna — inilah cara daftar menjawab "di mana saya": dengan mempersempit
daftar ke lingkungan diri sendiri; (c) tautan "Lihat keluarga" di dialog detail
yang mengirim pengguna ke V1 dengan orang itu terpilih.

### 3.4 Usaha: **S** (< 1 hari)

Alasan: `searchPersons` sudah ada, pola `?q=&page=` sudah dipakai di
`src/app/registrasi/anggota/page.tsx` dan `src/app/admin/anggota/page.tsx`
(`perPage = 25`, `skip/take`, `totalPages`), `DataTable` sudah punya sortir
klien + paginasi server, `Avatar` sudah ada. Yang baru: satu fungsi daftar
dengan `orderBy` + `skip/take`, satu tampilan kartu, dan param `sort`/`page`
di URL. Tidak menyentuh `treeLayout.ts` sama sekali.

## 4. V3 — Hybrid: HP daftar/outline, desktop tetap React Flow

Bukan varian tampilan keempat, melainkan **cara memasang V1 + V2** di satu rute
sehingga desktop tidak kehilangan kanvas. Ini rekomendasi final.

### 4.1 Wireframe ASCII (HP, tab Pohon sengaja tetap ada)

```
┌──────────────────────────────────────┐ 390 px
│ Silsilah Keluarga          [Pencarian]
│ [Buku Keluarga] [Daftar] [Pohon]     │ tab, 48 px, aria-selected
│ ┌──────────────────────────────────┐ │
│ │  …isi V1 atau V2 sesuai tab…    │ │
│ └──────────────────────────────────┘ │
│ ── tab Pohon di HP: kanvas ringkas ── │
│ ┌──────────────────────────────────┐ │
│ │  (kanvas 60vh, 1 generasi)       │ │ hanya saat tab Pohon dipilih
│ │      [Fokus ke saya]             │ │
│ └──────────────────────────────────┘ │
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐ ≥1024 px
│ Silsilah Keluarga          [Pencarian]
│ [Pohon] [Buku Keluarga] [Daftar]     │ tab, Pohon = default
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │        ReactFlow, fitView        │ │ NODE_W 260 tetap di desktop
│ │                                  │ │
│ │   [MiniMap]        [Fokus saya]  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

Aturan pemilihan tampilan (bukan CSS `display:none`, melainkan keputusan
render supaya payload HP tidak memuat kanvas):

| Kondisi | Tampilan default |
|---|---|
| HP (< 640 px), tanpa `?view=` | Buku Keluarga (V1) |
| HP, `?view=list` | Daftar (V2) |
| HP, `?view=tree` | Kanvas — tinggi `h-[60vh]`, satu generasi, `minZoom` dinaikkan |
| Desktop (≥ 640 px), tanpa `?view=` | Kanvas React Flow |
| Desktop, `?view=outline` / `?view=list` | V1 / V2 |

Deteksi viewport: satu komponen klien kecil (`matchMedia("(min-width: 640px)")`)
yang mengirim nilai awal lewat cookie/header, **bukan** `typeof window` saat
render pertama — halaman ini `export const dynamic = "force-dynamic"` sehingga
server render selalu tersedia dan hydration mismatch bisa dihindari.

### 4.2 Alur tap nyata (jalur lengkap yang diminta kartu)

1. **Beranda** → ketuk menu "Jelajahi" → `/silsilah`.
2. **Tampilan default di HP = Buku Keluarga.** Header: cabang, hitungan orang.
3. **Cari orang** → ketuk ikon pencarian, ketik "Soe" → hasil tampil sebagai
   daftar ringkas; ketuk satu nama.
4. **Lihat jalur keluarga** → halaman orang itu (rute `/silsilah/orang/[id]`
   atau dialog detail berisi daftar relasi terurut). Breadcrumb atas:
   `Saya → Anak → Ayah → Kakek`. Ketuk "Kakek" → pindah ke orang itu.
5. **Buka detail** → dialog detail (`DetailPanel`) menampilkan foto, nama
   panggilan, generasi, tanggal, dan tautan relasi. Di HP dialog memakai
   bottom-sheet (`Dialog.tsx` baris 101: `rounded-t-xl`, `max-h-[92dvh]`).
6. **Kembali** → tombol kembali browser, atau tombol "Tutup" di dialog.
   Posisi gulir V1 dipulihkan; breadcrumb tetap ada.
7. **Pindah tampilan** → tab bawah/atas: Daftar, Pohon, Galeri. Filter yang
   aktif (`branchId`, `generation`, `deceased`, `sort`) **ikut** berpindah karena
   semua state ada di URL.

### 4.3 "Posisi saya di pohon" — jawaban konkret

Sama seperti V1 §2.3 (breadcrumb + tombol "Fokus ke saya" + penanda baris),
ditambah satu hal khusus tab Pohon di HP: karena kanvas di HP hanya memuat
**satu generasi** (filter `?generation=` otomatis terpasang saat tab Pohon
dibuka di HP), tombol "Fokus ke saya" bekerja dengan `setCenter` React Flow —
bukan scroll manual. Tanpa itu, pengguna harus pinch-zoom dua langkah hanya
untuk membaca satu nama (temuan baseline di `01` §2).

### 4.4 Usaha: **M** (V1 + V2 + integrasi)

Rincian: V1 (M) + V2 (S) + seleksi tampilan & tab (S) + kanvas HP satu generasi
(S) = **M total**, 2-3 minggu, tanpa menyentuh 543 baris geometri `treeLayout.ts`.
Perubahan kanvas terbatas pada `FamilyTreeCanvas.tsx` (133 baris): tambah
`onlyRenderVisibleElements`, naikkan `minZoom` dari 0,1 ke ±0,25, dan tombol
"Fokus ke saya" — semuanya aditif.

## 5. Rekomendasi

**Ambil V3.** Bangun V1 (Buku Keluarga) lebih dulu, lalu V2 (Daftar), lalu
pasang keduanya sebagai tab bersama kanvas desktop.

Alasan:

1. **Konsisten dengan `02` §4.** `02` menyimpulkan "ambil (a) + (e)": optimalkan
   React Flow **dan** tambah tampilan outline sebagai default di bawah `sm`.
   V3 adalah eksekusi persis kalimat itu. Tidak ada pertentangan; V3 menambahkan
   satu lapis yang `02` tidak detailkan, yaitu **mekanisme pemilihan tampilan
   (tab + URL + deteksi viewport)** — itu keputusan desain, bukan keputusan
   teknologi.
2. **Konsisten dengan `01` §7.** Urutan kerja `01`: segera B1+B2+B3 (perbaikan
   kanvas murah), lalu A1 (daftar + paginasi), lalu A4/A2. V3 mengikuti urutan
   yang sama; B1/B3 (kartu vertikal, fokus ke saya) sudah menjadi bagian V3 §4.4
   dan §4.3.
3. **Data sudah tersedia.** 95 orang, 114 edge anak, 23 edge pasangan — semua
   lewat `getFamilyTree()` yang sudah ada. V2 bahkan tidak butuh query baru
   yang rumit.
4. **Hampir semua pengguna punya "saya".** 80 dari 95 orang punya akun `User`,
   jadi tombol "Fokus ke saya" langsung berguna, bukan fitur kosong.

### 5.1 Yang dikorbankan (disebutkan terbuka)

1. **Satu rute jadi tiga tampilan.** Kompleksitas `/silsilah/page.tsx` naik: 186
   baris kini harus memilih tampilan, dan ada tiga state kosong untuk diuji.
2. **Kanvas HP tetap ada tapi dibatasi.** Tab Pohon di HP hanya memuat satu
   generasi; pengguna yang ingin melihat seluruh 84 orang sekaligus tetap harus
   pakai desktop. Ini dikorbankan dengan sadar: 84 simpul di 358 px = zoom 0,1
   (`01` §2), tidak ada perbaikan murah.
3. **Hubungan keluarga tidak terbaca di V2.** Daftar tidak menunjukkan relasi —
   kekurangan yang juga diakui MyHeritage terhadap List view-nya `[10]` di `01`.
   Mitigasi: kolom Generasi + filter "dalam N langkah dari saya".
4. **Foto hampir tidak ada.** Hanya 2 dari 95 orang punya `photoUrl`, jadi V2
   akan tampil seperti daftar teks sampai foto diisi. Ini memperkuat alasan
   memilih V1 sebagai default HP (outline tidak bergantung foto).
5. **Konten di bawah `sm` tidak lagi server-render identik dengan desktop.**
   Perlu satu lapisan deteksi viewport; risiko hydration mismatch harus diuji.

## 6. Catatan aksesibilitas (berlaku untuk ketiga varian)

- Outline V1 memakai `<ul role="tree">`, `aria-expanded`, `aria-level`, navigasi
  panah atas/bawah dan kiri/kanan (tutup/buka) — pola baku, jauh lebih baik
  daripada kanvas yang hanya punya `onNodeDoubleClick` tanpa padanan keyboard
  (temuan `02` §1).
- Target sentuh minimum 44 px (baris outline 44 px, tombol tab 48 px, tombol
  "Fokus ke saya" 56 px) — sudah menjadi pola repo (`min-h-11`).
- Teks `text-base` (16 px) pada kontrol, bukan `text-xs`: di bawah 16 px iOS
  auto-zoom dan tata letak lompat (sudah dicatat di `FilterPanel.tsx` baris 8-9).
- Kontras: token `--color-forest` `#1f3a2b` di atas `--color-cream` `#f7f1e2`
  ≈ 11,6:1; `--color-muted` `#5c5040` ≈ 6,4:1 — keduanya di atas WCAG AA 4,5:1.

## 7. Yang belum terverifikasi

- Perilaku `onlyRenderVisibleElements` pada 84 simpul: issue xyflow #3883 masih
  terbuka `[13]` (lihat `02` §6); perlu benchmark sendiri setelah dipasang.
- Deteksi viewport tanpa hydration mismatch pada Next 16 App Router + React 19:
  belum diuji di repo ini; ada beberapa pola resmi dan pilihannya perlu dicoba.
- Jumlah orang per layar pada V1/V2 di atas dihitung dari tinggi baris yang
  diusulkan, **belum** diukur di perangkat nyata.
- Komposisi "saya" (siapa yang login) tidak diperiksa per orang; hanya diketahui
  80 akun ada. Bila sebagian besar akar cabang bukan pengguna aktif, tombol
  "Fokus ke saya" perlu fallback ke akar komponen (`getRootId()` sudah diekspor
  `treeLayout.ts` baris 697).

## Sources

[6] https://github.com/gramps-project/gramps-web-docs/blob/main/docs/en/user-guide/tree.md — Gramps Web docs: Family Tree (Home Person, Back, Preferences)
[10] https://www.myheritage.com/help/en/articles/12852432-what-are-the-myheritage-tree-views-and-how-can-they-be-useful-for-me — MyHeritage Help: Tree Views (List view kurang visual)
[13] https://github.com/xyflow/xyflow/issues/3883 — xyflow issue 3883: onlyRenderVisibleElements

Sumber [6], [10], [13] sudah dikutip dengan nomor yang sama di `01` dan `02`
supaya ledger sitasi antar-kartu konsisten. Tidak ada sumber web baru yang
dipakai kartu ini: bahan utama adalah repo, DB produksi (read-only), dan dua
kartu sebelumnya.
