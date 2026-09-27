-- Step 1: Add branchNumber as nullable
ALTER TABLE "Branch" ADD COLUMN "branchNumber" INTEGER;

-- Step 2: Backfill branchNumber from orderIndex + 1
UPDATE "Branch" SET "branchNumber" = "orderIndex" + 1;

-- Step 3: Validate that exactly 10 rows exist with branch numbers 1-10
DO $$
DECLARE
  branch_count INTEGER;
  missing_numbers TEXT;
BEGIN
  SELECT COUNT(*) INTO branch_count FROM "Branch";
  
  IF branch_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 branches, found %', branch_count;
  END IF;
  
  SELECT string_agg(num::text, ', ') INTO missing_numbers
  FROM generate_series(1, 10) num
  WHERE NOT EXISTS (SELECT 1 FROM "Branch" WHERE "branchNumber" = num);
  
  IF missing_numbers IS NOT NULL THEN
    RAISE EXCEPTION 'Missing branch numbers: %', missing_numbers;
  END IF;
END $$;

-- Step 4: Add NOT NULL constraint
ALTER TABLE "Branch" ALTER COLUMN "branchNumber" SET NOT NULL;

-- Step 5: Add unique constraint
CREATE UNIQUE INDEX "Branch_branchNumber_key" ON "Branch"("branchNumber");

-- Step 6: Add Person profile fields
ALTER TABLE "Person" ADD COLUMN "occupation" TEXT;
ALTER TABLE "Person" ADD COLUMN "status" TEXT;

-- Step 7: Create Education table
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "fieldOfStudy" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Education_personId_idx" ON "Education"("personId");

ALTER TABLE "Education" ADD CONSTRAINT "Education_personId_fkey" 
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Create SocialPlatform table
CREATE TABLE "SocialPlatform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "iconName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPlatform_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialPlatform_name_key" ON "SocialPlatform"("name");

-- Step 9: Create SocialLink table
CREATE TABLE "SocialLink" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "personId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialLink_personId_idx" ON "SocialLink"("personId");
CREATE INDEX "SocialLink_platformId_idx" ON "SocialLink"("platformId");

ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_personId_fkey" 
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_platformId_fkey" 
  FOREIGN KEY ("platformId") REFERENCES "SocialPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 10: Create GovernanceStructure table
CREATE TABLE "GovernanceStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceStructure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernanceStructure_name_key" ON "GovernanceStructure"("name");
CREATE INDEX "GovernanceStructure_isActive_idx" ON "GovernanceStructure"("isActive");
CREATE INDEX "GovernanceStructure_startDate_idx" ON "GovernanceStructure"("startDate");

-- Step 11: Create GovernancePosition table
CREATE TABLE "GovernancePosition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "isBranchRepresentative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "structureId" TEXT NOT NULL,
    "parentPositionId" TEXT,

    CONSTRAINT "GovernancePosition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernancePosition_structureId_idx" ON "GovernancePosition"("structureId");
CREATE INDEX "GovernancePosition_parentPositionId_idx" ON "GovernancePosition"("parentPositionId");
CREATE INDEX "GovernancePosition_isBranchRepresentative_idx" ON "GovernancePosition"("isBranchRepresentative");

ALTER TABLE "GovernancePosition" ADD CONSTRAINT "GovernancePosition_structureId_fkey" 
  FOREIGN KEY ("structureId") REFERENCES "GovernanceStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GovernancePosition" ADD CONSTRAINT "GovernancePosition_parentPositionId_fkey" 
  FOREIGN KEY ("parentPositionId") REFERENCES "GovernancePosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 12: Create GovernanceAssignment table
CREATE TABLE "GovernanceAssignment" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "positionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "branchId" TEXT,
    "assignedByUserId" TEXT NOT NULL,

    CONSTRAINT "GovernanceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceAssignment_positionId_idx" ON "GovernanceAssignment"("positionId");
CREATE INDEX "GovernanceAssignment_personId_idx" ON "GovernanceAssignment"("personId");
CREATE INDEX "GovernanceAssignment_branchId_idx" ON "GovernanceAssignment"("branchId");
CREATE INDEX "GovernanceAssignment_assignedByUserId_idx" ON "GovernanceAssignment"("assignedByUserId");
CREATE INDEX "GovernanceAssignment_startDate_idx" ON "GovernanceAssignment"("startDate");

ALTER TABLE "GovernanceAssignment" ADD CONSTRAINT "GovernanceAssignment_positionId_fkey" 
  FOREIGN KEY ("positionId") REFERENCES "GovernancePosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GovernanceAssignment" ADD CONSTRAINT "GovernanceAssignment_personId_fkey" 
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GovernanceAssignment" ADD CONSTRAINT "GovernanceAssignment_branchId_fkey" 
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GovernanceAssignment" ADD CONSTRAINT "GovernanceAssignment_assignedByUserId_fkey" 
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 13: Create BranchRepresentative table (enforces 2-slot constraint)
CREATE TABLE "BranchRepresentative" (
    "id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,

    CONSTRAINT "BranchRepresentative_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BranchRepresentative_branchId_idx" ON "BranchRepresentative"("branchId");
CREATE INDEX "BranchRepresentative_personId_idx" ON "BranchRepresentative"("personId");
CREATE INDEX "BranchRepresentative_assignedByUserId_idx" ON "BranchRepresentative"("assignedByUserId");
CREATE INDEX "BranchRepresentative_startDate_idx" ON "BranchRepresentative"("startDate");
CREATE UNIQUE INDEX "BranchRepresentative_branchId_slot_key" ON "BranchRepresentative"("branchId", "slot");
ALTER TABLE "BranchRepresentative" ADD CONSTRAINT "BranchRepresentative_slot_check" CHECK ("slot" IN (1, 2));

ALTER TABLE "BranchRepresentative" ADD CONSTRAINT "BranchRepresentative_branchId_fkey" 
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BranchRepresentative" ADD CONSTRAINT "BranchRepresentative_personId_fkey" 
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BranchRepresentative" ADD CONSTRAINT "BranchRepresentative_assignedByUserId_fkey" 
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
