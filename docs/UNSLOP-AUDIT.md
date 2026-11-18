# Audit UI Wirjodihardjo dengan skill `unslop`

**Kartu:** t_0358b266 · **Auditor:** Beta · **Tanggal:** 3 November 2026
**Skill:** `unslop` v. Damir Sokolovsky (@heydamir), CC BY 4.0
**Sifat:** audit saja — tidak ada `src/`, CSS, komponen, atau aset yang diubah.

---

## 0. Ringkasan untuk yang tidak sempat membaca semuanya

Saya mengaudit 8 layar (desktop + HP) dengan skill `unslop`. Hasilnya:

**Kodenya bagus.** Tidak ada satu pun tanda slop klasik di `signs.md`: 0 gradient text, 0 wash/blob, 0 heavy weight (800/900), 0 hype word, 0 exclamation, 0 greeting headline, 0 badge `PRO`/`New ✨`/`Beta 🚀`, 0 fake data, 0 emoji-sebagai-ikon (satu-satunya "emoji" adalah `→`, dan itu panah navigasi). 0 console errors dan 0 overflow horizontal di 16 pengukuran. Palet, tipografi, dan arah desain sudah tertulis rapi di `globals.css` dan dipakai konsisten.

**Tiga temuan nyata**, semuanya kecil:

1. **`border-2 border-gold` pada kartu terpilih** di layar varian compact (`PersonCard.tsx:50`) — garis tebal 2px berwarna, yang `signs.md` minta jadi hairline. Ini temuan paling kuat dari seluruh audit.
2. **Teks terlalu kecil di beberapa tempat** — 7px di beranda, 9–10px di silsilah. Ini masalah keterbacaan, bukan selera.
3. **Uppercase + wide tracking 4× di beranda** — satu-satunya layar dengan pola ini.

**Dan satu koreksi penting terhadap data yang sudah ada:** metrik `transition-all` yang tercatat sebelumnya (347–568 per layar) **terlalu besar sekitar 25–45×**. Angka itu menghitung elemen yang **mewarisi** `transition-property: all` dari ancestor, bukan elemen yang benar-benar memakai class-nya. Hitungan nyata berbasis class: **14, 10, 0, 0, 0, 0, 1, 0**. Rincian di §3. Ini penting supaya tidak ada yang "memperbaiki" 347 elemen yang sebenarnya tidak bermasalah.

---

## 1. Bukti skill benar-benar dipakai

**TERBUKTI.** Jejak tool opencode (sesi `ses_e5f1a757cffepA5pPd64JYsgB5`, host orca) merekam opencode memuat skill lalu membaca berkas referensinya:

```
2  TEXT    Using **unslop** to audit the Navbar file for AI-slop tells.
3  tool_use skill {input: {"id": "unslop"}}  → <skill_content name="unslop"> # Skill: unslop …
7  tool_use read  {path: "/home/orca/.config/opencode/skills/unslop/references/signs.md"}
            → "Read file …/unslop/references/signs.md, lines 1-103"
11 tool_use shell {command: "cat …/Navbar.tsx"} → 314 baris terbaca
22 tool_use shell {command: "grep -rn … (forest|wood|cream|muted|font-display) …/tailwind.config.* …/globals.css"}
```

Verifikasi salinan skill: sha256 `SKILL.md` = `9e49b2ff…ccdc393`, identik dengan salinan global di `/home/orca/.config/opencode/skills/unslop/`.

Metrik di laporan ini diukur sendiri oleh Beta lewat **CDP (Chrome debug port 9444)** di host orca, bukan dikutip dari opencode. Skrip: `scripts/probe.mjs`, `scripts/detail.mjs`, plus verifikasi ulang independen (`scripts/verify-beranda.mjs`, `scripts/verify-screen.mjs`, `scripts/recount.mjs`, `scripts/recount2.mjs`, `scripts/dbg-source.mjs`).

---

## 2. Catatan penting soal cakupan data — baca sebelum percaya angka

**(a) Layar 06, 07, 08 bukan dari situs live.** Kartu meminta memakai preview lokal `http://localhost:4599` (worktree `…-wt-silsilah-integration`). Saya ikuti, lalu memeriksanya: server itu (PID 1640929, `next-server v16.3.6`, mulai 31 Okt 2026) menjalankan **branch `feat/silsilah-integration`, HEAD `af375de`** — beda dari repo utama (`HEAD 7ec3b38`). Selisihnya **+4.785 baris, 70 berkas**.

