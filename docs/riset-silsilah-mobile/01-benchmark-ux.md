# Benchmark UX Tampilan Silsilah di HP + Alternatif Non-Pohon

Bagian 1/4 riset silsilah Wirjodihardjo. Penulis: Beta. Riset 30 Oktober 2026.
Objek: https://wirjodihardjo.teknoloka.id/silsilah — repo `/opt/projects/wirjodihardjo` (orca), HEAD `7a36c68`.

## 0. Ringkasan

1. Di 390px `/silsilah` sudah aman secara responsif (tap target 44px, MiniMap disembunyikan, tanpa overflow X), tapi 84 simpul dipaksa ke kotak 358x591px sehingga fitView memakai zoom 0,1 — satu kartu orang tampil 26x8px. Masalahnya **kepadatan**, bukan responsivitas `[V-sendiri]`.
2. Pola terbaik 8 produk: (a) kartu **vertikal** = lebih banyak orang muat per layar (MyHeritage)[4]; (b) tombol **Home Person / "fokus ke saya"** + breadcrumb posisi agar tak tersesat (Ancestry[1], Geni[3], Gramps Web[6]); (c) **daftar dengan sortir + paginasi** sebagai jalan masuk, kanvas hanya lapisan detail (MyHeritage[10], Gramps Web[7]).
3. Dua alternatif non-pohon paling menjanjikan: **daftar terurut + paginasi** (usaha S) dan **linimasa per generasi** (usaha M). Cocok dengan pola hybrid HP daftar / desktop kanvas.

## 1. Metode & status verifikasi

| Tanda | Arti |
|---|---|
| `[V-sendiri]` | Diukur sendiri 30 Okt 2026, emulasi viewport 390x844px |
| `[V-dokumen]` | Dokumentasi resmi produk; saya baca halaman resminya, **tidak** menguji UI-nya di HP (butuh akun) |
| `[V-vendor]` | Klaim pemasaran vendor, bukan fakta terukur |
| `[belum terverifikasi]` | Tak ada sumber yang bisa dikonfirmasi dalam batas riset ini |

Batasan jujur: produk komersial butuh akun untuk membuka pohon, jadi observasi pihak ketiga semuanya `[V-dokumen]`/`[V-vendor]`. Yang benar-benar diukur di 390px hanya `/silsilah` kita sendiri. Sumber web dipakai: 10 (batas kartu).

## 2. Baseline `/silsilah` di 390px `[V-sendiri]`

Emulasi 390x844px (kelas iPhone 14), 30 Okt 2026:

| Ukuran | Hasil |
|---|---|
| Kotak kanvas `.tree-canvas` | 358 x 591 px (591 = 70vh, terkunci di semua viewport) |
| Simpul ter-render | 84 node |
| Zoom bawaan (fitView) | `matrix(0.1, 0, 0, 0.1, -315.5, 236.05)` |
| Ukuran satu kartu orang | 26 x 8 px — nama & tanggal tak terbaca |
| MiniMap | `display: none` (sesuai `FamilyTreeCanvas.tsx`) |
| Overflow horizontal | tidak ada |
| Kontrol zoom / `<select>` | 44 x 44 px / 44 x 225 px |
| Filter | 3 `<select>`: Cabang, Generasi, Status (state di URL) |
| Sorting / paginasi | tidak ada; hasil `?q=` grid tanpa urutan |

Tiga temuan penentu: (1) menambah tinggi kanvas tak menyelesaikan apa pun — 84 simpul tetap harus muat di 358px; (2) zoom 0,1 berarti pohon di HP hanya "peta", pengguna selalu perlu zoom/pan dua langkah sebelum membaca satu nama; (3) tak ada jalan masuk alternatif selain mem-pan kanvas.

## 3. Benchmark 8 produk nyata

