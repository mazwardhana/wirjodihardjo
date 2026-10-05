-- Kehadiran reuni: kolom terpisah dari status pendaftaran, plus tautan ke
-- Person supaya anggota tanpa akun bisa ikut tercatat.

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ATTENDING', 'NOT_ATTENDING');

-- AlterTable: kehadiran aktual (baris lama dianggap hadir)
ALTER TABLE "ReunionRegistration"
  ADD COLUMN "attendance" "AttendanceStatus" NOT NULL DEFAULT 'ATTENDING';

-- AlterTable: tautan ke Person; userId boleh kosong untuk anggota tanpa akun
ALTER TABLE "ReunionRegistration" ADD COLUMN "personId" TEXT;
ALTER TABLE "ReunionRegistration" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ReunionRegistration_reunionId_personId_key"
  ON "ReunionRegistration"("reunionId", "personId");

-- AddForeignKey
ALTER TABLE "ReunionRegistration" ADD CONSTRAINT "ReunionRegistration_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill sekali jalan: setiap anggota yang masih hidup (dan belum tercatat di
-- reuni 2027) dianggap hadir. Anggota wafat tidak dibuatkan. `userId` diisi bila
-- ada akunnya, kalau tidak cukup `personId`. NOT EXISTS membuat ini idempoten.
INSERT INTO "ReunionRegistration"
  ("id", "guestCount", "status", "attendance", "createdAt", "updatedAt", "reunionId", "personId", "userId")
SELECT
  gen_random_uuid()::text,
  1,
  'CONFIRMED',
  'ATTENDING',
  now(),
  now(),
  r."id",
  p."id",
  u."id"
FROM "Reunion" r
CROSS JOIN "Person" p
LEFT JOIN "User" u ON u."personId" = p."id"
WHERE r."slug" = 'reuni-wirjodihardjo-2-0-blitar-2027'
  AND p."deletedAt" IS NULL
  AND p."isDeceased" = false
  AND NOT EXISTS (
    SELECT 1 FROM "ReunionRegistration" rr
    WHERE rr."reunionId" = r."id"
      AND (rr."personId" = p."id" OR (rr."userId" IS NOT NULL AND rr."userId" = u."id"))
  );
