--
-- PostgreSQL database dump
--

\restrict W1dJwQILw4sdfVr3c2UrVAw15QUqj9N3QSgEFrdDT7fHzRcVREP0MCz7bReRoWQ

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: ArticleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ArticleStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: EntryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EntryType" AS ENUM (
    'ACHIEVEMENT',
    'IN_MEMORIAM'
);


--
-- Name: Gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Gender" AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER'
);


--
-- Name: ImportStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ImportStatus" AS ENUM (
    'VALIDATED',
    'COMMITTED',
    'PARTIAL',
    'FAILED'
);


--
-- Name: MediaStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MediaStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: ParentRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ParentRole" AS ENUM (
    'FATHER',
    'MOTHER',
    'UNKNOWN'
);


--
-- Name: PartnerStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PartnerStatus" AS ENUM (
    'MARRIED',
    'DIVORCED',
    'WIDOWED',
    'UNKNOWN'
);


--
-- Name: RegistrationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RegistrationStatus" AS ENUM (
    'CONFIRMED',
    'CANCELLED',
    'WAITLIST'
);


--
-- Name: ReunionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReunionStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'CANCELLED',
    'COMPLETED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'SUPER_ADMIN',
    'BRANCH_ADMIN',
    'MEMBER'
);


--
-- Name: SubmissionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubmissionStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


--
-- Name: SubmissionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubmissionType" AS ENUM (
    'ADD_CHILD',
    'ADD_SPOUSE',
    'ADD_PERSON',
    'EDIT_PERSON',
    'EDIT_RELATION'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AdminNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AdminNote" (
    id text NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "personId" text NOT NULL,
    "authorId" text NOT NULL
);


--
-- Name: Album; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Album" (
    id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    "eventDate" timestamp(3) without time zone,
    "coverImageUrl" text,
    "isPublished" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdByUserId" text NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "publishedByUserId" text
);


--
-- Name: Article; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Article" (
    id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    body text NOT NULL,
    excerpt text,
    "youtubeUrl" text,
    "photoUrl" text,
    status public."ArticleStatus" DEFAULT 'PENDING'::public."ArticleStatus" NOT NULL,
    "reviewNote" text,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "authorUserId" text NOT NULL,
    "reviewedByUserId" text,
    "reviewedAt" timestamp(3) without time zone,
    "categoryId" text NOT NULL,
    "personId" text
);


--
-- Name: ArticleCategory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ArticleCategory" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text,
    "beforeData" jsonb,
    "afterData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "actorUserId" text,
    "actorLabel" text,
    "ipAddress" text,
    "userAgent" text
);


--
-- Name: Branch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Branch" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "coverImageUrl" text,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "rootPersonId" text,
    "adminId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "branchNumber" integer NOT NULL
);


--
-- Name: BranchRepresentative; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BranchRepresentative" (
    id text NOT NULL,
    slot integer NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "branchId" text NOT NULL,
    "personId" text NOT NULL,
    "assignedByUserId" text NOT NULL,
    CONSTRAINT "BranchRepresentative_slot_check" CHECK ((slot = ANY (ARRAY[1, 2])))
);


--
-- Name: Education; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Education" (
    id text NOT NULL,
    institution text NOT NULL,
    degree text,
    "fieldOfStudy" text,
    "startYear" integer,
    "endYear" integer,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "personId" text NOT NULL
);


--
-- Name: GalleryMedia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GalleryMedia" (
    id text NOT NULL,
    url text NOT NULL,
    "thumbnailUrl" text,
    caption text,
    "mediaType" text DEFAULT 'IMAGE'::text NOT NULL,
    width integer,
    height integer,
    status public."MediaStatus" DEFAULT 'PENDING'::public."MediaStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "albumId" text NOT NULL,
    "uploadedByUserId" text,
    "personId" text,
    "moderatedAt" timestamp(3) without time zone,
    "moderatedByUserId" text,
    "rejectionReason" text
);


--
-- Name: GenerationLabel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GenerationLabel" (
    level integer NOT NULL,
    jawa text NOT NULL,
    indonesia text
);


--
-- Name: GovernanceAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GovernanceAssignment" (
    id text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "positionId" text NOT NULL,
    "personId" text NOT NULL,
    "branchId" text,
    "assignedByUserId" text NOT NULL
);