**3.1 Ancestry `[V-dokumen]`** — https://help.ancestry.com/hc/en-us/articles/53933347829779-Navigating-an-Ancestry-Family-Tree (30 Okt 2026); app https://www.ancestry.com/c/ancestry-app `[V-vendor]`.
Navigasi: 3 orientasi pohon (horizontal pedigree, vertical extended-family, fan) + Map; vertikal = leluhur ke atas, keturunan ke bawah, panah atas/bawah kartu. Panel kiri: Gallery, Find in tree, Hints, DNA, Home person, Zoom.[1] Anti-tersesat: **Home person** (orang utama, biasanya "saya"), **Last Viewed**, **List of all people**.[1] Filter/urut: Find in tree per tag; Hints diurut per tipe & nama; Gallery per tipe media.[1] Enyak 390px: Home person + Last Viewed memulihkan posisi tanpa pan; Gallery = jalur masuk media yang terbaca.[1] Tak enak: fan chart 4 generasi, filter hint/foto lanjutan, dan Map dikunci langganan Pro Tools — opsi "ringkas" justru tak tersedia gratis.[1] Ditiru: **breadcrumb posisi + tombol pulang ke orang utama**, **daftar semua orang**.

**3.2 FamilySearch `[V-dokumen]`** — https://www.familysearch.org/en/help/helpcenter/article/what-are-the-features-of-the-family-tree-and-memories-mobile-apps (30 Okt 2026).
Navigasi: app Family Tree hanya **portrait pedigree** atau **fan view**; tap orang → info → "View This Tree" kembali ke pedigree dengan orang itu sebagai akar. Fitur khusus HP: "Relatives Around Me", "Map My Ancestors".[2] Yang **tidak ada** di app HP (kata vendor): variasi layout pohon, halaman People, Source Box, **linimasa + peta hanya di website**.[2] Enyak 390px: app HP sengaja sempit (portrait + fan) supaya tak pernah memuat kanvas padat; "View This Tree" = pola fokus satu orang tanpa kanvas.[2] Tak enak: justru linimasa & peta tak ada di HP, padahal paling cocok untuk layar sempit.[2] Catatan: FamilySearch **counter-example** — jangan tiru pola "HP hanya pohon"; kebutuhan Bos (linimasa di HP) lebih masuk akal.

**3.3 Geni `[V-dokumen]`** — https://www.geni.com/blog/introducing-our-new-html-tree-on-geni-101035.html (30 Okt 2026).
Navigasi: pohon HTML tablet/HP; **pinch zoom**; panel profil **meluncur dari kanan dan mengisi seluruh layar** di HP, tap nama di atas untuk kembali ke pohon.[3] Anti-tersesat: breadcrumb atas pohon (klik nama = kembali ke posisi orang itu), tab **Navigate** (minimap + kotak biru area yang dilihat), tab **Go To...** (daftar alfabetis semua orang tampil), tab **Preferences** via hamburger.[3] Filter/urut: Preferences atur generasi leluhur/keturunan + "Direct ancestors only"; generasi lebih rendah = pohon lebih cepat dimuat.[3] Enyak 390px: **bottom sheet penuh layar** untuk profil orang — pola tepat di HP; "Go To..." alfabetis = jalan masuk non-kanvas gratis.[3] Tak enak: tambah relasi di HP harus lewat panel profil (bukan "+" di node), alur lebih panjang.[3]

**3.4 MyHeritage `[V-dokumen]`** — app HP https://blog.myheritage.com/2025/03/new-improved-family-tree-on-the-myheritage-mobile-app/ ; tampilan https://www.myheritage.com/help/en/articles/12852432-what-are-the-myheritage-tree-views-and-how-can-they-be-useful-for-me (30 Okt 2026).
Navigasi HP: **swipe pan, pinch zoom**, tap kartu memusatkan orang, tombol Home memusatkan orang utama, "Find a person", dan **radar** area lain pohon.[10] Temuan utama: sejak Maret 2025 MyHeritage menjadikan **kartu vertikal default di app HP** dengan alasan eksplisit — vertikal membuat lebih banyak kartu muat di layar dan mengurangi perlu pan; disebut "particularly useful when navigating the family tree on a much smaller screen".[4] Setelan dari HP: slider generasi (hingga 5+, opsi "hide cousins of main person"), warna per cabang, pita hitam almarhum, kartu "tambah orang tua", kartu vertikal/horizontal.[4] Filter/urut: **List view** filter per huruf nama belakang, urut per nama depan/belakang, tanggal & tempat lahir/meninggal; paginasi 25 default, 10–100 per halaman.[10] Pohon besar: di atas ~50 orang sebagian cabang disembunyikan di balik ikon cabang, dibuka satu per satu.[10] Enyak 390px: kartu vertikal + slider generasi + List view urut & paginasi — kombinasi yang membuat pohon besar tetap terpakai di HP.[4][10] Tak enak: >50 orang = cabang tersembunyi; List view "kurang visual", tak memperlihatkan relasi.[10] Ditiru: **kartu vertikal**, **slider generasi terlihat**, **List view sort + paginasi**.

