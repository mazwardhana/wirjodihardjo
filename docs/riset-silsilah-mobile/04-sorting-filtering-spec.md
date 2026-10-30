# 04 — Spesifikasi Sorting & Filtering Silsilah

Kartu 3/4 (file kedua). Spesifikasi siap-implementasi untuk `/silsilah`.
Dasar: repo `/opt/projects/wirjodihardjo` HEAD `7a36c68`, DB produksi (read-only),
`01-benchmark-ux.md`, `02-evaluasi-teknologi-render.md`, `03-desain-mobile.md`.

## 0. Fakta dasar

| Item | Nilai terukur |
|---|---|
| Person total | 95 (84 simpul ter-render) |
| Generasi terpakai | 0 (3), 1 (13), 2 (11), 3 (13), 4 (22), 5 (19) |
| Cabang | 10 aktif; 84 orang di "Keluarga Soedjinah", 7 cabang 1 orang, 1 kosong |
| Gender | 56 MALE, 39 FEMALE (tidak ada `OTHER`) |
| Status | 85 hidup, 10 almarhum |
| Punya foto | 2 dari 95 |
| Tanpa relasi / tanpa cabang / `generationLevel` NULL | 11 / 3 / 3 orang |
| Param URL yang sudah ada | `q`, `branchId`, `generation`, `deceased` |

Konsekuensi desain: (1) **cabang belum berguna** — 84/95 orang di satu cabang;
tetap dipertahankan, tidak masuk WAJIB. (2) **Generasi paling berguna** — 6 nilai
seimbang, label Jawa sudah ada. (3) **"Punya foto" hampir selalu nol** (2/95) →
OPSIONAL. (4) **`generationLevel` nullable** → sortir & filter wajib punya
aturan nilai kosong.

## 1. Tabel kontrol → kegunaan → prioritas

### 1.1 Filter

| Kontrol | Param | Kegunaan | Cakupan | Prioritas |
|---|---|---|---|---|
| Generasi | `generation` | Saring satu tingkat; 6 nilai kini | Kanvas + daftar | **WAJIB** |
| Status hidup/meninggal | `deceased` | `true`/`false` | Kanvas + daftar | **WAJIB** (sudah ada) |
| Jenis kelamin | `gender` | `male`/`female` | Daftar + outline | **WAJIB** |
| Pencarian nama | `q` | Sudah ada; lihat §5.1 | Daftar | **WAJIB** (sudah ada) |
| Cabang | `branchId` | Saring satu keluarga cabang | Kanvas + daftar | SEBAIKNYA (sudah ada) |
| Dalam N langkah dari saya | `near` | `1`/`2`/`3`; kerabat terdekat | Daftar | SEBAIKNYA |
| Punya foto | `hasPhoto` | `true` | Daftar + Galeri | OPSIONAL |
| Nama panggilan terisi | `hasNick` | `true` | Daftar | OPSIONAL |
| Pernah menikah | `hasPartner` | `true` | Daftar | OPSIONAL |
| Tanpa relasi | `showDisconnected` | `true`; sudah didukung `buildTreeGraph` | Kanvas | OPSIONAL |

### 1.2 Sort

| Kontrol | Param | Kegunaan | Default | Prioritas |
|---|---|---|---|---|
| Nama A–Z | `sort=name` | Abjad Indonesia, case-insensitive | **ya (default daftar)** | **WAJIB** |
| Generasi | `sort=generation` | Naik dari leluhur | | **WAJIB** |
| Tahun lahir | `sort=birth` | Naik; hormati `birthDatePrecision` | | **WAJIB** |
| Cabang | `sort=branch` | Nama cabang A–Z lalu nama orang | | SEBAIKNYA |
| Jumlah anak | `sort=children` | Turun; "siapa keturunan terbanyak" | | SEBAIKNYA |
| Jumlah keturunan | `sort=descendants` | Turun; butuh CTE rekursif | | OPSIONAL |
| Terbaru ditambahkan | `sort=recent` | `createdAt desc`; admin | | OPSIONAL |

### 1.3 Tampilan & halaman

| Kontrol | Param | Kegunaan | Prioritas |
|---|---|---|---|
| Tampilan | `view` | `outline` (default HP) / `list` / `tree` / `gallery`; `03` §4.1 | **WAJIB** |
| Halaman | `page` | 1-based, 25/halaman (samakan `admin/anggota` `perPage = 25`) | **WAJIB** |
| Ukuran halaman | `perPage` | 10 / 25 / 50 / 100 (pola MyHeritage `[10]`) | SEBAIKNYA |