--
-- Name: GovernancePosition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GovernancePosition" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    level integer DEFAULT 0 NOT NULL,
    capacity integer,
    "isBranchRepresentative" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "structureId" text NOT NULL,
    "parentPositionId" text
);


--
-- Name: GovernanceStructure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GovernanceStructure" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: HallOfFameEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HallOfFameEntry" (
    id text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    year integer,
    "photoUrl" text,
    "entryType" public."EntryType" DEFAULT 'ACHIEVEMENT'::public."EntryType" NOT NULL,
    "isPublished" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "personId" text NOT NULL,
    "createdByUserId" text NOT NULL
);


--
-- Name: ImportBatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ImportBatch" (
    id text NOT NULL,
    type text DEFAULT 'PERSON_FULL'::text NOT NULL,
    filename text NOT NULL,
    status public."ImportStatus" DEFAULT 'VALIDATED'::public."ImportStatus" NOT NULL,
    "totalRows" integer DEFAULT 0 NOT NULL,
    "successRows" integer DEFAULT 0 NOT NULL,
    "errorRows" integer DEFAULT 0 NOT NULL,
    "reportJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: Person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Person" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    nickname text,
    gender public."Gender" NOT NULL,
    "birthDate" timestamp(3) without time zone,
    "birthDatePrecision" text,
    "birthPlace" text,
    "deathDate" timestamp(3) without time zone,
    "isDeceased" boolean DEFAULT false NOT NULL,
    bio text,
    "photoUrl" text,
    "generationLevel" integer,
    "isPublicProfile" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "branchId" text,
    "deletedAt" timestamp(3) without time zone,
    "isMarriedInto" boolean DEFAULT false NOT NULL,
    slug text,
    "externalRef" text,
    occupation text,
    status text,
    "deathPlace" text
);


--
-- Name: PersonChild; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PersonChild" (
    id text NOT NULL,
    "parentId" text NOT NULL,
    "childId" text NOT NULL,
    "parentRole" public."ParentRole" DEFAULT 'UNKNOWN'::public."ParentRole" NOT NULL,
    "isAdopted" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isStep" boolean DEFAULT false NOT NULL,
    "sourceSubmissionId" text
);


--
-- Name: PersonPartner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PersonPartner" (
    id text NOT NULL,
    "partnerAId" text NOT NULL,
    "partnerBId" text NOT NULL,
    "marriageDate" timestamp(3) without time zone,
    status public."PartnerStatus" DEFAULT 'MARRIED'::public."PartnerStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "divorceDate" timestamp(3) without time zone,
    notes text,
    "orderIndex" integer DEFAULT 0 NOT NULL
);


--
-- Name: PersonPrivate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PersonPrivate" (
    "personId" text NOT NULL,
    "addressLine" text,
    city text,
    province text,
    "postalCode" text,
    phone text,
    whatsapp text,
    email text,
    "maritalStatus" text,
    "familyNotes" text,
    "visibleToMembers" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Reunion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Reunion" (
    id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone,
    "locationName" text,
    "locationUrl" text,
    capacity integer,
    "registrationDeadline" timestamp(3) without time zone,
    "heroImageUrl" text,
    status public."ReunionStatus" DEFAULT 'DRAFT'::public."ReunionStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdByUserId" text NOT NULL
);


--
-- Name: ReunionRegistration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReunionRegistration" (
    id text NOT NULL,
    "guestCount" integer DEFAULT 1 NOT NULL,
    notes text,
    status public."RegistrationStatus" DEFAULT 'CONFIRMED'::public."RegistrationStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reunionId" text NOT NULL,
    "userId" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SocialLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SocialLink" (
    id text NOT NULL,
    url text NOT NULL,
    username text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "personId" text NOT NULL,
    "platformId" text NOT NULL
);


