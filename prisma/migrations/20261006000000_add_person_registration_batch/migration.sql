-- AlterTable: tandai asal data lewat batch registrasi.
-- Nullable: anggota dari seed/silsilah/impor anggota tetap kosong.
ALTER TABLE "Person" ADD COLUMN "registrationBatchId" TEXT;

-- CreateIndex
CREATE INDEX "Person_registrationBatchId_idx" ON "Person"("registrationBatchId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_registrationBatchId_fkey"
  FOREIGN KEY ("registrationBatchId") REFERENCES "RegistrationBatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