## 2. Pola UI mobile

Tiga `<select>` berjejer (kondisi sekarang) diganti chip + bottom-sheet.

```
┌──────────────────────────────────────┐ 390 px
│ [Cari nama…                    ] [Cari]
│ [Cabang ▾] [Generasi ▾] [+2 ▾]
│ 84 orang · Urut: Nama A–Z      [Reset]
│ ┌──────────────────────────────────┐
│ │ ( ) Wirjodihardjo  Leluhur  1930 │
│ └──────────────────────────────────┘
│ Menampilkan 1–25 dari 84
│ [◀ Sebelumnya]         [Berikutnya ▶]
└──────────────────────────────────────┘
```

Chip "+2" = **indikator jumlah filter aktif** di luar chip yang terlihat. Chip
aktif memakai `aria-pressed="true"` + `--color-parchment` + border
`--color-gold`. Setiap chip punya tombol ✕ inline (target 44 px) untuk menghapus
filter itu saja.

```
┌──────────────────────────────────────┐ 390 px, 92dvh
│ ────── (handle, area sentuh 44 px)
│ Filter & Urutkan              [Tutup]
│ GENERASI
│ ( ) Semua  (•) Anak ( ) Putu  ( ) Buyut
│ STATUS
│ (•) Semua  ( ) Masih hidup  ( ) Almarhum
│ JENIS KELAMIN
│ (•) Semua  ( ) Pria  ( ) Wanita
│ DEKAT DARI SAYA
│ (•) Semua  ( ) 1 langkah  ( ) 2  ( ) 3
│ URUTKAN BERDASARKAN
│ (•) Nama A–Z  ( ) Generasi  ( ) Tahun lahir  ( ) Jumlah anak
│ [Reset semua]              [Terapkan]
└──────────────────────────────────────┘
```

Aturan pola:

- **Bottom-sheet, bukan modal tengah.** `Dialog.tsx` baris 92 & 101 sudah
  mengimplementasikan `items-end` + `rounded-t-xl` + `max-h-[92dvh]` di bawah
  `sm`. Komponen baru memakai `Dialog size="md"` yang ada — bukan dialog baru.
- **Target sentuh ≥ 44 px** untuk semua baris radio, chip, tombol. Radio dibuat
  `<button role="radio">` supaya tinggi mudah dikontrol, bukan
  `<input type="radio">` 16 px.
- **Radio, bukan checkbox**, untuk grup filter tunggal: "Semua" adalah nilai
  eksplisit, tidak ada state "kosong vs semua" yang ambigu.
- **Sticky footer** "Reset semua" + "Terapkan"; **kunci gulir halaman** saat
  sheet terbuka — keduanya sudah dilakukan `Dialog`.
- **Tutup = batal.** Sheet hanya menulis URL saat "Terapkan" diketuk, jadi tidak
  ada request server per ketukan radio.
- **Keyboard:** `Esc` menutup, fokus terjebak di dalam sheet (keduanya sudah ada),
  "Terapkan" elemen terakhir dalam urutan tab.

## 3. Aturan penamaan & state URL

Semua state di URL, satu-satunya sumber kebenaran. Tidak ada state filter di
`useState` selain status buka/tutup sheet.

1. **camelCase**, konsisten dengan `branchId`, `deceased`.
2. **Nilai enum kecil-kecil tanpa spasi**: `male`, `female`, `true`, `false`,
   `name`, `birth`.
3. **Nilai kosong/"Semua" = param dihapus**, bukan `=all` atau `=""`. URL
   pendek dan bisa di-copy.
4. **Tidak ada duplikasi state.** `?view=` hanya tampilan; tidak ada param
   `tab` kedua.
5. **`page` di-reset ke 1** setiap kali filter atau sort berubah (§5.1).
6. **`q` hanya memengaruhi daftar**, tidak pernah kanvas — perilaku sekarang
   (`page.tsx` baris 33-34), dipertahankan.

### 3.1 Contoh URL konkret

