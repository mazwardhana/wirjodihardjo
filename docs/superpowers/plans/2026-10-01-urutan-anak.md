# Plan: Urutan anak pada silsilah

## Spec

Fitur: admin dapat menentukan urutan anak (anak ke-1, ke-2, ke-3). Anak dengan
nomor lebih kecil tampil lebih kiri di pohon silsilah.

Keputusan yang mengikat:

- **Grup saudara = himpunan orang tua yang identik.** Anak dari pasangan A+B
  punya urutan sendiri; anak A dengan pasangan lain punya urutan terpisah.
  Nomor urut adalah milik ANAK di dalam grup, bukan milik satu edge.
- **Suami-istri berbagi satu urutan.** `PersonChild` adalah baris per-edge
  (ayah->anak dan ibu->anak adalah dua baris). Kedua baris untuk anak yang sama
  WAJIB bernilai `orderIndex` yang sama. Setiap penulisan urutan harus
  menyinkronkan seluruh baris milik anak itu.
- **Data lama di-backfill memakai `createdAt`** supaya tampilan pohon tidak
  berubah setelah migrasi.
- **UI admin memakai tombol naik/turun**, tanpa dependensi baru.
- **Tidak ada badge nomor** di kartu simpul silsilah; nomor hanya alat atur.
- **Aturan baca**: `orderIndex` naik dulu, lalu fallback tanggal lahir paling
  tua (anak tanpa tanggal di akhir), lalu `id` sebagai pemecah seri terakhir
  agar deterministik.

## Global Constraints

- Bahasa Indonesia untuk komentar dan pesan UI.
- Tanpa emoji, tanpa em dash di kode dan teks baru.
- Migrasi bersifat ADITIF saja. Jangan mengubah atau menghapus kolom lama.
- JANGAN menjalankan migrasi terhadap basis data produksi
  (`127.0.0.1:5434`). Produksi dimigrasi terpisah saat deploy.
- Buat SATU commit lokal per task (pesan bahasa Indonesia, format
  `feat(silsilah): ...` atau `fix(silsilah): ...`). JANGAN `git push`.
  Controller yang menangani push dan deploy.
- Jangan mengubah berkas di luar yang disebut di tiap task.
- Tes dijalankan dengan `npx tsx --test <berkas>`.
- Jalur tulis `PersonChild` yang ada: `src/app/api/admin/relasi/route.ts`,
  `src/app/api/pengajuan/review/route.ts`,
  `src/app/api/profil/relations/route.ts`, `prisma/seed.ts`.

## Task 1: Skema dan migrasi kolom orderIndex

Tambah kolom urutan ke `PersonChild` dan buat migrasi aditif.

Berkas:
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_person_child_order_index/migration.sql` (baru)

Langkah:
1. Di model `PersonChild`, tambah field `orderIndex Int @default(0)` dan
   index `@@index([parentId, orderIndex])`. Pertahankan semua field, relasi,
   `@@unique([parentId, childId])`, dan index lain yang sudah ada.
2. Buat direktori migrasi baru dengan nama
   `20261001120000_add_person_child_order_index` dan tulis `migration.sql`
   berisi tepat tiga bagian:

```sql
-- Kolom urutan anak. Aditif: nilai default 0, aman untuk baris lama.
ALTER TABLE "PersonChild" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- Index untuk membaca anak terurut per orang tua.
CREATE INDEX "PersonChild_parentId_orderIndex_idx" ON "PersonChild"("parentId", "orderIndex");

-- Backfill: pertahankan urutan tampilan sekarang (createdAt) supaya pohon
-- tidak berubah setelah migrasi. Nomor dihitung PER ANAK, bukan per baris,
-- agar baris ayah dan ibu untuk anak yang sama mendapat nomor yang sama.
-- Grup saudara = himpunan orang tua identik (diurutkan).
WITH child_group AS (
  SELECT "childId",
         array_agg(DISTINCT "parentId" ORDER BY "parentId") AS parents,
         MIN("createdAt") AS first_seen
  FROM "PersonChild"
  GROUP BY "childId"
),
child_rank AS (
  SELECT "childId",
         ROW_NUMBER() OVER (PARTITION BY parents ORDER BY first_seen, "childId") - 1 AS rn
  FROM child_group
)
UPDATE "PersonChild" pc
SET "orderIndex" = cr.rn
FROM child_rank cr
WHERE pc."childId" = cr."childId";
```

3. Regenerasi klien Prisma supaya tipe TypeScript mengenal `orderIndex`:
   `npx --yes prisma@7.10.0 generate`.
4. JANGAN menjalankan `migrate dev` atau `migrate deploy` ke produksi.

Kriteria selesai:
- `npx --yes prisma@7.10.0 validate` lolos.
- `npx tsx --test $(find src -name '*.test.ts' | sort)` tetap lulus semua
  (jumlah lulus tidak berkurang).

## Task 2: Helper urutan anak

Buat modul helper murni plus akses basis data untuk urutan anak.

Berkas:
- `src/lib/child-order.ts` (baru)
- `src/lib/child-order.test.ts` (baru)

API yang WAJIB ada (nama dan tanda tangan ini dipakai task lain):

```ts
/** Kunci grup saudara: himpunan orang tua yang sama, urut abjad, tanpa duplikat. */
export function siblingGroupKey(parentIds: string[]): string;