Konsekuensinya:
- **06 `/dashboard` dan 07 `/dashboard/profil`** — berkasnya tidak tersentuh selisih branch, jadi angkanya **relevan untuk kode ter-deploy**.
- **08 `/silsilah/varian/compact`** — seluruh layar ini **baru di branch itu** dan tidak ada padanannya di live. Angkanya menggambarkan kode yang belum di-merge. Temuan terkuat audit justru ada di sini.

**(b) Layar 02-HP salah label di agregat.** `out/AGG.txt` menulis `/silsilah/daftar`; JSON mentah (`02-silsilah-hp.json`) menunjukkan `url = https://wirjodihardjo.teknoloka.id/silsilah?view=pohon`. JSON mentah benar.

**(c) Kartu menyebut kode ter-deploy = `9f11a7d`.** Yang saya temukan: `HEAD` repo utama = `7ec3b38`, container `wirjodihardjo-app` dibuat 1 Nov 2026 00:50, dan tidak ada commit yang menyentuh `src/app`, `app/`, atau `package.json` setelah build itu. Chunk `.next/static/` yang disajikan cocok dengan build di disk. Jadi kode ter-deploy = `7ec3b38`. Semua angka layar 01–05 diambil dari situs live, jadi sah untuk kode ter-deploy.

**(d) Empat metrik di agregat adalah artefak ukur — sudah saya betulkan di laporan ini.** Semuanya saya reproduksi dan buktikan langsung di halaman live lewat CDP:

| Metrik lama | Kenapa salah | Angka benar |
|---|---|---|
| `transitionAll` = 43–568 | `collect(e => cs(e).transitionProperty === 'all')` menghitung **computed style**, yang **diwarisi** dari ancestor. Contoh: satu `a…transition-all` di `BranchCard` membuat 406 elemen di bawahnya ikut terhitung. 84 elemen tanpa class sama sekali ikut terhitung. | Beranda **14**, silsilah **10**, daftar **0**, galeri **0**, login **0**, dashboard **0**, profil **1**, compact **0** |
| `hoverScale` = 2–20 | `documentElement.outerHTML.match(/hover:scale[^ "'<>]*/)` — regex pada string HTML. Ia menangkap `group-hover:scale-105` sebagai substring, dan chunk JS yang ter-embed juga tertangkap. | **0** di semua 8 layar. Yang benar-benar ada di source: 4 tempat (`galeri/page.tsx:79,143`, `GalleryLightbox.tsx:55`, `BranchCard.tsx:39`) — semuanya `group-hover:scale-[1.03]`/`scale-105` pada gambar, dan hanya 1 di antaranya (`BranchCard`) ada di layar yang diaudit. |
| `glowShadows` = 4 (layar 08) | Regex multi-layer shadow. Isinya: `rgba(0,0,0,0) 0 0 0 0` ×3 + `rgb(247,241,226)` — itu **`ring-2 ring-cream`** (`CompactPedigree.tsx:122`), cincin berwarna krem di sekitar dot penanda. Bukan glow. | **0 glow** |
| `pulse=1` / `trailingPeriod=10` | `pulse` menghitung `animate-(pulse|ping|bounce|spin)`; setiap kemunculan adalah **`animate-spin`, spinner loading yang sah**. `trailingPeriod=10` teksnya `SSoedjinahalm.` — titik dari singkatan **"alm." (almarhum)**. | **0 animate-pulse/ping/bounce**; **0 trailing period palsu** |

Bukti untuk `transitionAll`: di halaman live, `querySelectorAll('*')` = 494 elemen (beranda), 455 computed `all`, tapi hanya **14** punya class `transition-all`, dan **0** rule CSS eksplisit menyetel `transition-property: all` (sudah saya iterasi `document.styleSheets`).

---

## 3. Ringkasan 8 layar — angka terverifikasi

Kolom `ta` = elemen yang **benar-benar** punya class `transition-all` (bukan warisan); `arb uniq` = jumlah kelas arbitrary berbeda; `arb total` = total pemakaian; `off` = margin di luar grid; `hs` = `hover:scale` berbasis class; `ital` = italic; `ut` = uppercase+tracking; `fs` = ukuran font berbeda; `tc` = warna teks berbeda.

