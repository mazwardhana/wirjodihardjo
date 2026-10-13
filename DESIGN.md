# DESIGN.md — Wirjodihardjo

Sumber kebenaran visual. Setiap keputusan tampilan merujuk ke berkas ini.
Angka kontras di bawah **diukur**, bukan diperkirakan. Bila mengubah token,
hitung ulang matriksnya sebelum commit.

Arah desain: **Hangat, Budaya Jawa, Arsip Keluarga.** Kesan kertas tua dan
arsip warisan, bukan dasbor SaaS modern.

---

## 1. Prinsip (dan akibatnya di kode)

| Prinsip | Artinya di kode |
|---|---|
| Warna membawa makna | forest = utama/identitas, wood = sekunder, gold = aksen penanda warisan. Jangan pakai gold untuk teks panjang. |
| Arsip, bukan startup | Sudut kecil (`rounded-sm` 2px, `rounded-md` 6px). Hindari pil penuh kecuali badge. |
| Terbaca lintas usia | Audiens keluarga besar termasuk sepuh. Ukuran dasar 16px, target sentuh 44px, kontras tinggi. Ini fitur, bukan beban. |
| Satu hal utama per layar | Satu elemen dominan, satu pendukung, sisanya redup. Kalau semua permukaan sama, tidak ada yang terbaca utama. |
| Gerak menahan diri | Transisi ≤300ms, jangan animasi properti layout, hormati `prefers-reduced-motion`. |

---

## 2. Token warna

Didefinisikan di `src/app/globals.css` blok `@theme`. **Tidak ada hex di luar
berkas ini.**

| Token | Hex | Peran |
|---|---|---|
| `--color-cream` | `#f7f1e2` | Latar utama (kertas) |
| `--color-parchment` | `#efe3c8` | Latar sekunder, panel terangkat |
| `--color-ink` | `#221a11` | Teks utama |
| `--color-muted` | `#5c5040` | Teks sekunder |
| `--color-forest` | `#1f3a2b` | Warna identitas, header, teks penting |
| `--color-forest-soft` | `#2c4f3b` | Hover/varian forest |
| `--color-wood` | `#6f4a2b` | Sekunder, aksen hangat |
| `--color-wood-soft` | `#8a6238` | Hover/varian wood |
| `--color-gold` | `#b4872a` | Aksen warisan (LATAR tombol, bukan teks di latar terang) |
| `--color-gold-deep` | `#7d5b16` | Teks aksen di latar terang |
| `--color-gold-light` | `#d4af5c` | Teks aksen di atas forest |

### Matriks kontras terukur (WCAG AA = 4.5:1 teks normal, 3:1 teks besar)

Baris = warna teks, kolom = warna latar.

| teks ↓ / latar → | cream | parchment | forest | wood | gold |
|---|---|---|---|---|---|
| **ink** | 15.23 ✓ | 13.48 ✓ | 1.39 ✗ | 2.20 ✗ | **5.26 ✓** |
| **muted** | 6.96 ✓ | 6.16 ✓ | 1.58 ✗ | 1.01 ✗ | 2.41 ✗ |
| **forest** | 10.97 ✓ | 9.71 ✓ | 1.00 ✗ | 1.58 ✗ | 3.79 ✗ |
| **forest-soft** | 8.14 ✓ | 7.21 ✓ | 1.35 ✗ | 1.18 ✗ | 2.81 ✗ |
| **wood** | 6.93 ✓ | 6.13 ✓ | 1.58 ✗ | 1.00 ✗ | 2.39 ✗ |
| **wood-soft** | 4.80 ✓ | 4.25 ✗ | 2.29 ✗ | 1.44 ✗ | 1.66 ✗ |
| **gold** | 2.89 ✗ | 2.56 ✗ | 3.79 ✗ | 2.39 ✗ | 1.00 ✗ |
| **gold-deep** | 5.51 ✓ | 4.88 ✓ | 1.99 ✗ | 1.26 ✗ | 1.91 ✗ |
| **gold-light** | 1.85 ✗ | 1.64 ✗ | **5.94 ✓** | 3.75 ✗ | 1.57 ✗ |
| **cream** | 1.00 ✗ | **1.13 ✗** | 10.97 ✓ | 6.93 ✓ | 2.89 ✗ |