```
/silsilah
    → default HP: view=outline, sort=name, page=1

/silsilah?view=list&sort=name&page=1
    → Daftar, nama A–Z, halaman 1

/silsilah?view=list&generation=1&gender=male&sort=birth&page=2
    → Pria generasi Anak, urut tahun lahir, halaman 2

/silsilah?branchId=8f3c…&generation=2&deceased=true&view=list&sort=name
    → Almarhum generasi Putu di satu cabang

/silsilah?view=list&near=2&sort=name
    → Kerabat 2 langkah dari saya (perlu login; tamu → diabaikan + pesan)

/silsilah?view=list&hasPhoto=true&sort=name
    → Punya foto (hari ini: 2 hasil)

/silsilah?view=tree&branchId=8f3c…&generation=1
    → Kanvas desktop, satu cabang, satu generasi

/silsilah?view=list&q=Soe&sort=name&page=1
    → Pencarian + daftar; q tidak menyentuh kanvas
```

### 3.2 Param yang diabaikan untuk tamu

| Param | Perilaku tamu |
|---|---|
| `near` | Diabaikan; tampilkan "Masuk untuk melihat kerabat terdekat", daftar tetap dirender tanpa filter relasi |
| `showDisconnected` | Diabaikan (khusus admin, sudah dibatasi `rbac`) |
| `hasPhoto` | Tetap berlaku (foto publik) |

## 4. Perilaku sort — aturan lengkap

| `sort` | Urutan primer | Tie-break | Nilai kosong |
|---|---|---|---|
| `name` (default) | `fullName` naik, case-insensitive | `generationLevel` naik, lalu `id` | — |
| `generation` | `generationLevel` naik | `fullName` naik | `NULL` selalu di akhir, urut `fullName` |
| `birth` | `birthDate` naik | `fullName` naik | `NULL` di akhir |
| `branch` | `branch.name` naik | `fullName` naik | Tanpa cabang (3 orang) di akhir |
| `children` | jumlah `PersonChild` anak turun | `fullName` naik | 0 ikut urutan, paling bawah |
| `descendants` | jumlah keturunan (CTE) turun | `fullName` naik | 0 |
| `recent` | `createdAt` turun | — | — |

Tie-break `id` **wajib** agar paginasi stabil: tanpa itu orang bisa muncul dua
kali di dua halaman atau hilang sama sekali.

Implementasi (`src/lib/data.ts`, fungsi baru di samping `searchPersons` baris 138):

```ts
export async function listPersons(opts: {
  branchId?: string; generationLevel?: number; isDeceased?: boolean;
  gender?: "MALE" | "FEMALE"; hasPhoto?: boolean; hasNick?: boolean;
  hasPartner?: boolean; q?: string;
  sort?: "name" | "generation" | "birth" | "branch" | "children" | "descendants" | "recent";
  page?: number; perPage?: number;
}) {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const perPage = [10, 25, 50, 100].includes(opts.perPage ?? 25) ? (opts.perPage as number) : 25;
  const where: Prisma.PersonWhereInput = { deletedAt: null };
  const [total, persons] = await Promise.all([
    prisma.person.count({ where }),
    prisma.person.findMany({
      where, select: publicPersonSelect,   // sudah ada, jangan diubah
      orderBy: orderFor(opts.sort),        // tabel di atas
      skip: (page - 1) * perPage, take: perPage,
    }),
  ]);
  return { persons, total, page, perPage, totalPages: Math.ceil(total / perPage) };
}
```

Catatan: **`deletedAt: null` wajib** — `searchPersons` sekarang tidak menyaringnya
dan `admin/anggota/page.tsx` baris 39 melakukannya; tanpa itu orang terhapus bisa
muncul di daftar publik (perubahan perilaku, lihat §7 no. 7).
**`children`/`descendants` tidak bisa satu `findMany`** — pakai agregat
`groupBy` lalu gabung di memori, atau raw SQL CTE; untuk 95 orang agregat cukup,
naikkan ke CTE kalau data > 5000. **`near`** = BFS dari `personId` pengguna atas
`PersonChild` + `PersonPartner` (dua arah); `treeLayout.ts` baris 265-275 sudah
punya pola BFS yang bisa ditiru, dan untuk 95 orang BFS di memori dari
`getFamilyTree()` sudah cukup.

## 5. Perilaku kombinasi

### 5.1 Filter + pencarian

- `q` dan filter **saling mempersempit (AND)**, bukan menggantikan. `q`
  mencocokkan `fullName`, `nickname`, `namaPanggilan` (`searchPersons` baris
  142-148); hasilnya lalu disaring `branchId`/`generation`/`gender`/`deceased`.
  Contoh: `?q=Soe&generation=1` → orang "Soe…" generasi Anak.
