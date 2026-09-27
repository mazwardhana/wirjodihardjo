-- Task 3.3: Username login + first-login onboarding flag
-- Existing data is dummy/test data; reset per spec.

-- Step 1: Clear Branch references to Person and User before reset
UPDATE "Branch" SET "rootPersonId" = NULL, "adminId" = NULL;

-- Step 2: Reset related tables in dependency order
DELETE FROM "AuditLog";
DELETE FROM "Notification";
DELETE FROM "BranchRepresentative";
DELETE FROM "GovernanceAssignment";
DELETE FROM "GovernancePosition";
DELETE FROM "GovernanceStructure";
DELETE FROM "ImportBatch";
DELETE FROM "Submission";
DELETE FROM "GalleryMedia";
DELETE FROM "Album";
DELETE FROM "Article";
DELETE FROM "HallOfFameEntry";
DELETE FROM "ReunionRegistration";
DELETE FROM "Reunion";
DELETE FROM "SocialLink";
DELETE FROM "Education";
DELETE FROM "PersonPrivate";
DELETE FROM "PersonChild";
DELETE FROM "PersonPartner";
DELETE FROM "Person";
DELETE FROM "User";

-- Step 3: email becomes optional (idempotent)
DO $$ BEGIN
  ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 4: Add username if not already exists
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "username" TEXT NOT NULL;
EXCEPTION WHEN duplicate_column THEN
  ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
END $$;

-- Step 5: Add mustChangeCredentials if not already exists
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "mustChangeCredentials" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Step 6: Recreate unique indexes idempotently
DROP INDEX IF EXISTS "User_username_key";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- email unique index may already exist; ensure it's still valid
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
