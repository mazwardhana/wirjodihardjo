-- AlterTable: jadwal reuni boleh dikosongkan (menyusul)
ALTER TABLE "Reunion" ALTER COLUMN "startAt" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RegistrationBatch" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "accountsMade" INTEGER NOT NULL DEFAULT 0,
    "attendees" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitterIp" TEXT,
    "notes" TEXT,

    CONSTRAINT "RegistrationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationBatch_branchId_idx" ON "RegistrationBatch"("branchId");

-- CreateIndex
CREATE INDEX "RegistrationBatch_submittedAt_idx" ON "RegistrationBatch"("submittedAt");

-- AddForeignKey
ALTER TABLE "RegistrationBatch" ADD CONSTRAINT "RegistrationBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