--
-- Name: SocialPlatform; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SocialPlatform" (
    id text NOT NULL,
    name text NOT NULL,
    "baseUrl" text,
    "iconName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    type public."SubmissionType" NOT NULL,
    payload jsonb NOT NULL,
    status public."SubmissionStatus" DEFAULT 'PENDING'::public."SubmissionStatus" NOT NULL,
    "reviewNote" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "submittedByUserId" text NOT NULL,
    "targetPersonId" text,
    "reviewedByUserId" text,
    "appliedPersonId" text
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text,
    "passwordHash" text NOT NULL,
    role public."Role" DEFAULT 'MEMBER'::public."Role" NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "personId" text NOT NULL,
    "createdById" text,
    "mustChangePassword" boolean DEFAULT false NOT NULL,
    "passwordResetExpires" timestamp(3) without time zone,
    "passwordResetToken" text,
    username text NOT NULL,
    "mustChangeCredentials" boolean DEFAULT true NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: AdminNote AdminNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminNote"
    ADD CONSTRAINT "AdminNote_pkey" PRIMARY KEY (id);


--
-- Name: Album Album_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Album"
    ADD CONSTRAINT "Album_pkey" PRIMARY KEY (id);


--
-- Name: ArticleCategory ArticleCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ArticleCategory"
    ADD CONSTRAINT "ArticleCategory_pkey" PRIMARY KEY (id);


--
-- Name: Article Article_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Article"
    ADD CONSTRAINT "Article_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BranchRepresentative BranchRepresentative_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BranchRepresentative"
    ADD CONSTRAINT "BranchRepresentative_pkey" PRIMARY KEY (id);


--
-- Name: Branch Branch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_pkey" PRIMARY KEY (id);


--
-- Name: Education Education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Education"
    ADD CONSTRAINT "Education_pkey" PRIMARY KEY (id);


--
-- Name: GalleryMedia GalleryMedia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GalleryMedia"
    ADD CONSTRAINT "GalleryMedia_pkey" PRIMARY KEY (id);


--
-- Name: GenerationLabel GenerationLabel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GenerationLabel"
    ADD CONSTRAINT "GenerationLabel_pkey" PRIMARY KEY (level);


--
-- Name: GovernanceAssignment GovernanceAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernanceAssignment"
    ADD CONSTRAINT "GovernanceAssignment_pkey" PRIMARY KEY (id);


--
-- Name: GovernancePosition GovernancePosition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernancePosition"
    ADD CONSTRAINT "GovernancePosition_pkey" PRIMARY KEY (id);


--
-- Name: GovernanceStructure GovernanceStructure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernanceStructure"
    ADD CONSTRAINT "GovernanceStructure_pkey" PRIMARY KEY (id);


--
-- Name: HallOfFameEntry HallOfFameEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HallOfFameEntry"
    ADD CONSTRAINT "HallOfFameEntry_pkey" PRIMARY KEY (id);


--
-- Name: ImportBatch ImportBatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportBatch"
    ADD CONSTRAINT "ImportBatch_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: PersonChild PersonChild_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonChild"
    ADD CONSTRAINT "PersonChild_pkey" PRIMARY KEY (id);


--
-- Name: PersonPartner PersonPartner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonPartner"
    ADD CONSTRAINT "PersonPartner_pkey" PRIMARY KEY (id);


--
-- Name: PersonPrivate PersonPrivate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonPrivate"
    ADD CONSTRAINT "PersonPrivate_pkey" PRIMARY KEY ("personId");


--
-- Name: Person Person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Person"
    ADD CONSTRAINT "Person_pkey" PRIMARY KEY (id);


--
-- Name: ReunionRegistration ReunionRegistration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReunionRegistration"
    ADD CONSTRAINT "ReunionRegistration_pkey" PRIMARY KEY (id);


--
-- Name: Reunion Reunion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reunion"
    ADD CONSTRAINT "Reunion_pkey" PRIMARY KEY (id);


--
-- Name: SocialLink SocialLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocialLink"
    ADD CONSTRAINT "SocialLink_pkey" PRIMARY KEY (id);


--
-- Name: SocialPlatform SocialPlatform_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocialPlatform"
    ADD CONSTRAINT "SocialPlatform_pkey" PRIMARY KEY (id);


--
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AdminNote_personId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdminNote_personId_idx" ON public."AdminNote" USING btree ("personId");


--
-- Name: Album_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Album_slug_idx" ON public."Album" USING btree (slug);


--
-- Name: Album_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Album_slug_key" ON public."Album" USING btree (slug);


--
-- Name: ArticleCategory_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ArticleCategory_name_key" ON public."ArticleCategory" USING btree (name);