### Aturan yang lahir dari matriks

1. **Tombol emas: `bg-gold` + `text-ink`** (5.26 ✓). **Dilarang**
   `bg-gold text-forest` (3.79 ✗) — pola ini tersebar di banyak berkas dan
   wajib diperbaiki saat menyentuh berkasnya.
2. **Di atas forest: `text-cream` (10.97 ✓) atau `text-gold-light` (5.94 ✓).**
   Dilarang `text-gold` (3.79 ✗) dan `text-gold-deep` (1.99 ✗).
3. **`text-cream` di atas parchment DILARANG** (1.13:1, praktis tak terlihat).
   Untuk teks di atas parchment pakai `text-forest` (9.71 ✓) atau `text-ink`.
4. **`text-gold` tidak boleh dipakai untuk teks apa pun di latar terang.**
   Gunakan `text-gold-deep` (5.51 di cream).
5. **`wood-soft` di atas parchment gagal** (4.25). Pakai `wood` (6.13 ✓).

---

## 3. Skala tipografi

Font: **Fraunces** (`font-display`, judul) + **Plus Jakarta Sans**
(`font-sans`, isi). Dimuat lewat `next/font/google` di `src/app/layout.tsx`.

| Peran | Kelas | Ukuran / berat | Catatan |
|---|---|---|---|
| Display | `font-display text-4xl sm:text-5xl` | 36→48 / 600 | Judul halaman publik |
| H1 | `font-display text-3xl` | 30 / 600 | Judul seksi utama |
| H2 | `font-display text-xl` | 20 / 600 | Judul kartu besar |
| H3 | `font-display text-lg` | 18 / 600 | Judul kartu |
| Body besar | `text-base` | 16 / 400 | Paragraf utama |
| Body | `text-sm` | 14 / 400 | Teks pendukung |
| Caption | `text-xs` | 12 / 500 | Hanya label, **bukan** isi form |
| Angka | `tabular-nums` | — | Wajib untuk statistik, jumlah, tanggal di tabel |

**Dilarang:** ukuran teks di bawah 12px. Ukuran isi form di bawah 16px
(memicu auto-zoom iOS).

---

## 4. Skala jarak

Hanya nilai ini yang boleh muncul. Tidak ada `mt-5`, `gap-7`, `p-[13px]`.

`0 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` (px) → `0 · 1 · 2 · 3 · 4 · 6 · 8 · 12 · 16` (Tailwind)

Irama halaman: seksi besar `py-12 sm:py-16`, jarak antar kartu `gap-4`,
padding dalam kartu `p-4 sm:p-6`.

---

## 5. Sudut, bayangan, gerak

| Token | Nilai | Pakai untuk |
|---|---|---|
| `rounded-sm` | 2px | Tombol, badge, input |
| `rounded-md` | 6px | Kartu kecil |
| `rounded-lg` | 10px | Panel besar, modal |

Bayangan: `shadow-sm` untuk kartu diam, `shadow-md` untuk elemen melayang
(modal, dropdown, kartu terangkat). **Maksimum dua tingkat.** Kalau semua
permukaan berbayang sama, tidak ada yang terbaca utama.

Gerak: `duration-200` standar, `duration-300` maksimum. Pakai `--ease-warm`.
Jangan animasi `width`/`height`/`top`/`left`. Selalu hormati
`prefers-reduced-motion` (lihat `src/components/ui/Reveal.tsx`).

---

## 6. Resep komponen (salin apa adanya)

### Tombol utama (emas)
```tsx
<button className="min-h-11 rounded-sm bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50">
  Simpan
</button>
```

### Tombol utama (forest)
```tsx
<button className="min-h-11 rounded-sm bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
  Daftar
</button>
```

