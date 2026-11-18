# Kalkulator Relasi & Sapaan Kekerabatan

Modul: `src/lib/kinship.ts` (murni, tanpa Prisma/I/O) · UI: `src/components/silsilah/KinshipCalculator.tsx`
Tes: `src/lib/kinship.test.ts` (21 kasus) · Komponen pemicu: `FamilyTreeCanvas.tsx` (tombol "Kalkulator Relasi")

## 1. Tujuan

Menjawab pertanyaan "X itu siapa dari Y?" untuk dua anggota keluarga mana pun di pohon
silsilah Wirjodihardjo, memakai **lowest common ancestor (LCA)** lalu memetakan hasilnya
ke **sapaan Indonesia + istilah Jawa**.

## 2. Algoritma

1. **Bangun graf orang tua → anak** dari edge `PersonChild`, dengan dua aturan:
   - edge `isStep = true` **dilewati** (bukan hubungan darah);
   - edge `isAdopted = true` **diikutkan** (anak angkat tetap kerabat).
2. **Pasangan langsung** dicek lebih dulu dari edge `PersonPartner` → `SPOUSE`.
3. **LCA** dihitung BFS dua arah: kumpulkan seluruh leluhur A beserta jaraknya
   (`distA`), lalu telusuri leluhur B dan pilih simpul bersama dengan
   `distA + distB` terkecil. Hasil: `{ lca, distA, distB }`.
   Graf boleh berupa DAG (orang tua lebih dari satu); bila ada beberapa kandidat,
   dipilih yang total jaraknya terkecil sehingga hasilnya "terdekat".
4. **Klasifikasi** dari pasangan `(distA, distB)`:

| Kondisi | `kind` | Arti |
|---|---|---|
| `a.id === b.id` | `SELF` | orang yang sama |
| ada edge pasangan | `SPOUSE` | suami/istri |
| `distA === 0` | `ANCESTOR` | A leluhur langsung B |
| `distB === 0` | `DESCENDANT` | A keturunan langsung B |
| `distA = 1, distB = 1` | `SIBLING` | saudara kandung |
| `distA === distB > 1` | `COUSIN` | sepupu ke-(distA−1) |
| `removed = 1, minDist = 1` | `UNCLE_AUNT` / `NIECE_NEPHEW` | paman/bibi ↔ keponakan |
| sisanya | `COUSIN_REMOVED` | sepupu dengan selisih generasi |

## 3. Aturan sapaan

### Ke atas (leluhur) — `getAncestorLabel(level, gender)`
| level | Laki-laki | Perempuan | Netral |
|---|---|---|---|
| 1 | Ayah | Ibu | Orang Tua |
| 2 | Kakek | Nenek | Kakek/Nenek |
| 3+ | istilah Jawa dari `GENERATION_LABELS`: Buyut (3), Canggah (4), Wareng (5), Udheg-udheg (6), … Trah tumerah (18) | idem | idem |

### Ke bawah (keturunan) — `descendantLabel(level)`
1 = Anak · 2 = Cucu · 3 = Cicit (Buyut) · 4+ = "Keturunan generasi ke-N"

### Saudara — `siblingLabel(a, b)`
Dibandingkan lewat `birthDate`: lebih tua → **Kakak**, lebih muda → **Adik**,
tanggal sama/tidak diketahui → **Saudara kandung**.

### Paman / Bibi — `uncleAuntLabel(senior, connectingParent)`
Jawa membedakan paman/bibi berdasarkan urutan umur terhadap **orang tua si keponakan**:

| Gender senior | Lebih tua dari orang tua | Lebih muda |
|---|---|---|
| Laki-laki | **Pakdhe** | **Om** |
| Perempuan | **Budhe** | **Tante** |
| tidak diketahui / tanggal kosong | Paman | Bibi |

`connectingParent` = orang tua si junior yang bersaudara dengan si senior (anak dari LCA).
Bila tanggal lahir tidak ada, dipakai bentuk netral (Paman/Bibi) — bukan menebak.

### Sepupu
- `distA === distB`, `distA = 2` → **Sepupu**
- `distA = 3` → **Sepupu dua kali**, seterusnya "Sepupu N kali"
- selisih generasi (`removed > 0`) → **Sepupu sekali / Sepupu N kali (M generasi terpisah)**
- Deskripsi menyebut leluhur bersama dengan **nama** (mis. "berbagi nenek Sustini"),
  tidak pernah menampilkan id internal.

## 4. Batasan yang dicatat (AC opsional adopsi/pernikahan silang)

1. **Anak angkat**: edge `isAdopted` diikutkan, tetapi labelnya sama dengan anak kandung —
   sistem tidak membedakan "anak angkat" pada sapaan.
2. **Hubungan tiri**: edge `isStep` dikecualikan; saudara/orang tua tiri tidak menghasilkan
   sapaan kekerabatan (akan tampil "tidak ditemukan hubungan").
3. **Pernikahan silang**: hanya pasangan **langsung** yang dikenali (suami/istri, dari
   `PersonPartner`). Jalur ipar (mis. "adik ipar", "besan", "menantu") **belum** dihitung —
   kalkulator tidak menelusuri relasi lewat pasangan orang lain.
4. **Tanggal lahir kosong**: sapaan berbasis urutan umur (Kakak/Adik, Pakdhe/Om, Budhe/Tante)
   turun ke bentuk netral. Di data Wirjodihardjo hampir semua `birthDate` kosong, sehingga
   dalam praktik sering muncul "Saudara kandung"/"Paman"/"Bibi" alih-alih varian Jawa spesifik.
5. **Kakek/nenek dari dua sisi**: LCA memilih leluhur dengan jarak total terkecil; bila dua
   kakek berjarak sama, yang dipilih bergantung urutan penelusuran (deterministik, tetapi
   tidak memilih "sisi ayah" vs "sisi ibu" secara semantik).
6. **Nama leluhur ganda**: bila LCA tidak ditemukan di daftar `persons`, deskripsi memakai
   frasa generik ("berbagi N generasi ke atas").

## 5. Cara pakai di UI

1. Buka `/silsilah` → tombol **"🔗 Kalkulator Relasi"** di toolbar kanvas.
2. Pilih **Orang pertama** dan **Orang kedua** dari dropdown (seluruh anggota, urut alfabet).
3. Hasil tampil langsung: "X adalah [sapaan] dari Y", kalimat penjelas, dan arah sebaliknya.
4. State yang ditangani: belum memilih, orang sama, dan tidak ada hubungan (keluarga berbeda
   atau data belum terhubung).

Perhitungan berjalan **sepenuhnya di client** memakai data pohon yang sudah dimuat halaman —
tidak ada request tambahan.

## 6. Verifikasi (bukti terukur)

| Item | Hasil |
|---|---|
| Tes algoritma | **21/21 lulus** (`npx tsx --test src/lib/kinship.test.ts`) |
| `tsc --noEmit` file kartu | exit **0** (tsconfig terisolasi `tsconfig.kinship.json`) |
| Build produksi HEAD bersih | exit **0** (`npm run build`, Next 16.3.6 Turbopack) |
| UI nyata (data DB 109 orang) | 4 pasangan terverifikasi: Ibu→Anak, Kakek→Cucu, Saudara, Sepupu |
| Screenshot | 6 PNG + `hasil-kalkulator.json` |

Catatan: `npm run build` pada working tree **gagal** karena file kalender (kartu lain,
masih untracked) — bukan karena modul ini. Build dari snapshot HEAD bersih `c070265`
(plus perbaikan `54b47da`) exit 0.
