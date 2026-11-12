# DESIGN.md — Wirjodihardjo

Sumber kebenaran visual. Setiap keputusan tampilan merujuk ke berkas ini.

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

## 2. Sistem Satu Ramp Warna + SATU Aksen

Sistem ini menggunakan **satu netral ramp** dan **satu warna aksen**. Tidak ada gradient, tidak ada kombinasi warna acak.

### Netral Ramp (satu skala)
| Token | Nilai | Peran |
|---|---|---|
| `--color-neutral-50` | `#fafafa` | Latar ultra-putih |
| `--color-neutral-100` | `#f5f5f5` | Latar utama (kertas) |
| `--color-neutral-200` | `#e5e5e5` | Batas/garis pembatas |
| `--color-neutral-300` | `#d4d4d4` | Teks sekunder faint |
| `--color-neutral-400` | `#aqaqaq` | Teks/border ringan |
| `--color-neutral-500` | `#737373` | Teks deskripsi |
| `--color-neutral-600` | `#525252` | Teks utama pada latar terang |
| `--color-neutral-700` | `#3f3f3f` | Teks penting |
| `--color-neutral-800` | `#262626` | Teks pada latar terang gelap |
| `--color-neutral-900` | `#171717` | Teks latar terang gelap |

### SATU Aksen: Gold |
| Token | Hex | Peran |
|---|---|---|
| `--color-gold` | `#b4872a` | **Satu-satunya aksen**. Latar tombol, garis penanda, hover state. |
| `--color-gold-soft` | `#d4af5c` | Teks aksen di atas forest |

**Aturan warna (dari matriks kontras WCAG AA):

1. `bg-gold` + `text-ink` = 5.26:1 ✓ (hanya kombinasi emas yang diizinkan untuk teks)
2. Di atas forest: `text-cream` (10.97:1) atau `text-gold-light` (5.94:1)
3. `text-cream` di atas parchment DILARANG (1.13:1). Gunakan `text-forest` (9.71:1) atau `text-ink`.
4. `text-gold` DILARANG untuk teks apa pun di latar terang. Gunakan `text-gold-deep` (5.51 di cream).
5. `wood-soft` di atas parchment gagal (4.25). Pakai `wood` (6.13:1).

---

## 3. Skala Tipografi

Font: **Fraunces** (`font-display`, judul) + **Plus Jakarta Sans** (`font-sans`, isi).

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

**Dilarang:**
- Ukuran teks di bawah 12px.
- Ukuran isi form di bawah 16px (memicu auto-zoom iOS).
- Lebih dari 2 bobot font pada satu layar.

---

## 4. Skala Jarak

Hanya nilai ini yang boleh muncul. Tidak ada `mt-5`, `gap-7`, `p-[13px]`.

`0 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` (px) → `0 · 1 · 2 · 3 · 4 · 6 · 8 · 12 · 16` (Tailwind)

Irama halaman: seksi besar `py-12 sm:py-16`, jarak antar kartu `gap-4`,
padding dalam kartu `p-4 sm:p-6`.

---

## 5. Sudut, Bayangan, Gerak

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

## 6. Resep Komponen (salin apa adanya)

### Tombol utama (emas)
```tsx
<button className="min-h-11 rounded-sm bg-gold text-ink transition-colors hover:bg-gold-deep hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50">
  Simpan
</button>
```