### Tombol sekunder
```tsx
<button className="min-h-11 rounded-sm border border-wood/35 px-4 py-2.5 text-sm font-semibold text-wood transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
  Batal
</button>
```

### Kartu anggota
```tsx
<article className="rounded-lg border border-wood/15 bg-cream p-4 shadow-sm sm:p-6">
  <div className="flex items-start gap-4">
    <img src={foto} alt="" width={56} height={56} className="size-14 rounded-sm object-cover" />
    <div className="min-w-0">
      <h3 className="font-display text-lg font-semibold text-forest">{nama}</h3>
      <p className="text-sm text-muted">{cabang}</p>
    </div>
  </div>
</article>
```

### Field form (perhatikan font 16px)
```tsx
<label className="block">
  <span className="text-sm font-medium text-forest">Nama lengkap</span>
  <input
    className="mt-2 block min-h-11 w-full rounded-sm border border-wood/30 bg-cream px-3 text-base text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    type="text"
  />
</label>
```

### Empty state (selalu ada aksi)
```tsx
<div className="rounded-lg border border-dashed border-wood/25 bg-parchment/40 px-6 py-10 text-center">
  <Icon className="mx-auto size-8 text-wood" aria-hidden="true" />
  <p className="mt-3 font-display text-lg text-forest">Belum ada album</p>
  <p className="mt-1 text-sm text-muted">Album akan tampil di sini setelah dibuat.</p>
  <button className="mt-4 min-h-11 rounded-sm bg-forest px-5 py-2.5 text-sm font-semibold text-cream">
    Buat album pertama
  </button>
</div>
```

### Badge status
```tsx
<span className="inline-flex min-h-6 items-center rounded-sm bg-forest/10 px-2 py-0.5 text-xs font-medium text-forest">
  Terbit
</span>
```

### Baris data di HP (label di atas, nilai di bawah)
```tsx
<div className="flex flex-col gap-1 border-b border-wood/10 py-3 sm:flex-row sm:items-center sm:justify-between">
  <span className="text-xs font-medium text-muted">Jumlah kehadiran</span>
  <span className="text-sm font-semibold tabular-nums text-ink">1.284</span>
</div>
```

---

## 7. Daftar terlarang (anti-slop)

Pola berikut terbaca sebagai hasil mesin. Jangan pakai.

1. Gradient ungu-biru, atau gradient apa pun yang bukan turunan token.
2. Emoji sebagai ikon. Pakai set ikon (react-icons) dengan ukuran konsisten.
3. Tiga kartu fitur berikon di tengah sebagai isi utama halaman.
4. Semua rata tengah, termasuk teks panjang.
5. Warna literal (hex/rgb) di luar `globals.css`.
6. Sudut berbeda-beda antar komponen di satu layar.
7. Empty state tanpa aksi. Selalu: ikon + satu kalimat + satu tombol.
8. Label placeholder ("Data 1", "Item", "Lorem").
9. Transisi >300ms, atau animasi properti layout.
10. Bayangan seragam di semua permukaan.
11. Testimoni atau statistik karangan.
12. Gambar tanpa `width`/`height` (atau `fill` dengan induk berposisi).

---

## 8. Checklist sebelum kirim

Jalankan dan tempel angkanya. Klaim "selesai" tanpa output tidak diterima.

| Gerbang | Ambang | Cara ukur |
|---|---|---|
| Kontras teks | ≥ 4.5:1 (≥3:1 untuk ≥24px / ≥18.66px tebal) | audit UI |
| Target sentuh | ≥ 44×44 px | audit UI |
| Font input | ≥ 16 px | audit UI |
| Scroll horizontal | tidak ada di 360px | audit UI |
| Warna hardcode | 0 di luar `globals.css` | audit UI |
| Gambar | punya `width`+`height` atau `fill` | audit UI |
| Tes | tidak ada regresi | `npx tsx --test $(git ls-files '*.test.ts' '*.test.tsx')` |
| Tipe | 0 error | `npx tsc --noEmit` |
| Build | sukses | `npm run build` |

Target akhir tiap halaman: `summary.pass === true`.
