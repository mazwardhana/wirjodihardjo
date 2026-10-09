-- Buku tamu reuni: jejak kehadiran hari-H, terpisah dari kolom `attendance`
-- yang berarti rencana hadir. Baris lama (pendaftaran reuni biasa) bernilai NULL
-- pada ketiga kolom ini sampai orangnya benar-benar melewati buku tamu.
--
-- Catatan: `prisma migrate diff` juga menghasilkan `DROP INDEX
-- "Person_registrationBatchId_idx"` karena indeks itu ada di basis data tetapi
-- tidak dideklarasikan di schema.prisma (drift lama dari migrasi 20261006000000).
-- DROP itu sengaja TIDAK disertakan: di luar lingkup fitur ini dan berisiko
-- menghapus indeks yang masih dipakai produksi.

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('QR_SELF', 'ADMIN');

-- AlterTable
ALTER TABLE "ReunionRegistration"
  ADD COLUMN "checkedInAt" TIMESTAMP(3),
  ADD COLUMN "checkInSource" "CheckInSource",
  ADD COLUMN "checkInGroupId" TEXT;

-- CreateIndex
CREATE INDEX "ReunionRegistration_reunionId_checkedInAt_idx"
  ON "ReunionRegistration"("reunionId", "checkedInAt");

-- CreateIndex
CREATE INDEX "ReunionRegistration_checkInGroupId_idx"
  ON "ReunionRegistration"("checkInGroupId");