| # | Layar | Sumber | elemen | `ta` | `hs` | pill | off | arb uniq | arb total | ital | ut | fs | tc |
|---|-------|--------|--------|------|------|------|-----|----------|-----------|------|----|----|----|
| 1 | Beranda `/` | live | 494 | **14** | 0 | 28 | 16 | 11 | 22 | 1 | **4** | 11 | 10 |
| 2 | Silsilah `/silsilah` | live | 760 | **10** | 0 | 76 | 39 | 69 | 82 | 0 | 0 | 9 | 10 |
| 3 | Silsilah daftar | live | 508 | 0 | 0 | 28 | 14 | 100 | 53 | 0 | 0 | 6 | 11 |
| 4 | Galeri `/galeri` | live | 178 | 0 | 0 | 0 | 10 | **0** | 6 | 0 | 0 | 6 | 8 |
| 5 | Login `/login` | live | 163 | 0 | 0 | 0 | 10 | **0** | 4 | 0 | 0 | 5 | 8 |
| 6 | Dashboard | **local** | 270 | 0 | 0 | 13 | 10 | **1** | 4 | 0 | 0 | 6 | 9 |
| 7 | Dashboard/profil | **local** | 683 | **1** | 0 | 66 | 14 | **1** | 4 | 0 | 0 | 6 | 8 |
| 8 | Silsilah compact | **local** | 413 | 0 | 0 | 30 | 10 | **5** | 8 | 0 | 0 | 6 | 9 |

`arb uniq` = `arbitraryClasses` di JSON (jumlah **kelas arbitrary berbeda**); `arb total` = total pemakaian dari hitungan CDP ulang (`scripts/recount2.mjs`). Perhatikan selisihnya di layar 3: 100 kelas berbeda tapi hanya 53 pemakaian — artinya banyak token sejenis dipakai berulang (2 token utama). Di layar 4 dan 5, `arb uniq` = 0: tidak ada kelas arbitrary sama sekali, dan 6/4 pemakaian "arbitrary" yang saya hitung CDP adalah `env(safe-area-inset-*)`, `z-[120]`, `min-h-[70vh]`, `max-w-[10rem]` — polanya cocok regex tapi bukan nilai spacing sembarangan.

**Bersih di 16 pengukuran:** 0 console errors, 0 overflow horizontal, 0 gradient text, 0 heavy weight, 0 hype word, 0 exclamation, 0 greeting headline, 0 badge, 0 fake data, 0 `animate-pulse`/`ping`/`bounce`, 0 glow shadow, 0 `hover:scale` berbasis class.

### Ukuran font (relevan untuk keterbacaan)

| Layar | Ukuran terpakai (jumlah elemen) |
|---|---|
| 1 | 60×1, 48×3, 36×4, 30×1, 24×4, 20×10, 18×19, 16×16, 14×56, 12×10, **7×4** |
| 2 | 36×1, 18×4, 16×7, 14×23, **13×10**, 12×8, **11×27**, **10×5**, **9×17** |
| 3 | 36×1, 18×4, **16×30**, **14×87**, 12×51, **11×25** |
| 4 | 48×1, 36×1, 18×4, 16×4, 14×23, 12×1 |
| 5 | 30×1, 18×4, 16×3, 14×22, 12×1 |
| 6 | 30×4, 20×1, 18×5, 16×4, **14×41**, **12×30** |
| 7 | 30×1, 24×1, **18×14**, 16×8, **14×124**, **12×120** |
| 8 | 36×1, 20×1, 18×4, 16×5, **14×90**, **12×55** |

Tiga masalah nyata: **7px di beranda** (4 elemen), **9–10px di silsilah** (22 elemen), dan **11px sebagai ukuran kerja** di layar 2 & 3 (52 elemen). Skala 12→14→16→18→24→30→36→48→60 selebihnya sehat.

---

## 4. Temuan per layar (tanda → lokasi → usulan)

Lokasi `selector` dari DOM terukur; `file:line` dari source repo (`/opt/projects/wirjodihardjo` HEAD `7ec3b38`; untuk 06–08 worktree integrasi HEAD `af375de`).

### Layar 1 — Beranda `/` — 4 temuan

