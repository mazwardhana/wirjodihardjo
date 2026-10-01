-- Pisahkan kolom nama panggilan dari nickname.
-- Kolom baru bersifat opsional agar migrasi aditif dan aman.

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "namaPanggilan" TEXT;

-- Backfill: nilai nickname lama dipakai sebagai namaPanggilan awal.
UPDATE "Person" SET "namaPanggilan" = "nickname" WHERE "namaPanggilan" IS NULL;