--
-- Name: ArticleCategory_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ArticleCategory_slug_key" ON public."ArticleCategory" USING btree (slug);


--
-- Name: Article_authorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_authorUserId_idx" ON public."Article" USING btree ("authorUserId");


--
-- Name: Article_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_categoryId_idx" ON public."Article" USING btree ("categoryId");


--
-- Name: Article_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_slug_idx" ON public."Article" USING btree (slug);


--
-- Name: Article_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Article_slug_key" ON public."Article" USING btree (slug);


--
-- Name: Article_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_status_idx" ON public."Article" USING btree (status);


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: BranchRepresentative_assignedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BranchRepresentative_assignedByUserId_idx" ON public."BranchRepresentative" USING btree ("assignedByUserId");


--
-- Name: BranchRepresentative_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BranchRepresentative_branchId_idx" ON public."BranchRepresentative" USING btree ("branchId");


--
-- Name: BranchRepresentative_branchId_slot_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BranchRepresentative_branchId_slot_key" ON public."BranchRepresentative" USING btree ("branchId", slot);


--
-- Name: BranchRepresentative_personId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BranchRepresentative_personId_idx" ON public."BranchRepresentative" USING btree ("personId");


--
-- Name: BranchRepresentative_startDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BranchRepresentative_startDate_idx" ON public."BranchRepresentative" USING btree ("startDate");


--
-- Name: Branch_adminId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Branch_adminId_key" ON public."Branch" USING btree ("adminId");


--
-- Name: Branch_branchNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Branch_branchNumber_key" ON public."Branch" USING btree ("branchNumber");


--
-- Name: Branch_rootPersonId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Branch_rootPersonId_key" ON public."Branch" USING btree ("rootPersonId");


--
-- Name: Branch_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Branch_slug_key" ON public."Branch" USING btree (slug);


--
-- Name: Education_personId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Education_personId_idx" ON public."Education" USING btree ("personId");


--
-- Name: GalleryMedia_albumId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GalleryMedia_albumId_idx" ON public."GalleryMedia" USING btree ("albumId");


--
-- Name: GalleryMedia_moderatedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GalleryMedia_moderatedByUserId_idx" ON public."GalleryMedia" USING btree ("moderatedByUserId");


--
-- Name: GalleryMedia_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GalleryMedia_status_idx" ON public."GalleryMedia" USING btree (status);


--
-- Name: GovernanceAssignment_assignedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernanceAssignment_assignedByUserId_idx" ON public."GovernanceAssignment" USING btree ("assignedByUserId");


--
-- Name: GovernanceAssignment_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernanceAssignment_branchId_idx" ON public."GovernanceAssignment" USING btree ("branchId");


--
-- Name: GovernanceAssignment_personId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernanceAssignment_personId_idx" ON public."GovernanceAssignment" USING btree ("personId");


--
-- Name: GovernanceAssignment_positionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernanceAssignment_positionId_idx" ON public."GovernanceAssignment" USING btree ("positionId");


--
-- Name: GovernanceAssignment_startDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernanceAssignment_startDate_idx" ON public."GovernanceAssignment" USING btree ("startDate");


--
-- Name: GovernancePosition_isBranchRepresentative_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernancePosition_isBranchRepresentative_idx" ON public."GovernancePosition" USING btree ("isBranchRepresentative");


--
-- Name: GovernancePosition_parentPositionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernancePosition_parentPositionId_idx" ON public."GovernancePosition" USING btree ("parentPositionId");


--
-- Name: GovernancePosition_structureId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernancePosition_structureId_idx" ON public."GovernancePosition" USING btree ("structureId");


--
-- Name: GovernanceStructure_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernanceStructure_isActive_idx" ON public."GovernanceStructure" USING btree ("isActive");


--
-- Name: GovernanceStructure_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GovernanceStructure_name_key" ON public."GovernanceStructure" USING btree (name);


--
-- Name: GovernanceStructure_startDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GovernanceStructure_startDate_idx" ON public."GovernanceStructure" USING btree ("startDate");


--
-- Name: HallOfFameEntry_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HallOfFameEntry_category_idx" ON public."HallOfFameEntry" USING btree (category);


--
-- Name: HallOfFameEntry_isPublished_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HallOfFameEntry_isPublished_idx" ON public."HallOfFameEntry" USING btree ("isPublished");