| # | Tanda (dari `signs.md`) | Lokasi | Usulan |
|---|---|---|---|
| 1 | **Type: 4 teks 7px** — gagal keterbacaan | `<text>` SVG di diagram generasi → "Anak", "Putu", "Buyut", "Canggah" | Naikkan ke 10px, atau pindah ke legenda di bawah diagram. Ini aksesibilitas, bukan selera. |
| 2 | **Type: uppercase + wide tracking** pada 4 elemen | `span.font-display…uppercase.tracking-wider.text-gold-deep` → "Babak 1..4"; `h3.text-sm.font-semibold.uppercase.tracking-wide.text-muted` → "Sebaran anggota per generasi" | Sentence case. Ini satu-satunya layar dengan pola ini. |
| 3 | **Type: italic untuk penekanan** | `p.mt-3.text-sm…> span.italic` → "Belum ada anggota tercatat" | Hapus `italic`; `text-muted` sudah memberi jeda yang cukup. |
| 4 | **Motion: `transition-all` pada 14 elemen** | `a.group block h-full rounded-lg…transition-all duration-300` (`BranchCard.tsx:26`); `span.block h-3 w-3 rounded-full transition-all` (`Scrollytelling.tsx:89`) | `transition-all` → `transition-colors` / `transition-shadow` / `transition-transform`. Kecil dan terbatas. |

**Bukan temuan:** off-grid 16 → efektif 0 (`marginLeft/Right=72.5` ×6 itu **auto-margin** dari `mx-auto` di `max-w-7xl`; `±1px` ×4 dari `sr-only` skip-link — keduanya sah). Pill 28 → dot penanda babak `h-3 w-3 rounded-full`, sah. Arbitrary 11 kelas / 22 pemakaian: `aspect-[4/3]` ×10 dan `grid-cols-[minmax(120px,180px)_1fr_auto]` ×7 adalah **grid + rasio aspek**, bukan nilai spacing sembarangan — sah. Yang bisa ditutup hanya `max-w-[180px]` dan `min-w-[160px]` → `max-w-44` / `min-w-40`.

**Verdict:** layar paling "hidup" dan satu-satunya dengan temuan tipografi. Struktur bagus: 20 heading terurut, skip-link ada, angka generasi pakai `tabular-nums`.

### Layar 2 — Silsilah `/silsilah` — 3 temuan

| # | Tanda | Lokasi | Usulan |
|---|---|---|---|
| 1 | **Type: 22 teks ≤10px** — 9px ×17, 10px ×5 | badge "Menikah", "10 anak", "Almarhum"; "Generasi tampil" | Minimum 11px untuk teks informatif. |
| 2 | **Spacing: 69 kelas arbitrary / 82 pemakaian** (paling banyak) | `w-[168px]` ×10, `text-[11px]` ×27, `text-[13px]` ×10, `leading-[1.15]` ×10, `text-[9px]` ×17, `min-h-[420px]`, `pb-[69px]`, `text-[10px]` ×2 | `w-[168px]` → `w-42`; `min-h-[420px]` → `min-h-[26rem]`; `pb-[69px]` → `pb-17`; ukuran teks 9/10/11/13px → 11/12/14. Sisa 4 token (`pt-[env(safe-area-inset-top)]`, `pb-[max(...)]`, `z-[120]`, `h-[calc(100dvh_-_var(--silsilah-chrome,172px))]`) **sah** — itu safe-area, z-index, dan layout dinamis. |
| 3 | **Spacing: off-grid nyata** — `marginLeft=53` ×3, `15px` ×2 | kartu pohon | `53px` → 52 atau 56; `15px` → 16. Sisanya `±1px` (`sr-only`, 6×) dan `72.5` (auto, 4×) — biarkan. |

**Bukan temuan:** `radialWash` di `section.tree-canvas` adalah `radial-gradient(circle at 1px 1px, rgba(111,74,43,.12) 1px, transparent 0)` — **pola titik grid**, bukan wash. Sah, dan jadi penanda karakter. Pill 76: segmen tab boleh pill; badge status kecil lebih baik `rounded`.

**Verdict:** layar paling kompleks (760 elemen, docH 1600) dengan token paling berantakan (12 token arbitrary, 9 ukuran font). Tetap rapi secara struktur, dan **0 `hover:scale`, 0 italic, 0 uppercase**.

### Layar 3 — Silsilah daftar `/silsilah/daftar` — 2 temuan

| # | Tanda | Lokasi | Usulan |
|---|---|---|---|
| 1 | **Spacing: 100 kelas arbitrary / 53 pemakaian** — hanya 2 token utama | `min-w-[110px]` ×25, `text-[11px]` ×25 | `min-w-[110px]` → `min-w-28`; `text-[11px]` → `text-xs` (12px) bila masih muat. Hanya 2 token berbeda berarti masalahnya dangkal: perbaiki 2 tempat, seluruh layar rapi. |
| 2 | **Type: 25 teks 11px** | kolom daftar | Naikkan ke 12px bila lebar memungkingkan, atau terima 11px untuk metadata sekunder. |