### Tombol utama (forest)
```tsx
<button className="min-h-11 rounded-sm bg-forest text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
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

## 7. Daftar Terlarang (anti-slop eksplisit)

Pola berikut terbaca sebagai hasil mesin. Jangan pakai.

1. **Gradient ungu-biru** apa pun, atau gradient apa yang bukan turunan token warna.
2. **Gradient text** (text dengan warna gradient).
3. **Glow effect** (seperti `shadow-glow`, `glow`, bayangan yang terlalu kuat).
4. **Blurred blobs** (abstrak-geometry latar, gradient blur).
5. **Emoji sebagai ikon**. Pakai `react-icons` dengan ukuran konsisten.
6. **Sparkles/badge New-Pro-Beta** tanpa diminta.
7. **Font default** Inter-Roboto-Arial-Space Grotesk.
8. **Grid bukan kelipatan 4px**.
9. **Sentence-case** dilarang — gunakan case yang konsisten (judul case atau lowercase).
10. **Lebih dari 2 bobot font** pada satu layar/satu halaman.
11. State *incomplete*: missing empty state, loading state tanpa indikator progres, error state tanpa pesan, hover state tanpa visual balasan, selected state tanpa highlight.
12. **Signature detail unik** tanpa desain sistem — setiap komponen harus mengikuti token yang terdefinisi.

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
| PWA | 5 sinyal `pwa` semua `true` | audit UI |
| Tes | tidak ada regresi | `npx tsx --test $(git ls-files '*.test.ts' '*.test.tsx')` |
| Tipe | 0 error | `npx tsc --noEmit` |
| Build | sukses | `npm run build` |

Target akhir tiap halaman: `summary.pass === true`.

---

## 9. PWA dan Tampilan Mobile

Sinyal wajib di `<head>` (diperiksa audit UI, kunci `pwa`):

| Sinyal | Sumber | Akibat bila hilang |
|---|---|---|
| `viewport-fit=cover` | `viewport.viewportFit` di `src/app/layout.tsx` | `env(safe-area-inset-*)` = 0, nav bawah tertutup home indicator iPhone |
| `link[rel=manifest]` | `metadata.manifest` | tidak bisa dipasang |
| `meta[name=theme-color]` | `viewport.themeColor` | bilah status tidak sewarna aplikasi |
| `meta[apple-mobile-web-app-capable=yes]` | `metadata.appleWebApp.capable` | iOS membuka dengan bilah Safari |
| CSS `safe-area-inset` | `globals.css` + `pt-[env(safe-area-inset-top)]` di Navbar | konten atas tertutup poni |

**Warna PWA tidak boleh diketik manual.** `theme_color`, `background_color`, dan
warna ikon dibaca dari token: `src/lib/theme-tokens.ts` untuk manifest,
`src/app/globals.css` untuk `scripts/generate-logo.mjs`. `theme-tokens.test.ts`
gagal bila ketiganya berbeda. Palet lama (`#FFFBF5`, `#1A4D2E`) dilarang.

**Manifest dibuat di `src/app/manifest.ts`**, bukan `public/manifest.json`,
supaya nilainya bisa memakai token dan tidak ada dua sumber kebenar.

**Service worker.** `public/sw.js` tidak di-commit; ia dibangun dari
`scripts/sw-template.js` oleh `scripts/build-sw.mjs` sebagai bagian dari
`npm run build`. Versi cache memakai `.next/BUILD_ID` supaya setiap deploy
membuang cache lama. `Cache-Control: no-cache` untuk `/sw.js` diatur di
`next.config.ts`. Halaman luring ada di `/offline` dan di-pra-cache.

**Aturan sentuh mobile:** nav bawah hanya tampil di bawah `md`, disembunyikan di
`/admin`, `/login`, `/onboarding`, `/sso`. Body diberi padding bawah lewat
`body:has(.member-bottom-nav:not([hidden]))` di `globals.css`, jadi halaman
tanpa nav tidak kena padding ganda.

**Gerbang aset:** `pwa-assets.test.ts` memastikan setiap ikon dan splash yang
dirujuk `layout.tsx` benar-benar ada dan tidak kosong. Menghapus aset tanpa
mengubah rujukannya menggagalkan tes.

**Ikon maskable:** Android memotong sampai lingkaran 80% kanvas. Konten harus
seluruhnya di dalam lingkaran itu, tapi jangan terlalu kecil: target ~55% lebar
kanvas (monogram 41% terlihat kecil di peluncur).
