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