**Bukan temuan:** off-grid 14 → efektif 0 (semua auto-margin 72.5/200.5 dan `sr-only` ±1). Pill 28: chip filter lebih baik `rounded-md`.

**Verdict:** paling tenang di antara layar publik. **0 `transition-all`, 0 gradient, 0 italic, 0 uppercase.**

### Layar 4 — Galeri `/galeri` — 1 temuan

| # | Tanda | Lokasi | Usulan |
|---|---|---|---|
| 1 | **Motion: `group-hover:scale-[1.03]`** pada 3 gambar | `galeri/page.tsx:79,143`, `GalleryLightbox.tsx:55` | 1.03 adalah nilai yang **hormat** — `signs.md` mengeluhkan scale besar pada kartu, bukan zoom foto 3%. **Opsional**: biarkan. Kalau ingin seragam, `group-hover:brightness-105`. |

**Bukan temuan:** off-grid 10 → efektif 0 (auto-margin 136.5 + `sr-only`). Arbitrary 6: `aspect-[4/3]` (rasio aspek, sah), `ease-[cubic-bezier(0.22,1,0.36,1)]` ×2 (kurva easing bernama — ini justru **baik**, konsisten dengan `--ease-warm` di `globals.css`).

**Verdict: sudah bagus, jangan disentuh.** 178 elemen, docH 1364 desktop / 1712 HP — proporsi paling wajar. 6 ukuran font, 0 pill, 0 gradient, 0 italic, 0 uppercase, 0 `transition-all`. Satu-satunya "emoji" adalah `→` dan itu panah navigasi yang benar.

### Layar 5 — Login `/login` — 0 temuan

Tidak ada temuan. 163 elemen, **0 `transition-all`**, 0 pill, 0 gradient, 0 italic, 0 uppercase, 5 ukuran font, 8 warna teks. Placeholder ringkas ("username atau email@contoh.com") — persis yang `signs.md` minta (bukan "Masukkan username atau alamat email Anda di sini untuk melanjutkan").

Arbitrary 4: `min-h-[70vh]` (sah), `pt-[env(safe-area-inset-top)]`, `pb-[max(0.5rem,env(...))]`, `z-[120]` — semua sah.

**Catatan kecil (bukan slop):** `input#password` tidak punya placeholder (sudah benar) tapi `aria-label` belum diverifikasi — luarkan bila Bos mau periksa aksesibilitas form.

### Layar 6 — Dashboard `/dashboard` — 0 temuan *(sumber localhost:4599; berkas tidak tersentuh selisih branch)*

270 elemen, **0 `transition-all`**, 0 gradient, 0 italic, 0 uppercase, 5 heading terurut, docH 1607 / 2545 HP. Pill 13 adalah **avatar inisial** (`span.grid.place-items-center.rounded-full…h-8.w-8.text-xs` → "TW", "NW", "S") — bulat adalah pilihan benar untuk avatar, bukan badge. Arbitrary 4, semuanya sah.

**Verdict: rapi, tidak ada yang perlu diperbaiki.**

### Layar 7 — Dashboard/profil — 1 temuan *(sumber localhost:4599)*

| # | Tanda | Lokasi | Usulan |
|---|---|---|---|
| 1 | **Motion: `transition-all` pada 1 elemen** | `label.group relative cursor-pointer overflow-hidden rounded-full ring-2 ring-gold/30 transition-all hover:ring-gold/60` (`PhotoUploader.tsx:93`) | `transition-all` → `transition-box-shadow` / `transition-colors`. Satu tempat, trivial. |

**Bukan temuan:** pill 66 — campuran avatar inisial (sah) dan tombol "Ganti" sebagai pill (bisa `rounded-md`, minor). Arbitrary 4, sah. `trailingPeriod=10` di agregat adalah false positive (§2d).

**Verdict:** paling padat (683 elemen, docH **5006** desktop / **7896** HP) tapi terstruktur: 13 landmark heading terurut. Yang paling mengganggu bukan slop — panjang halaman di HP (7.896px) dan 244 elemen berukuran 12–14px. Itu masalah informasi, bukan hiasan.

### Layar 8 — Silsilah compact `/silsilah/varian/compact` — 1 temuan *(sumber localhost:4599; **layar baru di branch, belum ada di live**)*