- **Hidden input wajib** di form pencarian supaya filter tidak hilang saat
  submit. Pola sudah ada di `page.tsx` baris 111-115 dan **harus diperluas** ke
  `gender`, `hasPhoto`, `sort`, `view`. Kalau tidak, menekan "Cari" diam-diam
  menghapus filter.
- **Reset** di sebelah kotak cari hanya menghapus `q` dan `page`, bukan filter
  (perilaku sekarang, `page.tsx` baris 25-31 — dipertahankan).
- **"Reset semua"** di bottom-sheet menghapus semua filter **dan** sort, tapi
  **mempertahankan `view` dan `q`**: pengguna yang mengetik nama lalu membuka
  sheet untuk mempersempit tidak kehilangan nama yang diketik.
- **`page` di-reset ke 1** setiap kali `q`, filter, atau `sort` berubah. Kalau
  pengguna di halaman 4 lalu mempersempit ke 5 hasil, ia akan melihat empty
  state yang membingungkan.

### 5.2 Filter memengaruhi kanvas atau hanya daftar?

Sekarang filternya memengaruhi keduanya (kanvas selalu dirender,
`page.tsx` baris 41-46). Keputusan:

| Param | Kanvas | Daftar | Outline (V1) | Galeri |
|---|---|---|---|---|
| `branchId` | **ya** | ya | ya | ya |
| `generation` | **ya** | ya | **tidak** | **tidak** |
| `deceased` | **ya** | ya | ya (penanda pita hitam) | ya |
| `gender` | tidak | ya | tidak | tidak |
| `hasPhoto` | tidak | ya | tidak | ya |
| `hasNick`, `hasPartner` | tidak | ya | tidak | tidak |
| `near` | tidak | ya | tidak | tidak |
| `sort` | **tidak** | ya | ya (urutan baris) | ya |
| `page` | tidak | ya | tidak | ya |
| `q` | **tidak** (sudah begitu) | ya | tidak | tidak |
| `view` | ya (memilih kanvas) | — | — | — |

Alasan: **`generation` tidak menyaring outline** karena menyaring satu level pada
tampilan bersarang menghasilkan 11-22 baris tanpa induk — hilang seluruh makna
"buku keluarga"; sebagai gantinya outline menyorot baris level itu.
**`sort` tidak pernah menyentuh kanvas** karena posisi simpul ditentukan
`buildTreeGraph` (deterministik, sudah diuji); mengurutkan simpul menurut nama
merusak geometri kontur dan anti-tumpuk. **`gender`, `hasPhoto`, `hasNick`,
`hasPartner`, `near` hanya daftar** karena itu filter data, bukan filter relasi;
menerapkannya pada kanvas memotong edge dan menghasilkan pohon patah-patah yang
menyesatkan. Filter kanvas tetap di URL supaya tautan bisa dibagikan dan tombol
"kembali" bekerja — bukan karena kanvas tempat utama pengguna HP bekerja
(`03`: default HP = outline).

### 5.3 Filter + sort saling bertentangan

- `sort=generation` + `generation=1` → filter menang; semua hasil satu level,
  sortir jatuh ke sekunder (`fullName`). Terapkan sortir **setelah** filter.
- `sort=children` + `hasPartner=false` → sah; `children` tetap menghitung anak
  biologis meski pasangan tidak tercatat.
- `page` > `totalPages` → setel `page = totalPages` (minimal 1) saat render,
  jangan tampilkan empty state. Kasus nyata: pengguna menghapus filter sambil
  berada di halaman 4.

## 6. Empty state

Aturan: **selalu jelaskan penyebabnya dan beri jalan keluar.** Tidak boleh
"Tidak ada data" polos. `EmptyState` sudah ada (`src/components/ui/States.tsx`)
dan menerima `title`, `description`, `action` — tidak perlu komponen baru.