**3.5 Family Echo `[V-dokumen, klaim vendor]`** — https://answers.familyecho.com/1167/mobile-version (30 Okt 2026).
Status: 2015 vendor menjawab "The website should be mobile-friendly if JavaScript is enabled in the browser on the mobile device. We will look into improving this".[5] Vendor **mengakui belum dioptimalkan**; tak ada dokumen pola mobile khusus. `[belum terverifikasi]` kondisi terkini. Tak ada pola mobile terdokumentasi: tanpa daftar, tanpa bottom sheet, tanpa sort. Pelajaran: Family Echo = **contoh kegagalan yang harus dihindari**, pohon kanvas tanpa jalur daftar. Kita sudah di depan karena punya `?q=` + filter, tapi `?q=` belum bisa diurut/dipaginasi.

**3.6 webtrees `[V-dokumen]`** — https://webtrees.net/download/modules (30 Okt 2026); perubahan 2.0 https://webtrees.net/upgrade/2.0/ `[V-dokumen]`.
Navigasi: webtrees 2.0 menulis ulang tema agar bekerja di "mobiles, tablets, laptops and desktops". Mobile ditangani di lapisan **tema**: JustLight "optimized for using on tablets and mobile phones" dan "the only theme that has a specific collapsable menu for small screens"; tema Modern bawa "look and feel more like today's popular pay-as-you-go family tree services" plus **timeline view for facts**; Potts Modern janjikan presentasi desktop/tablet/mobile lebih baik.[8] Filter/urut: modul Statistics dasbor responsif; tema kustom ubah tabel fakta jadi blok penuh di bawah 500px agar tak ada gulir horizontal.[8] Enyak 390px: menu diciutkan khusus layar kecil (hanya JustLight), tabel jadi kartu/blok.[8] Tak enak: tanpa tema pihak ketiga tampilan bawaan tak dijanjikan ramah HP; beberapa tema komunitas bawa menu panjang yang makan separuh layar.[8] Pelajaran: **tabel jadi kartu di bawah 500px** = pola murah & terbukti; "timeline view for facts" sudah umum.

**3.7 Gramps Web `[V-dokumen]`** — chart https://github.com/gramps-project/gramps-web-docs/blob/main/docs/en/user-guide/tree.md ; fitur https://www.grampsweb.org/features/ (30 Okt 2026).
Navigasi: 5 chart (Ancestor, Descendant, Hourglass, Relationship Graph, Fan) semuanya berpusat pada satu orang terpilih; toolbar bersama: **Home Person**, **Back** (orang sebelumnya), **Person Details**, **Preferences**; semua chart dukung pan (drag) & zoom (scroll/pinch); klik kartu memusatkan ulang.[6] Filter/urut: Preferences (localStorage per perangkat) atur maksimum generasi leluhur/keturunan, derajat pemisah Relationship Graph, jumlah foto, format nama.[6] Non-pohon resmi: **Timeline** (horizontal zoomable, filter ke satu orang / semua leluhur / semua keturunan / semua peristiwa satu tempat) dan **Map** (peta interaktif, cari tempat via OSM, tandai orang geografis, hubungkan peristiwa satu orang dengan garis).[7] Mobile: mobile-first (Lit + Material), sidebar jadi hamburger, dan mulai v26.6.1 daftar objek **runtuh jadi tampilan seperti kartu di layar kecil**, hilang scroll horizontal tanpa menyembunyikan data; daftar bisa difilter, diurut, pilih baris untuk merge/delete, atur kolom.[7] Enyak 390px: referensi terdekat dengan kebutuhan kita — Home Person + Back untuk navigasi kanvas, Timeline & Map sebagai alternatif non-pohon, daftar jadi kartu di HP.[6][7] Tak enak: navigasi utama tetap sidebar (satu ketukan ekstra), Relationship Graph bisa menampilkan orang sama berulang.[6]