| # | Tanda | Lokasi | Usulan |
|---|---|---|---|
| 1 | **Color/Details: border tebal berwarna 2px** — `signs.md`: "neon or high contrast colored borders → hairline at 6–10% opacity" | `PersonCard.tsx:50` → `rounded-lg border-2 border-gold bg-cream p-3 shadow-sm` pada kartu terpilih. Terukur: `border-width 2px`, `border-color rgb(180,135,42)` | `border-2 border-gold` → `ring-1 ring-gold/30 bg-gold/5`. Sorot dengan surface step + hairline, bukan garis tebal. **Ini temuan paling kuat dari seluruh audit.** |

**Bukan temuan:** `glowShadows` = 4 di agregat ternyata `ring-2 ring-cream` (`CompactPedigree.tsx:122`) — cincin krem di sekitar dot penanda timeline, bukan glow (§2d). Arbitrary 8: `-left-[9px]` ×4 (posisi dot pada garis timeline — sah), `max-w-[10rem]` (bisa `max-w-40`), sisanya safe-area/z-index (sah). Pill 30: tab boleh pill, sisanya `rounded-md` (minor).

**Verdict:** konsep varian bagus dan lebih ringkas dari pohon (413 vs 760 elemen). Tipografinya bersih (0 italic, 0 uppercase, 6 ukuran font). Satu temuan nyata, dan karena ini kode baru yang belum merge — **perbaikannya paling murah sekarang**.

---

## 5. Peringkat 5 layar terburuk

Urutan berdasarkan jumlah dan bobot temuan. Perlu dicatat: **tidak ada layar yang "buruk"** — ini daftar "yang paling bisa diperbaiki", bukan "yang rusak".

1. **08 Silsilah compact** — 1 temuan tapi paling kuat (`border-2 border-gold`, garis tebal berwarna). Bonus: kode baru, belum merge, jadi perbaikannya paling murah.
2. **01 Beranda** — 4 temuan, dan satu-satunya dengan temuan tipografi berlapis: 4 teks 7px (keterbacaan), 4 uppercase, 1 italic, 14 `transition-all`.
3. **02 Silsilah pohon** — 3 temuan: 22 teks ≤10px, 82 pemakaian kelas arbitrary (12 token), 11 off-grid nyata. Kanvas paling kompleks dengan token paling berantakan.
4. **07 Dashboard/profil** — 1 temuan kecil (`transition-all` ×1), plus masalah non-slop: docH 7.896px di HP dan 244 elemen 12–14px.
5. **03 Silsilah daftar** — 2 temuan ringan: 53 pemakaian kelas arbitrary, 25 teks 11px.

**Sudah bersih, jangan disentuh:** **04 Galeri** (1 temuan opsional), **05 Login** (0 temuan), **06 Dashboard** (0 temuan).

---

## 6. Usulan arah desain (Direction)

Produk ini **sudah punya arah yang tertulis** di `src/app/globals.css:1-36`, dan arah itu benar — bukan template:

> "Hangat, Budaya Jawa" — cream/parchment (latar kertas tua & arsip keluarga), forest (wibawa & keteduhan), wood (kehangatan), gold sebagai satu-satunya aksen penanda warisan. Fraunces untuk judul, Plus Jakarta Sans untuk isi. Dial: publik ENERGY 3 / RHYTHM 3 / MOTION 3, dashboard 1/1/1.

Yang perlu ditambahkan bukan arah baru, tapi **menegakkan arah yang sudah ada**:

**Karakter.** Arsip keluarga Jawa yang tenang, bukan aplikasi SaaS yang bersemangat. Angka yang dipajang (109 anggota, 10 cabang, generasi ke-5) adalah warisan — mereka pantas jadi momen beraksen, bukan diejek dengan gerak di sekitarnya.

**Palet.** Pertahankan 4 token + 1 aksen. Yang bisa dirapikan: **jumlah warna teks** — 8–11 nilai per layar, termasuk beberapa varian `oklab(... / 0.75–0.8)` yang pada dasarnya sama. Turunkan ke **3 peran**: ink (`#221a11`), muted (`#5c5040`), dan forest/cream sesuai latar. Satu aksen gold sudah dipakai hemat dan benar.