--
-- Name: ImportBatch_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImportBatch_createdById_idx" ON public."ImportBatch" USING btree ("createdById");


--
-- Name: ImportBatch_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImportBatch_status_idx" ON public."ImportBatch" USING btree (status);


--
-- Name: Notification_userId_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_isRead_idx" ON public."Notification" USING btree ("userId", "isRead");


--
-- Name: PersonChild_childId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PersonChild_childId_idx" ON public."PersonChild" USING btree ("childId");


--
-- Name: PersonChild_parentId_childId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PersonChild_parentId_childId_key" ON public."PersonChild" USING btree ("parentId", "childId");


--
-- Name: PersonChild_sourceSubmissionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PersonChild_sourceSubmissionId_idx" ON public."PersonChild" USING btree ("sourceSubmissionId");


--
-- Name: PersonPartner_orderIndex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PersonPartner_orderIndex_idx" ON public."PersonPartner" USING btree ("orderIndex");


--
-- Name: PersonPartner_partnerAId_partnerBId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PersonPartner_partnerAId_partnerBId_key" ON public."PersonPartner" USING btree ("partnerAId", "partnerBId");


--
-- Name: PersonPartner_partnerBId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PersonPartner_partnerBId_idx" ON public."PersonPartner" USING btree ("partnerBId");


--
-- Name: Person_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Person_branchId_idx" ON public."Person" USING btree ("branchId");


--
-- Name: Person_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Person_deletedAt_idx" ON public."Person" USING btree ("deletedAt");


--
-- Name: Person_externalRef_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Person_externalRef_key" ON public."Person" USING btree ("externalRef");


--
-- Name: Person_fullName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Person_fullName_idx" ON public."Person" USING btree ("fullName");


--
-- Name: Person_generationLevel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Person_generationLevel_idx" ON public."Person" USING btree ("generationLevel");


--
-- Name: Person_isDeceased_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Person_isDeceased_idx" ON public."Person" USING btree ("isDeceased");


--
-- Name: Person_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Person_slug_idx" ON public."Person" USING btree (slug);


--
-- Name: Person_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Person_slug_key" ON public."Person" USING btree (slug);


--
-- Name: ReunionRegistration_reunionId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ReunionRegistration_reunionId_userId_key" ON public."ReunionRegistration" USING btree ("reunionId", "userId");


--
-- Name: Reunion_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Reunion_slug_key" ON public."Reunion" USING btree (slug);


--
-- Name: Reunion_startAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Reunion_startAt_idx" ON public."Reunion" USING btree ("startAt");


--
-- Name: Reunion_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Reunion_status_idx" ON public."Reunion" USING btree (status);


--
-- Name: SocialLink_personId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SocialLink_personId_idx" ON public."SocialLink" USING btree ("personId");


--
-- Name: SocialLink_platformId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SocialLink_platformId_idx" ON public."SocialLink" USING btree ("platformId");


--
-- Name: SocialPlatform_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SocialPlatform_name_key" ON public."SocialPlatform" USING btree (name);


--
-- Name: Submission_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_status_idx" ON public."Submission" USING btree (status);


--
-- Name: Submission_submittedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_submittedByUserId_idx" ON public."Submission" USING btree ("submittedByUserId");


--
-- Name: Submission_targetPersonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_targetPersonId_idx" ON public."Submission" USING btree ("targetPersonId");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_passwordResetToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_passwordResetToken_key" ON public."User" USING btree ("passwordResetToken");