**3.8 23andMe `[V-dokumen + vendor]`** — https://www.23andme.org/blog/articles/explore-23andmes-ancestry-service (30 Okt 2026).
Navigasi: Family Tree dibangun **otomatis** dari DNA Relatives (kerabat dekat peserta program), tambah orang manual dari daftar match; vendor tampilkan tangkapan "Family Tree on a mobile phone" `[V-vendor]`.[9] Filter/urut: paling kaya justru di **DNA Relatives** — kerabat diurut berdasarkan lokasi, nama keluarga, kedekatan hubungan, atau jumlah segmen DNA.[9] Enyak 390px: daftar kerabat dengan sortir multi-kriteria jauh lebih terbaca daripada pohon; pohon otomatis selalu kecil & dangkal jadi tak pernah padat.[9] Tak enak: pohon tak bisa diurut/disaring (vendor tak mendokumentasikan filter pohon), fitur bergantung partisipasi DNA.[9] Pelajaran: **sortir terbaik milik daftar, bukan kanvas** — argumen terkuat menjadikan daftar silsilah tampilan utama di HP.

## 4. Alternatif di luar pohon/kanvas

Semua boleh berdampingan dengan kanvas (hybrid: HP daftar, desktop kanvas). "Usaha": S < 1 hari, M 2-5 hari, L > 5 hari / perlu desain data baru.

**A1. Daftar terurut + paginasi (buku keluarga per cabang)** — daftar orang satu cabang/generasi, kartu atau baris, kontrol urut (nama, tanggal lahir, generasi, umur, terbaru ditambahkan), paginasi 25/50/100, penghitung. Referensi: MyHeritage List view (urut + paginasi 10-100)[10], Gramps Web list view jadi kartu di HP[7], Geni "Go To..." alfabetis[3].
Kelebihan 390px: tanpa zoom/pan; nama & tanggal terbaca penuh; sortir bikin 252+ orang tetap terjangkau; target sentuh 44px mudah. Kekurangan: tak memperlihatkan relasi; bisa terasa "tabel telepon" bila tanpa foto. Usaha **S** — `searchPersons` sudah ada; tambah param sort + halaman + tampilan kartu. Berdampingan kanvas: **Ya, sangat disarankan.** HP daftar, desktop kanvas, satu rute `?view=list`, satu sumber data. Mulai dari: tambah `?sort=` & `?page=` di `src/app/silsilah/page.tsx`; kartu pakai `Avatar` yang ada.

**A2. Linimasa per generasi (non-pohon)** — peristiwa (lahir, nikah, meninggal) diurut tahun, dikelompokkan per generasi, bisa difilter ke satu cabang/orang. Referensi: Gramps Web Timeline (horizontal zoomable, filter orang/leluhur/keturunan/tempat)[7]; tema webtrees Modern "timeline view for facts"[8]. Catatan: FamilySearch sengaja tak memuat linimasa di app HP[2] — tak perlu ditiru.
Kelebihan 390px: alami berbentuk kolom vertikal = bentuk native HP; urutan tahun memberi konteks tanpa kanvas; tambah cabang/generasi tak membuatnya padat. Kekurangan: tak menunjukkan relasi; butuh data tanggal rapi (banyak kosong); tanpa filter bisa sangat panjang. Usaha **M** — kueri agregat peristiwa per generasi + komponen daftar. Berdampingan kanvas: **Ya.** HP linimasa, desktop kanvas; juga berguna di desktop sebagai konteks sejarah. Mulai dari: kelompokkan `Person` per `generationLevel`, urut tahun lahir, tampilkan 3 generasi teratas + tombol "muat lebih".

**A3. Galeri generasi (grid foto per generasi)** — grid foto per generasi (1-3 kolom), nama & tahun di bawah foto, ketukan → profil. Referensi: Ancestry Gallery filter per tipe media[1]; Gramps Web Media[7].
Kelebihan 390px: paling visual & paling murah dibaca; grid 2 kolom pas di 390px; sel ≥ 160px = target sentuh besar; cocok pengguna non-teknis. Kekurangan: sangat bergantung ketersediaan foto; tak memberi relasi; dangkal bila foto sedikit. Usaha **S/M** — S bila foto punya URL stabil; M bila perlu paginasi & lazy-loading rapi. Berdampingan kanvas: **Ya**, sebaiknya tab tersendiri ("Galeri"), bukan pengganti pohon. Mulai dari: pakai `Avatar` yang ada; grid per `generationLevel`; filter cabang tetap dipakai.

