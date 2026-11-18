-- Ubah aman: ADD COLUMN nullable, tanpa rewrite tabel.
ALTER TABLE "ImportBatch" ADD COLUMN "rolledBackAt" TIMESTAMP(3);