**Momen beraksen — dua, bukan lebih.**
- Angka generasi: `109`, `10`, `5` di beranda sudah 48px `tabular-nums`. Biarkan besar; ini momen yang tepat.
- Kartu terpilih di kanvas pohon/compact: satu surface step + hairline emas, **bukan border 2px**. Inilah satu-satunya tempat yang perlu diubah agar sesuai arah yang sudah ada.

**Signature detail.** `motif-divider` — garis gelombang batik SVG 28×14px di `globals.css:69-73` — sudah jadi penanda keluarga yang konsisten dan hemat. Pertahankan, dan jadikan satu-satunya motif dekoratif. Pola titik 1px di kanvas pohon dianggap **pola grid fungsional**, bukan hiasan — boleh dipertahankan.

**Tipografi.** Skala 12→14→16→18→24→30→36→48→60 sudah sehat. Yang perlu: **larang di bawah 11px** untuk teks informatif (kini 7px di beranda, 9–10px di silsilah, 11px sebagai ukuran kerja di layar 2–3). Heading weight 600 sudah pas — jangan naikkan.

**Gerak.** Karena `transition-all` sebenarnya hanya dipakai di 16 tempat (bukan ratusan), ini bukan masalah sistemik seperti yang dikhawatirkan data lama. Yang perlu: ganti 16 pemakaian itu ke properti spesifik, dan pertahankan `prefers-reduced-motion` yang sudah benar di `globals.css:88`. Dial MOTION 3 untuk publik berarti "ada gerak, terasa", bukan "semua elemen beranimasi".

---

## 7. Rencana pass berurutan

Urutan mengikuti daftar pass di skill (spacing → color → icons → copy → type → layout → details → visuals → motion), dipangkas ke yang benar-benar ada temunya. Effort: S < 1 jam, M 1–3 jam, L > 3 jam.

**Pass 0 — Layanan gerak (kecil, 16 tempat)** — **S**
1. `transition-all` → properti spesifik di 16 tempat: `BranchCard.tsx:26`, `Scrollytelling.tsx:89` (beranda), `PersonNode.tsx:119` (silsilah), `PhotoUploader.tsx:93` (profil), plus yang tersisa di komponen bersama.
*Verifikasi: hitungan berbasis class (bukan computed) = 0 di semua layar. Skrip: `scripts/recount.mjs`.*

**Pass 1 — Layar 08 Silsilah compact** — **S** (kode baru, belum merge — paling murah sekarang)
1. `PersonCard.tsx:50`: `border-2 border-gold` → `ring-1 ring-gold/30 bg-gold/5`.
2. Pill non-avatar `rounded-full` → `rounded-md` (opsional).
3. `max-w-[10rem]` → `max-w-40` (opsional).

**Pass 2 — Layar 01 Beranda** — **M**
1. 4 teks 7px → 10px, atau pindah ke legenda di bawah diagram.
2. 4 uppercase → sentence case ("Babak 1..4", "Sebaran anggota per generasi").
3. Hapus `italic` pada "Belum ada anggota tercatat".
4. `max-w-[180px]` → `max-w-44`.

**Pass 3 — Layar 02 Silsilah pohon** — **M**
1. Token arbitrary → skala: `w-[168px]`×10 → `w-42`, `min-h-[420px]` → `min-h-[26rem]`, `pb-[69px]` → `pb-17`, `text-[9px]`×17 → `text-[11px]`, `text-[10px]`×2 → `text-xs`, `text-[11px]`×27 → `text-xs`, `text-[13px]`×10 → `text-sm`.
2. Off-grid nyata: `53px`×3 → `52px`, `15px`×8 → `16px`.
3. Badge status `rounded-full` → `rounded` (tab biarkan pill).

**Pass 4 — Layar 07 Dashboard/profil** — **S**
1. `PhotoUploader.tsx:93`: `transition-all` → `transition-box-shadow`.
2. Tombol "Ganti" pill → `rounded-md` (opsional).
3. Pertimbangkan collapsible untuk bagian form agar docH HP turun dari 7.896px (opsional, bukan slop).

**Pass 5 — Layar 03 Silsilah daftar** — **S**
1. `min-w-[110px]`×25 → `min-w-28`, `text-[11px]`×25 → `text-xs`.
2. Chip filter `rounded-full` → `rounded-md` (opsional).

**Pass 6 — Verifikasi** — **S**
Ulangi pengukuran CDP dan bandingkan dengan tabel §3. Target: `transition-all` berbasis class = 0, off-grid **nyata** (non auto-margin, non `sr-only`) = 0, ukuran font minimum 11px, jumlah warna teks ≤ 3 per layar, `uppercase` + `italic` = 0 kecuali ada alasan eksplisit. **Penting:** verifikasi harus memakai hitungan berbasis **class**, bukan computed style, agar tidak mengulang artefak di §2d.

