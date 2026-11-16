-- CreateTable
CREATE TABLE "PersonLifeEvent" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "date" TIMESTAMP(3),
    "datePrecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonLifeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonMemory" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STORY',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "thumbnailUrl" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedByUserId" TEXT,
    "moderatedByUserId" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonLifeEvent_personId_date_idx" ON "PersonLifeEvent"("personId", "date");

-- CreateIndex
CREATE INDEX "PersonMemory_personId_status_idx" ON "PersonMemory"("personId", "status");

-- AddForeignKey
ALTER TABLE "PersonLifeEvent" ADD CONSTRAINT "PersonLifeEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMemory" ADD CONSTRAINT "PersonMemory_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMemory" ADD CONSTRAINT "PersonMemory_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMemory" ADD CONSTRAINT "PersonMemory_moderatedByUserId_fkey" FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
