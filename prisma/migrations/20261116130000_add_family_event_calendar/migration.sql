-- CreateEnum
CREATE TYPE "FamilyEventType" AS ENUM ('MILAD', 'HAUL', 'REUNI', 'HALAL_BIHALAL', 'LAINNYA');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

-- DropIndex

-- CreateTable
CREATE TABLE "FamilyEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "FamilyEventType" NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "locationName" TEXT,
    "repeatYearly" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "FamilyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyEventRsvp" (
    "id" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FamilyEventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyEvent_slug_key" ON "FamilyEvent"("slug");

-- CreateIndex
CREATE INDEX "FamilyEvent_type_idx" ON "FamilyEvent"("type");

-- CreateIndex
CREATE INDEX "FamilyEvent_startsAt_idx" ON "FamilyEvent"("startsAt");

-- CreateIndex
CREATE INDEX "FamilyEvent_isPublished_idx" ON "FamilyEvent"("isPublished");

-- CreateIndex
CREATE INDEX "FamilyEventRsvp_userId_idx" ON "FamilyEventRsvp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyEventRsvp_eventId_userId_key" ON "FamilyEventRsvp"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "FamilyEvent" ADD CONSTRAINT "FamilyEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyEventRsvp" ADD CONSTRAINT "FamilyEventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FamilyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyEventRsvp" ADD CONSTRAINT "FamilyEventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