**A4. Halaman profil-jalur (fokus satu orang, tanpa kanvas)** — satu halaman per orang: data singkat, orang tua, pasangan, anak, saudara, anak dari anak — daftar relasi terurut, riwayat "terakhir dilihat", tautan balik ke kanvas dengan orang itu terpusat. Referensi: FamilySearch "View This Tree"[2], Geni panel profil penuh layar[3], MyHeritage "Find a person" + Immediate Family[10], Gramps Web Person Details[6].
Kelebihan 390px: paling nyaman di HP — satu orang, satu layar, tanpa orientasi spasial; rantai navigasi jelas (orang → relasi → orang). Kekurangan: pengguna kehilangan gambaran posisi dalam keluarga besar; butuh breadcrumb/jalur; pekerjaan data relasi paling besar. Usaha **M** — sebagian data sudah dipakai `DetailPanel`; perlu rute orang + relasi terurut. Berdampingan kanvas: **Ya, dan wajib.** Jembatan: daftar/linimasa → profil → "lihat di pohon" (desktop). Mulai dari: rute `/silsilah/orang/[id]` membaca data yang sudah dipakai `DetailPanel`.

**A5. Peta sebaran lokasi (non-pohon, opsional)** — penanda tempat lahir/tinggal/meninggal, filter per cabang/generasi. Referensi: Gramps Web Map (cari tempat OSM, tandai orang, hubungkan peristiwa satu orang dengan garis)[7]; Ancestry Map (Pro Tools)[1]; FamilySearch "Map My Ancestors" (khusus HP)[2].
Kelebihan 390px: sangat kuat di HP (gestur peta sudah dikenal); memberi cerita "dari mana keluarga kita" yang tak bisa diberikan pohon. Kekurangan: perpustakaan peta berat untuk bundel HP; data tempat belum tentu lengkap/terstandar; privasi alamat orang hidup. Usaha **L** — normalisasi tempat, komponen peta, kebijakan privasi. Berdampingan kanvas: **Ya**, tapi tahap terakhir setelah A1/A2 jalan. Mulai dari: audit kolom tempat di Prisma; bila ≥60% orang punya tempat lahir konsisten, naikkan prioritas.

## 5. Tabel ringkas

| # | Alternatif | Pohon? | Enak 390px | Usaha | Hybrid kanvas | Prioritas |
|---|---|---|---|---|---|---|
| A1 | Daftar terurut + paginasi | non-pohon | tinggi | S | ya | **1** |
| A2 | Linimasa per generasi | non-pohon | tinggi | M | ya | **2** |
| A3 | Galeri generasi | non-pohon | tinggi (visual) | S/M | ya | 3 |
| A4 | Profil-jalur satu orang | non-pohon | tinggi | M | ya, wajib | 2 (sejalan A2) |
| A5 | Peta sebaran lokasi | non-pohon | tinggi | L | ya | 5 (terakhir) |
| B1 | Kanvas + kartu vertikal | pohon | sedang | S | — | perbaikan murah, segera |
| B2 | Kanvas + slider generasi | pohon | sedang | S | — | perbaikan murah, segera |
| B3 | Kanvas + "fokus ke saya" + breadcrumb | pohon | sedang | S | — | perbaikan murah, segera |
| B4 | Fan chart | pohon | rendah di HP | M | ya | ditolak untuk HP (§6) |
| B5 | Kanvas layar penuh (h-100vh) | pohon | rendah | S | ya | ditolak untuk HP (§6) |

Pola dari produk nyata tanpa membangun alternatif baru: kartu vertikal (MyHeritage)[4], slider generasi + sembunyikan sepupu (MyHeritage)[4], Home Person + Back (Gramps Web)[6], breadcrumb posisi (Geni)[3], daftar alfabetis (Geni)[3], daftar sortir + paginasi (MyHeritage[10], Gramps Web[7]).

## 6. Alternatif dipertimbangkan & kenapa ditolak/dipilih