--
-- Name: User_personId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_personId_key" ON public."User" USING btree ("personId");


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: AdminNote AdminNote_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminNote"
    ADD CONSTRAINT "AdminNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AdminNote AdminNote_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminNote"
    ADD CONSTRAINT "AdminNote_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Album Album_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Album"
    ADD CONSTRAINT "Album_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Album Album_publishedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Album"
    ADD CONSTRAINT "Album_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Article Article_authorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Article"
    ADD CONSTRAINT "Article_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Article Article_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Article"
    ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."ArticleCategory"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Article Article_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Article"
    ADD CONSTRAINT "Article_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Article Article_reviewedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Article"
    ADD CONSTRAINT "Article_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditLog AuditLog_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BranchRepresentative BranchRepresentative_assignedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BranchRepresentative"
    ADD CONSTRAINT "BranchRepresentative_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BranchRepresentative BranchRepresentative_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BranchRepresentative"
    ADD CONSTRAINT "BranchRepresentative_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BranchRepresentative BranchRepresentative_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BranchRepresentative"
    ADD CONSTRAINT "BranchRepresentative_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Branch Branch_adminId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Branch Branch_rootPersonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_rootPersonId_fkey" FOREIGN KEY ("rootPersonId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Education Education_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Education"
    ADD CONSTRAINT "Education_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GalleryMedia GalleryMedia_albumId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GalleryMedia"
    ADD CONSTRAINT "GalleryMedia_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES public."Album"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GalleryMedia GalleryMedia_moderatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GalleryMedia"
    ADD CONSTRAINT "GalleryMedia_moderatedByUserId_fkey" FOREIGN KEY ("moderatedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GalleryMedia GalleryMedia_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GalleryMedia"
    ADD CONSTRAINT "GalleryMedia_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GalleryMedia GalleryMedia_uploadedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GalleryMedia"
    ADD CONSTRAINT "GalleryMedia_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GovernanceAssignment GovernanceAssignment_assignedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernanceAssignment"
    ADD CONSTRAINT "GovernanceAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GovernanceAssignment GovernanceAssignment_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernanceAssignment"
    ADD CONSTRAINT "GovernanceAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GovernanceAssignment GovernanceAssignment_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernanceAssignment"
    ADD CONSTRAINT "GovernanceAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GovernanceAssignment GovernanceAssignment_positionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernanceAssignment"
    ADD CONSTRAINT "GovernanceAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES public."GovernancePosition"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GovernancePosition GovernancePosition_parentPositionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernancePosition"
    ADD CONSTRAINT "GovernancePosition_parentPositionId_fkey" FOREIGN KEY ("parentPositionId") REFERENCES public."GovernancePosition"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GovernancePosition GovernancePosition_structureId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GovernancePosition"
    ADD CONSTRAINT "GovernancePosition_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES public."GovernanceStructure"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HallOfFameEntry HallOfFameEntry_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HallOfFameEntry"
    ADD CONSTRAINT "HallOfFameEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HallOfFameEntry HallOfFameEntry_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HallOfFameEntry"
    ADD CONSTRAINT "HallOfFameEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ImportBatch ImportBatch_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportBatch"
    ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PersonChild PersonChild_childId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonChild"
    ADD CONSTRAINT "PersonChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PersonChild PersonChild_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonChild"
    ADD CONSTRAINT "PersonChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PersonChild PersonChild_sourceSubmissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonChild"
    ADD CONSTRAINT "PersonChild_sourceSubmissionId_fkey" FOREIGN KEY ("sourceSubmissionId") REFERENCES public."Submission"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PersonPartner PersonPartner_partnerAId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonPartner"
    ADD CONSTRAINT "PersonPartner_partnerAId_fkey" FOREIGN KEY ("partnerAId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PersonPartner PersonPartner_partnerBId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonPartner"
    ADD CONSTRAINT "PersonPartner_partnerBId_fkey" FOREIGN KEY ("partnerBId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PersonPrivate PersonPrivate_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PersonPrivate"
    ADD CONSTRAINT "PersonPrivate_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Person Person_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Person"
    ADD CONSTRAINT "Person_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ReunionRegistration ReunionRegistration_reunionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReunionRegistration"
    ADD CONSTRAINT "ReunionRegistration_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES public."Reunion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReunionRegistration ReunionRegistration_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReunionRegistration"
    ADD CONSTRAINT "ReunionRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Reunion Reunion_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reunion"
    ADD CONSTRAINT "Reunion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SocialLink SocialLink_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocialLink"
    ADD CONSTRAINT "SocialLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SocialLink SocialLink_platformId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocialLink"
    ADD CONSTRAINT "SocialLink_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES public."SocialPlatform"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Submission Submission_appliedPersonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_appliedPersonId_fkey" FOREIGN KEY ("appliedPersonId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Submission Submission_reviewedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Submission Submission_submittedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Submission Submission_targetPersonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict W1dJwQILw4sdfVr3c2UrVAw15QUqj9N3QSgEFrdDT7fHzRcVREP0MCz7bReRoWQ