---

## 8. Reproduksi

Semua angka berasal dari berkas di workspace `t_0358b266`:

| Berkas | Isi |
|---|---|
| `out/*.json` (16 berkas) | metrik CDP per layar; field `url` adalah kebenaran (`out/AGG.txt` salah label layar 02-HP). **Catatan: kolom `transitionAll`, `hoverScale`, `pulseClasses`, `glowShadows` di berkas ini memakai cara ukur yang bisa mewarisi — lihat §2d.** |
| `shots/*.png` (16 berkas) | screenshot; dimensi terukur dari header IHDR: desktop 1440×900, HP 390×844 |
| `out/detail/det-*.json` | sampel elemen (selector, box, teks) per layar |
| `scripts/recount.mjs` | hitung ulang `transition-all`/`hover:scale`/`animate-*` **berbasis class** — ini angka yang dipakai di §3 |
| `scripts/recount2.mjs` | hitung ulang kelas arbitrary per-token + border tebal berwarna |
| `scripts/dbg-source.mjs` | bukti 0 rule CSS eksplisit `transition-property: all`, dan elemen yang computed-`all` adalah warisan |
| `scripts/dbg-transition.mjs`, `scripts/dbg-transition2.mjs` | diagnostik perbandingan computed vs class |
| `scripts/probe.mjs`, `scripts/detail.mjs` | skrip pengumpul metrik asli |
| `scripts/verify-beranda.mjs`, `scripts/verify-screen.mjs` | verifikasi ulang CDP penuh |
| `scripts/table.py`, `scripts/fs2.py`, `scripts/detail2.py`, `scripts/anim.py`, `scripts/trail.py`, `scripts/keys2.py`, `scripts/detkeys.py`, `scripts/mainkeys.py`, `scripts/chk.py`, `scripts/chk2.py`, `scripts/inv.py`, `scripts/inv2.py`, `scripts/urlcheck.py`, `scripts/urlcheck2.py`, `scripts/imgcheck.py`, `scripts/finalcheck.py`, `scripts/glow.py` | pemeriksa bukti (dimensi PNG, field URL, kunci JSON, inventaris per layar, ukuran font, shadow) |

Verifikasi source yang dipakai untuk `file:line`: `grep -rn "transition-all" src/` → 4 tempat; `grep -rn "hover:scale\|group-hover:scale" src/` → 4 tempat; `grep -n "border-gold\|ring-gold" src/components/silsilah/varian/*` → `PersonCard.tsx:50`, `CompactPedigree.tsx:122`.

---

## 9. Yang tidak bisa diverifikasi (ditulis apa adanya)

- **Layar 06–08 dari branch, bukan live** (§2a). Angka 06–07 relevan untuk produksi; **angka 08 menggambarkan kode yang belum di-merge**.
- **Kartu menyebut `9f11a7d` sebagai kode ter-deploy** — tidak ditemukan; yang ter-deploy `7ec3b38` (§2c).
- **`/silsilah/varian/compact` tidak ada padanannya di live** sebagai halaman yang sama.
- **Metrik lama di `out/*.json` tidak bisa dipercaya untuk 4 kolom** (§2d). Saya tidak memperbaiki berkas JSON itu — saya laporkan angka benar di laporan ini dan jelaskan kenapa yang lama salah, supaya jejak asli tetap utuh.
- Sesi Chrome port 9444 **sudah login** sebagai `heal@gmail.com` (Tn. Wirjodihardjo). Saya tidak menebak kredensial, tidak membuat akun, tidak menyentuh data produksi.
- **Kontras WCAG per pasangan teks/latar belum diukur.** Yang tercatat hanya komentar di `globals.css:29` (`gold-light #d4af5c` = 5.94:1 lolos AA; `gold #b4872a` = 3.79:1 hanya untuk teks besar). Bila Bos mau, ini kartu terpisah.
- **`aria-label` pada `input#password` (layar 05) belum diverifikasi.**
- **Layar HP 02 (`?view=pohon`) hanya 206 elemen** dibanding desktop 760 — tampaknya tampilan HP tidak merender kanvas pohon yang sama. Saya tidak menyelidiki lebih jauh karena di luar cakupan kartu.