| Kondisi | Judul + isi | Aksi |
|---|---|---|
| `q` tidak cocok, tanpa filter | "Anggota tidak ditemukan" — `Tidak ada anggota dengan nama "Soe".` | "Tampilkan seluruh pohon" (hapus `q` + `page`) |
| `q` + filter, nol hasil | "Tidak ada yang cocok" — `Tidak ada anggota bernama "Soe" di generasi Anak.` | "Hapus filter" (pertahankan `q`) |
| Filter tanpa `q`, nol hasil | "Belum ada anggota di saringan ini" — `Tidak ada anggota pada saringan: Generasi Anak, Pria.` | "Reset filter" |
| `hasPhoto=true`, nol hasil | "Belum ada foto" — `Foto anggota baru tersedia untuk 2 dari 95 orang.` | "Lihat semua anggota" |
| `view=gallery`, nol hasil | "Galeri masih kosong" | "Kembali ke Daftar" |
| Pohon nol simpul | "Belum ada data silsilah" | tautan ke admin |
| Halaman > total halaman | *(bukan empty state)* — diam-diam setel ke halaman terakhir | — |

## 7. Perilaku khusus + perlu keputusan Bos

1. **11 orang tanpa relasi.** Di pohon disembunyikan. Di daftar **muncul**
   (mereka tetap anggota). Outline: grup terpisah "Belum ada hubungan keluarga"
   di akhir, bukan diselipkan di tengah.
2. **3 orang tanpa cabang.** Muncul di daftar; chip "Cabang" menampilkan
   "Tanpa cabang (3)" sebagai opsi terakhir.
3. **3 orang `generationLevel` NULL.** Label memakai "Generasi belum diketahui"
   (`getGenerationLabel`, sudah ada). Di sortir `generation` mereka di akhir.
4. **`OTHER` gender.** Enum ada, data nol. Tetap sediakan opsi di sheet supaya
   tidak ada kode mati saat data masuk.
5. **`near` untuk tamu.** Param diabaikan + pesan. Jangan redirect ke `/login`.
6. **`perPage` bisa dimanipulasi** — batasi ke `[10, 25, 50, 100]`, nilai di luar
   jatuh ke 25 (kode §4). **`page` non-numerik atau ≤ 0** →
   `Math.max(1, parseInt(…))`, pola `admin/anggota/page.tsx` baris 30 dan
   `registrasi/anggota/page.tsx` baris 27.
7. **Keputusan Bos A — `deletedAt: null` pada daftar publik.** `searchPersons`
   sekarang tidak menyaringnya; menambahkannya mengubah perilaku yang sudah ada.
8. **Keputusan Bos B — `generation` tidak menyaring outline** (§5.2) adalah
   keputusan desain, bisa dibalik kalau Bos ingin perilaku seragam.
9. **Keputusan Bos C — `near` butuh `personId`.** `session.user` membawa `id`,
   `role`, `mustChangeCredentials` (`src/lib/auth.ts` baris 74-78) tetapi
   **bukan** `personId`. Perlu satu query
   `prisma.user.findUnique({ where: { id }, select: { personId: true } })` —
   pola sudah dipakai `profil/[id]/page.tsx` baris 21.
10. **`descendants` butuh CTE rekursif** yang belum ada di repo. Untuk 95 orang
    BFS di memori cukup; keputusan CTE bisa ditunda.
11. **`birthDatePrecision`** belum diperiksa seberapa sering terisi; sortir
    `birth` perlu memutuskan apakah "1930-an" diperlakukan sebagai 1930 atau
    sebagai nilai tidak bisa diurut.

Urutan kerja, semuanya tanpa menyentuh `treeLayout.ts`, `buildTreeGraph`, tes
geometri yang sudah hijau, atau skema Prisma: (1) `listPersons()` + tes unit
tie-break/`deletedAt`/batas `perPage` → `node --test` hijau; (2) parse +
normalisasi param URL → tes URL aneh menghasilkan nilai aman; (3) tab `view` +
seleksi tampilan → uji 390 px & 1280 px; (4) bottom-sheet + chip → target sentuh
≥ 44 px, `Esc`, fokus terjebak; (5) paginasi + reset `page` saat filter berubah
→ uji filter di halaman 4 jatuh ke halaman 1; (6) `near` BFS di memori;
(7) `hasPhoto`, `children`, `descendants` agregat.

## Sources

[10] https://www.myheritage.com/help/en/articles/12852432-what-are-the-myheritage-tree-views-and-how-can-they-be-useful-for-me — MyHeritage Help: List view (urut nama depan/belakang, tanggal, paginasi 10–100)

Nomor sumber mengikuti ledger `01` dan `02` (satu ledger bersama, tanpa sumber
web baru pada kartu ini — dasar spesifikasi adalah repo, DB produksi read-only,
dan dua kartu sebelumnya).