1. **Fan chart di HP — DITOLAK untuk HP, boleh desktop.** FamilySearch, MyHeritage, Gramps Web menawarkan fan view[2][10][6], tapi fan memuat 4-10 generasi dalam satu lingkaran; di 390px tiap busur hanya ~90px sehingga nama tak terbaca. Berguna "melihat celah data" di desktop.
2. **Kanvas layar penuh (`h-[100dvh]`) di HP — DITOLAK.** Tambah ±30% ruang, tapi 84 simpul tetap dipaksa ke 358px dan zoom tetap ~0,1 `[V-sendiri]`. Halaman juga jadi tanpa judul/filter, kontrol browser HP mudah memicu keluar.
3. **Ganti kanvas dengan daftar saja (non-hybrid) — DITOLAK.** Menghilangkan gambaran relasi yang justru alasan halaman ini ada; MyHeritage menyebut List view "kurang visual dan tidak memperlihatkan hubungan keluarga"[10]. Dipilih hybrid.
4. **Timeline hanya desktop (pola FamilySearch) — DITOLAK.** FamilySearch membatasi linimasa & peta hanya untuk website[2]; untuk 390px linimasa justru bentuk paling wajar. Dipilih: linimasa dikerjakan untuk HP.
5. **Peta lokasi sebagai alternatif utama — DITOLAK untuk sekarang.** Usaha L, bergantung kualitas data tempat, menyentuh privasi alamat orang hidup. Dicatat sebagai tahap 5.
6. **Tabel responsif (blok di bawah 500px) — DIPILIH sebagai perbaikan murah, bukan jawaban utama.** Terbukti di komunitas webtrees (tabel fakta jadi blok di bawah 500px)[8] dan Gramps Web (daftar runtuh jadi kartu)[7]. Berguna untuk tabel turunan, tak memecahkan kepadatan kanvas.
7. **App native/PWA terpisah untuk kanvas — DITOLAK.** Di luar cakupan riset, memperbesar biaya pemeliharaan; pola PWA sudah cukup bila halaman ramah HP, seperti Gramps Web tanpa mengubah model data[7].

## 7. Urutan kerja

1. **Segera (S):** B1+B2+B3 — kartu vertikal, slider generasi terlihat di HP, tombol "fokus ke saya" + breadcrumb posisi. Satu-satunya perubahan kanvas yang benar-benar terukur manfaatnya di 390px.
2. **Berikutnya (S):** A1 daftar terurut + paginasi untuk `/silsilah?q=` dan sebagai default di HP — langsung menyelesaikan "252 orang tanpa sort/paginasi".
3. **M:** A4 profil-jalur satu orang, lalu A2 linimasa per generasi.
4. **S/M:** A3 galeri generasi sebagai tab visual untuk pengguna non-teknis.
5. **Terakhir (L):** A5 peta, hanya setelah audit data tempat dan kebijakan privasi.

## 8. Sumber
Sources:
[1] https://help.ancestry.com/hc/en-us/articles/53933347829779-Navigating-an-Ancestry-Family-Tree — Ancestry Help: Navigating an Ancestry Family Tree
[2] https://www.familysearch.org/en/help/helpcenter/article/what-are-the-features-of-the-family-tree-and-memories-mobile-apps — FamilySearch Help: features of Family Tree & Memories mobile apps
[3] https://www.geni.com/blog/introducing-our-new-html-tree-on-geni-101035.html — Geni Blog: Introducing Our New HTML Tree on Geni
[4] https://blog.myheritage.com/2025/03/new-improved-family-tree-on-the-myheritage-mobile-app — MyHeritage Blog: Improved Family Tree on the Mobile App (Mar 2025)
[5] https://answers.familyecho.com/1167/mobile-version — Family Echo Q&A: Mobile Version
[6] https://github.com/gramps-project/gramps-web-docs/blob/main/docs/en/user-guide/tree.md — Gramps Web docs: Family Tree (chart types, navigation)
[7] https://www.grampsweb.org/features — Gramps Web: features (timeline, map, charts)
[8] https://webtrees.net/download/modules — webtrees: modules and themes
[9] https://www.23andme.org/blog/articles/explore-23andmes-ancestry-service — 23andMe Blog: Ancestry Service (Family Tree + DNA Relatives sorting)
[10] https://www.myheritage.com/help/en/articles/12852432-what-are-the-myheritage-tree-views-and-how-can-they-be-useful-for-me — MyHeritage Help: Tree Views (Family/Pedigree/List/Fan)