export type ChildOrderDb = {
  personChild: {
    findMany(args: unknown): Promise<Array<{ childId: string; parentId: string; orderIndex: number }>>;
    update(args: unknown): Promise<unknown>;
  };
};

/** Anggota grup saudara dari himpunan orang tua, terurut naik lalu id. */
export async function siblingsOfGroup(
  parentIds: string[],
  db?: ChildOrderDb,
): Promise<Array<{ childId: string; orderIndex: number }>>;

/** Nomor urut berikutnya untuk anak baru di grup ini. Kosong -> 0. */
export async function nextChildOrderIndex(
  parentIds: string[],
  db?: ChildOrderDb,
): Promise<number>;

/**
 * Tukar posisi anak dengan tetangganya dalam grup, lalu sinkronkan
 * SELURUH baris PersonChild milik kedua anak (ayah dan ibu).
 * `direction` "up" menukar dengan tetangga sebelumnya, "down" dengan sesudahnya.
 * Mengembalikan false bila anak tidak ada atau sudah di ujung.
 */
export async function moveChild(
  childId: string,
  direction: "up" | "down",
  db?: ChildOrderDb,
): Promise<boolean>;
```

Aturan implementasi:
- `siblingGroupKey`: buang duplikat, urut abjad, gabung dengan `"|"`.
- `siblingsOfGroup`: ambil baris dengan `parentId in parentIds`, kelompokkan per
  `childId`, buang anak yang himpunan orang tuanya tidak sama persis dengan
  `parentIds` (pakai `siblingGroupKey`). `orderIndex` anak = nilai terbesar di
  antara barisnya. Urutkan naik `orderIndex`, lalu `childId` naik.
- `nextChildOrderIndex`: `0` bila grup kosong, selain itu `orderIndex` terbesar
  tambah satu.
- `moveChild`:
  1. Cari semua baris `PersonChild` milik `childId` untuk mendapatkan himpunan
     orang tuanya. Bila tidak ada, kembalikan `false`.
  2. Ambil `siblingsOfGroup` dari himpunan orang tua itu.
  3. Cari posisi `childId`. Bila `up` dan sudah indeks 0, atau `down` dan sudah
     indeks terakhir, kembalikan `false`.
  4. Tukar `orderIndex` dengan tetangga sasaran.
  5. Tulis ulang nomor ke SELURUH baris milik kedua anak itu. Bila nomor hasil
     tukar kebetulan sama, pakai nomor berurutan baru yang unik
     (`tetanggaBaru` untuk anak itu, `nomorLamaAnak` untuk tetangga) agar tidak
     ada dua anak bernomor sama dalam satu grup.
  6. Kembalikan `true`.
- `db` default ke `prisma` dari `@/lib/prisma` supaya pemanggil tidak perlu
  menyuntikkan apa pun.

Tes (pakai `ChildOrderDb` palsu, tanpa basis data):
- `siblingGroupKey` membuang duplikat dan mengurutkan.
- `nextChildOrderIndex` mengembalikan 0 untuk grup kosong.
- `nextChildOrderIndex` mengembalikan maksimum tambah satu.
- `siblingsOfGroup` membuang anak dengan himpunan orang tua berbeda.
- `moveChild` "up" menukar nomor dan menyinkronkan baris ayah DAN ibu.
- `moveChild` di ujung mengembalikan false dan tidak menulis apa pun.

Kriteria selesai: `npx tsx --test src/lib/child-order.test.ts` lulus semua.

## Task 3: Isi orderIndex di semua jalur tulis

Setiap kali relasi orang tua-anak dibuat, isi `orderIndex` dengan
`nextChildOrderIndex` dari himpunan orang tua anak itu.

Berkas:
- `src/app/api/admin/relasi/route.ts`
- `src/app/api/pengajuan/review/route.ts`
- `src/app/api/profil/relations/route.ts`
- `prisma/seed.ts`

Aturan per berkas:
- `admin/relasi` punya 4 titik `personChild.create`: dua di case `"add"`
  (relationType `"parent"` dan `"child"`) dan dua di case `"add-new"`
  (relationType `"parent"` dan `"child"`). Pada tiap titik, himpunan orang tua
  anak hasil relasi adalah:
  - relationType `"parent"`: orang tua = `[targetPersonId]` (case add) atau
    `[created.id]` (case add-new), anak = `personId`.
  - relationType `"child"`: orang tua = `[personId]`, anak = `targetPersonId`
    (case add) atau `created.id` (case add-new).
  Hitung `orderIndex` lewat `nextChildOrderIndex(himpunanOrangTua)` dan sertakan
  pada `data` create. Untuk kasus `add-new` yang memakai `$transaction`, hitung
  nomornya DI DALAM transaksi memakai `tx` sebagai `db` agar nomor tidak basi.
- `pengajuan/review` punya 2 titik `personChild.create`. Titik di baris sekitar
  125 (aksi `add`) memakai `parentId` yang sudah dihitung; titik di baris
  sekitar 397 (di dalam `$transaction`) memakai `parentId`. Isi `orderIndex`
  dari `nextChildOrderIndex([parentId], tx)` untuk yang di dalam transaksi, dan
  `nextChildOrderIndex([parentId])` untuk yang di luar. Titik kedua di dalam
  transaksi (sekitar baris 422, melengkapi orang tua kedua) juga harus diisi
  dengan `nextChildOrderIndex([otherParentId], tx)`.
- `profil/relations`: `personChild.upsert` sekitar baris 351. Isi `orderIndex`
  pada cabang `create` dengan `nextChildOrderIndex([data.personId])`. Cabang
  `update` TIDAK diubah (hanya mengganti peran).
- `prisma/seed.ts`: dua `personChild.create` (ayah dan ibu untuk anak yang
  sama). Keduanya WAJIB memakai nomor yang sama, yaitu `i` (indeks anak pada
  loop). Isi `orderIndex: i` pada keduanya.

Penting: jangan mengubah perilaku lain. Jangan menambah validasi baru.

Kriteria selesai:
- `npx tsx --test src/app/api/admin/relasi/route.test.ts` lulus.
- `npx tsx --test $(find src -name '*.test.ts' | sort)` lulus semua.

## Task 4: Baca anak secara terurut

Semua pembaca daftar anak memakai urutan baru. Urutan: `orderIndex` naik, lalu
tanggal lahir paling tua, lalu `id`.

Berkas:
- `src/lib/data.ts`
- `src/lib/family-tree.ts`
- `src/lib/genealogy.ts`
- `src/app/api/profil/relations/route.ts`
- `src/app/api/family/graph/route.ts`

Aturan per berkas:
- `src/lib/data.ts` baris sekitar 122: `personChild.findMany` ganti
  `orderBy: { createdAt: "asc" }` menjadi
  `orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]`. Tambah `orderIndex: true`
  pada `select`.
- `src/lib/family-tree.ts`:
  - `TREE_SELECT` tidak berubah.
  - `include.children` sekitar baris 419: tambah
    `orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]` sehingga
    `person.children` sudah terurut.
  - `collectEdges` sekitar baris 346 dipakai untuk leluhur dan keturunan.
    Tambah `orderIndex: true` pada `select` dan `orderBy` deterministik
    (`[{ orderIndex: "asc" }, { createdAt: "asc" }]`) supaya urutan anak pada
    level keturunan stabil.
  - `Edge` type: tambah `orderIndex?: number`.
- `src/lib/genealogy.ts`: pada `getClassifiedSiblings`, daftar `paternal` dan
  `maternal` sekitar baris 141 dan 147 tambah `orderIndex: true` pada `select`
  dan urutkan hasilnya dengan `orderIndex` naik lalu `childId`. Karena hasil
  digabung ke dalam `Map`, urutan anggota grup mengikuti urutan penyisipan:
  pastikan loop penyisipan memakai array yang sudah terurut. Cukup tambah
  `orderBy: [{ orderIndex: "asc" }, { childId: "asc" }]` pada kedua `findMany`
  itu.
- `src/app/api/profil/relations/route.ts` sekitar baris 191: ganti
  pengurutan tanggal lahir menjadi: `orderIndex` naik, lalu `birthDate` paling
  tua, lalu `id`. Tambah `orderIndex: true` pada hasil map anak.
- `src/app/api/family/graph/route.ts` sekitar baris 57: tambah
  `orderIndex: true` pada `select` dan `orderBy: { orderIndex: "asc" }` supaya
  posisi `x` anak mengikuti nomor urut.

Kriteria selesai:
- `npx tsx --test $(find src -name '*.test.ts' | sort)` lulus semua.
- `npx tsc --noEmit` tidak memunculkan error baru pada berkas yang diubah.

## Task 5: treeLayout menghormati orderIndex

Pohon silsilah harus menaruh anak bernomor lebih kecil di kiri, tanpa
bergantung pada urutan array masukan.

Berkas:
- `src/components/silsilah/treeLayout.ts`
- `src/components/silsilah/treeLayout.test.ts`

Langkah:
1. `ChildEdge` tambah `orderIndex?: number`.
2. Di `buildTreeGraph`, saat mengelompokkan anak (`coupleChildren` dan
   `singleChildren`), urutkan `childId` dalam tiap grup memakai
   `orderIndex` naik, lalu `createdAt` tidak tersedia di tipe, jadi fallback
   `childId` naik. Simpan peta `orderIndexByChild` dari `data.childEdges`
   (ambil nilai terkecil bila ada beberapa baris) dan pakai sebagai kunci
   pertama. WAJIB deterministik.
3. Jangan mengubah pengemasan kontur, centering, atau jaminan lama.

Tes baru:
- Fixture: orang tua `P` dengan tiga anak `C1`, `C2`, `C3` yang `childEdges`
  sengaja diberi `orderIndex` terbalik (`C3`=0, `C2`=1, `C1`=2) dan urutan
  array masukan diacak. Assert `x(C3) < x(C2) < x(C1)`.
- Fixture tanpa `orderIndex` (undefined) tetap deterministik dan tidak melempar.

Kriteria selesai:
- `npx tsx --test src/components/silsilah/treeLayout.test.ts` lulus semua.
- `npx tsx --test $(find src -name '*.test.ts' | sort)` lulus semua.

## Task 6: API aksi reorder-child

Tambah aksi baru pada API relasi admin untuk memindahkan anak naik atau turun.

Berkas:
- `src/app/api/admin/relasi/route.ts`
- `src/app/api/admin/relasi/route.test.ts`

Langkah:
1. Tambah case `"reorder-child"` pada `switch (action)` di `POST`.
   Body: `{ action: "reorder-child", childId: string, direction: "up" | "down" }`.
   - Bila `childId` atau `direction` tidak valid, balas 400 dengan pesan
     Indonesia.
   - Panggil `moveChild(childId, direction)` dari `@/lib/child-order`.
   - Bila hasilnya `false`, balas 409 dengan pesan
     `"Anak tidak ditemukan atau sudah berada di urutan paling ujung."`.
   - Bila `true`, tulis audit log dengan action `"RELATION_REORDER_CHILD"`,
     `entityType: "Person"`, `entityId: childId`, `actorUserId: session.user.id`,
     lalu balas `{ ok: true }`.
2. Tambah tes pada `route.test.ts` yang memuat route asli dengan mock, lalu:
   - Memastikan `reorder-child` memanggil `moveChild` dan membalas 200.
   - Memastikan `direction` tidak valid dibalas 400.

Kriteria selesai:
- `npx tsx --test src/app/api/admin/relasi/route.test.ts` lulus semua.
- `npx tsx --test $(find src -name '*.test.ts' | sort)` lulus semua.

## Task 7: Tombol naik/turun di form admin

Admin dapat menggeser urutan anak dari form Family Tree.

Berkas:
- `src/components/keluarga/FamilyTreeModal.tsx`

Langkah:
1. Daftar anak yang ditampilkan sudah terurut dari server (Task 4).
2. Pada tiap baris anak di bagian "Anak" (sekitar baris 815), tambah dua tombol
   kecil: naik (label aksesibilitas `"Naikkan urutan <nama>"`, teks `"Naik"`)
   dan turun (`"Turunkan urutan <nama>"`, teks `"Turun"`).
   - Tombol naik `disabled` untuk anak pertama; tombol turun `disabled` untuk
     anak terakhir.
   - Saat diklik, panggil `mutate({ action: "reorder-child", childId, direction }, "Urutan anak diperbarui.")`.
   - Tombol `disabled` saat `saving` dan saat `removingEdgeId` tidak kosong.
   - Kelas mengikuti tombol yang sudah ada di berkas itu
     (`min-h-11 rounded-md px-3 py-2 text-xs font-medium text-wood underline ...`).
3. Tambah keterangan singkat di bawah judul "Anak":
   `"Urutan menentukan posisi kiri ke kanan di silsilah."`
4. Jangan mengubah bagian lain berkas.

Kriteria selesai:
- `npx tsc --noEmit` tidak memunculkan error baru pada berkas itu.
- `npx tsx --test $(find src -name '*.test.ts' | sort)` lulus semua.

## Verifikasi akhir (controller)

- `npx next build` lulus.
- Terapkan migrasi ke basis data dev (port 5435) dan jalankan skrip ukur untuk
  memastikan pohon tidak berubah urutannya.
- Terapkan migrasi ke produksi saat deploy dan verifikasi lewat HTTP.
