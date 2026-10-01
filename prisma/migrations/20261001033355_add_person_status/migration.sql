-- Riwayat status per orang. Model aditif, tidak mengubah kolom lama.

-- CreateTable
CREATE TABLE "PersonStatus" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personId" TEXT NOT NULL,

    CONSTRAINT "PersonStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonStatus_personId_createdAt_idx" ON "PersonStatus"("personId", "createdAt");

-- AddForeignKey
ALTER TABLE "PersonStatus" ADD CONSTRAINT "PersonStatus_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pindahkan nilai Person.status lama yang tidak kosong ke riwayat PersonStatus.
INSERT INTO "PersonStatus" ("id", "message", "createdAt", "personId")
SELECT gen_random_uuid()::text, "status", now(), "id"
FROM "Person" WHERE "status" IS NOT NULL AND btrim("status") <> '';
