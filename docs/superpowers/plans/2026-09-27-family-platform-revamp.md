# Revamp Platform Keluarga Wirjodihardjo - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize family platform with 10 fixed branches, enhanced profiles (education/social), simplified import, governance structure, member gallery uploads, landing animations, and PWA install prompt—while fixing critical authorization and media security vulnerabilities.

**Architecture:** Six-phase implementation: (1) schema migrations + RBAC helpers, (2) import simplification + security fixes, (3) profile enhancements + self-edit, (4) governance structure + admin UI, (5) gallery member uploads + secure media serving, (6) landing animations + PWA prompt. Each phase produces independently testable deliverables with verification.

**Tech Stack:** Next.js 16.3.6, React 19, Prisma 7.10, PostgreSQL, NextAuth 5, TypeScript 5, Tailwind 4, Framer Motion 13.4.3 (installed, currently unused), native IntersectionObserver for scroll reveals.

**Spec:** `/home/orca/.opencode/plan/2026-09-27-family-platform-revamp-design.md`

## Global Constraints

- Next.js: 16.3.6 minimum, App Router only, Server Components by default
- PostgreSQL: existing instance on 127.0.0.1:5434, no version upgrade
- Schema changes: additive migrations only (no column drops without explicit approval)
- RBAC: fail-closed (unassigned BRANCH_ADMIN = no access, not all access)
- Forms: all non-article forms use modals (including profile edit)
- Copy: no em dash (—) in UI text; use comma, period, colon, parentheses
- Accessibility: WCAG AA contrast (4.5:1 normal, 3:1 large), 44px tap targets, keyboard navigable
- Motion: respect prefers-reduced-motion, no infinite loops (R-19 antislop)
- Cache: never cache admin pages, pending media, or private profiles in service worker
- Branch numbers: 1-10 permanent, names editable; use branchNumber as stable key

## Review Focus

1. **Cross-branch data leak**: BRANCH_ADMIN edits Person from another branch (test scope validation in anggota PUT, relasi POST, hall-of-fame GET/POST/PUT)
2. **Media moderation bypass**: Direct URL access to PENDING/REJECTED gallery media (test /api/media/[...path] returns 403 for non-approved, album unpublished blocks access)
3. **Import duplicate handling**: Re-importing same externalRef with different data (test upsert behavior, last-write-wins or merge strategy must be explicit)
4. **Governance capacity**: Assigning 3rd person to 2-representative branch position (test atomic capacity enforcement, same-branch membership validation)
5. **Modal focus trap escape**: Pressing Escape in nested modal (profile edit -> education add) (test focus restoration to correct layer, body scroll lock cleanup)

---

## Phase 1: Schema Migrations & RBAC Foundation

### Task 1.1: Branch Number Migration

**Files:**
- Create: `prisma/migrations/TIMESTAMP_add_branch_number/migration.sql`
- Modify: `prisma/schema.prisma:97-115` (Branch model)
- Test: none (migration verification via build)

**Interfaces:**
- Consumes: existing Branch.orderIndex (0-9)
- Produces: Branch.branchNumber (1-10, unique, NOT NULL)


- [ ] **Step 1: Write migration test/check for fixed branch numbers.**

  Before applying the migration, inspect the current ten rows and record `id`, `name`, and `orderIndex`. The expected mapping is `branchNumber = orderIndex + 1`, with the names initialized to Soedjinah, Suwito, Soedono, Soedjilah, Soetomo, Soelarsih, Suherlin, Sumargo, Soegiarto, and Piet Soepriadi in order. Do not silently remap a production branch whose order is already in use.

- [ ] **Step 2: Implement the additive migration.**

  Add nullable `branchNumber`, backfill from `orderIndex + 1`, validate that exactly one row exists for every value 1 through 10, then add `NOT NULL` and a unique constraint. Add the Prisma field and the `Branch` relation fields required by governance in the schema. Keep `orderIndex` for compatibility until all readers use `branchNumber`.

- [ ] **Step 3: Add profile and governance schema models.**

  Add `occupation` and `status` to `Person`; add `Education`, `SocialPlatform`, and `SocialLink`. Add `GovernanceStructure`, `GovernancePosition`, `GovernanceAssignment`, and a separate branch-representative model or an explicit position discriminator. The model must support a parent position, flexible capacity, multiple assignments, and exactly two representative slots per branch. Add indexes and cascading behavior intentionally; `assignedBy` must reference `User` rather than remain an unvalidated string.

- [ ] **Step 4: Generate and apply the Prisma migration in a disposable/test database first.**

  Run `npx prisma migrate dev --create-only`, inspect the SQL for destructive operations, apply it to the test database, and verify all ten fixed branch numbers plus empty nullable fields. Do not apply to production until the migration has been reviewed and a backup exists.

- [ ] **Step 5: Commit the schema foundation.**

  ```bash
  git add prisma/schema.prisma prisma/migrations
  git commit -m "feat: add fixed branches profiles and governance schema"
  ```

### Task 1.2: Central RBAC Scope Helper

**Files:**
- Create: `src/lib/rbac.ts`
- Modify: `src/lib/auth-guard.ts`
- Test: `src/lib/rbac.test.ts`

**Interfaces:**
- Produces `getActorScope(userId: string): Promise<{ role: Role; branchId: string | null }>` where `branchId: null` means unrestricted only for `SUPER_ADMIN`.
- Produces `requireAdminScope(userId: string): Promise<{ role: "SUPER_ADMIN" | "BRANCH_ADMIN"; branchId: string | null }>`; unassigned `BRANCH_ADMIN` throws/returns a 403 result, never a wildcard.
- Produces `assertBranchAccess(scope, branchId: string): void` and `assertPersonAccess(scope, personId: string): Promise<void>`.

- [ ] **Step 1: Write failing unit tests.**

  Cover `SUPER_ADMIN` all-branch access, assigned `BRANCH_ADMIN` own-branch access, assigned branch admin rejection for another branch, unassigned branch admin rejection, MEMBER rejection, and missing user rejection. Mock only the Prisma query boundary.

- [ ] **Step 2: Run the focused tests and verify failure.**

  Run `npx tsx --test src/lib/rbac.test.ts`. Expected: FAIL because the helper and test fixtures do not yet exist.

- [ ] **Step 3: Implement fail-closed scope resolution.**

  Query `User.branchAdminOf.id` together with role. Return unrestricted scope only for SUPER_ADMIN. Treat missing assignment for BRANCH_ADMIN as no scope. Keep role and branch lookup in one helper so route handlers cannot accidentally recreate the unsafe role-only check.

- [ ] **Step 4: Update `requireRole` to return scope information.**

  Modify `src/lib/auth-guard.ts` to select `branchAdminOf.id`, return `branchId`, and optionally enforce `requireAdminScope` for admin pages. Preserve existing redirect behavior for ordinary MEMBER pages.

- [ ] **Step 5: Run tests and commit.**

  ```bash
  npx tsx --test src/lib/rbac.test.ts
  git add src/lib/rbac.ts src/lib/rbac.test.ts src/lib/auth-guard.ts
  git commit -m "feat: add fail-closed branch authorization helpers"
  ```

### Task 1.3: Lock Branch Admin Assignment Rules

**Files:**
- Modify: `src/app/api/admin/cabang/route.ts`
- Modify: `src/app/api/admin/pengguna/route.ts`
- Test: `src/app/api/admin/cabang/route.test.ts`

**Interfaces:**
- Only SUPER_ADMIN may assign or remove `Branch.adminId`.
- A target user must have `role = BRANCH_ADMIN` before assignment.
- Demoting or deleting a branch admin clears `Branch.adminId` in the same transaction.

- [ ] **Step 1: Add failing authorization tests.**

  Test MEMBER target rejection, SUPER_ADMIN target rejection as branch admin, duplicate branch assignment rejection, successful assignment, and demotion clearing the assignment.

- [ ] **Step 2: Implement transactional validation.**

  Keep the one-branch-per-admin constraint. On role changes away from BRANCH_ADMIN, disconnect any branch assignment. On branch assignment, verify role and active status server-side. Never trust a hidden UI select.

- [ ] **Step 3: Run focused tests and commit.**

  ```bash
  npx tsx --test src/app/api/admin/cabang/route.test.ts
  git add src/app/api/admin/cabang/route.ts src/app/api/admin/pengguna/route.ts src/app/api/admin/cabang/route.test.ts
  git commit -m "fix: enforce branch admin assignment integrity"
  ```

---

## Phase 2: Import Simplification and Existing Admin Scoping

### Task 2.1: Simplify the Import Contract

**Files:**
- Modify: `src/lib/import/types.ts`
- Modify: `src/lib/import/template.ts`
- Modify: `src/lib/import/parser.ts`
- Modify: `src/lib/import/validate.ts`
- Modify: `src/lib/import/importer.ts`
- Modify: `src/app/api/admin/impor/route.ts`
- Modify: `src/app/api/admin/impor/commit/route.ts`
- Tests: `src/lib/import/validate.test.ts`, `src/lib/import/importer.test.ts`

**Interfaces:**
- Import row: `cabang_ke`, `nama_lengkap`, `jenis_kelamin`, `nama_panggilan?`, `tempat_lahir?`, `tanggal_lahir?`, `kota_domisili?`, `nomor_telepon?`, `catatan?`.
- Required: branch number, full name, gender. Other fields nullable.
- Commit creates Person and PersonPrivate only; no User, PersonChild, or PersonPartner.

- [ ] **Step 1: Write failing parser and validator tests.**

  Test valid rows with nullable optional values, missing full name, missing gender, invalid branch number, unknown branch number, invalid date, and a duplicate external reference. Assert row-level errors in Indonesian and no relation/account payload is generated.

- [ ] **Step 2: Update the one-sheet template and parser.**

  Keep CSV/XLSX support, but make the downloadable template expose the simplified columns and examples. Do not retain hidden legacy required columns. Normalize gender to the existing enum and preserve optional blank values as `null`.

- [ ] **Step 3: Update validation and commit.**

  Resolve branch by `branchNumber`, not editable name. Preserve `externalRef` for idempotent re-import. Set `generationLevel` and relations untouched. Store `catatan` in the existing private notes field only if that is the established raw-data destination; otherwise add a clearly named raw-import notes field.

- [ ] **Step 4: Enforce importer ownership and scope.**

  Require the committing actor to own the batch unless SUPER_ADMIN explicitly overrides. For any future branch-admin import path, validate every row against the actor's branch; do not rely on the preview. Keep the existing SUPER_ADMIN-only import rule if it is still the product policy, but make the restriction explicit in UI and API tests.

- [ ] **Step 5: Run tests, typecheck, and commit.**

  ```bash
  npx tsx --test src/lib/import/validate.test.ts src/lib/import/importer.test.ts
  npx tsc --noEmit
  git add src/lib/import src/app/api/admin/impor
  git commit -m "feat: simplify member import to raw branch data"
  ```

### Task 2.2: Scope All Branch-Manageable Endpoints

**Files:**
- Modify: `src/app/api/admin/anggota/route.ts`
- Modify: `src/app/api/admin/relasi/route.ts`
- Modify: `src/app/api/admin/hall-of-fame/route.ts`
- Modify: `src/app/api/admin/cari-orang/route.ts`
- Modify: related admin pages that currently query without scope
- Tests: route authorization tests for each endpoint

**Interfaces:**
- Every admin route calls the shared RBAC helper before reading or mutating branch-owned data.
- Branch-admin POST/PUT must validate both old and new branch IDs.

- [ ] **Step 1: Add regression tests for forged cross-branch payloads.**

  Test GET filtering, PUT of another-branch person, POST with another-branch `branchId`, relation add/remove where either endpoint is outside scope, Hall of Fame create/edit outside scope, and person search leakage. Test unassigned BRANCH_ADMIN returns 403.

- [ ] **Step 2: Add server-side guards.**

  Scope list queries with `branchId`; for relation mutations validate every involved Person; for Hall of Fame follow `entry.person.branchId`; for search add both role and branch filters. Keep DELETE/restore operations SUPER_ADMIN-only where currently specified.

- [ ] **Step 3: Scope server-rendered admin pages.**

  Ensure UI restrictions are backed by the same database scope. A branch admin must not receive another branch in a select simply because the browser can inspect the response.

- [ ] **Step 4: Run security tests and commit.**

  ```bash
  npx tsx --test src/app/api/admin/anggota/route.test.ts src/app/api/admin/relasi/route.test.ts src/app/api/admin/hall-of-fame/route.test.ts src/app/api/admin/cari-orang/route.test.ts
  git add src/app/api/admin src/app/admin
  git commit -m "fix: enforce branch scope across admin endpoints"
  ```

### Task 2.3: Clarify Article Global Admin Permissions

**Files:**
- Modify: `src/app/api/admin/artikel/route.ts`
- Modify: `src/app/api/admin/artikel/review/route.ts`
- Modify: admin article UI copy and action visibility
- Test: article authorization tests

- [ ] **Step 1: Add tests for the approved policy.**

  Confirm MEMBER submission through `/api/artikel` remains allowed and PENDING. Confirm SUPER_ADMIN and assigned BRANCH_ADMIN may upload, edit, and moderate any article globally. Confirm unassigned BRANCH_ADMIN is rejected. Confirm the optional article `personId` never changes authorization.

- [ ] **Step 2: Implement the explicit role policy.**

  Use the shared guard for admin article operations. Do not infer article scope from author or subject branch. Keep article approval separate from branch-owned member data.

- [ ] **Step 3: Run tests and commit.**

  ```bash
  npx tsx --test src/app/api/artikel/route.test.ts src/app/api/admin/artikel/route.test.ts src/app/api/admin/artikel/review/route.test.ts
  git add src/app/api/artikel src/app/api/admin/artikel
  git commit -m "fix: separate global article moderation from branch scope"
  ```

---

## Phase 3: Profile Enhancements (Education, Social, Self-Edit Modal)

### Task 3.1: Profile Schema Applied & API
- Add Education/SocialLink CRUD endpoints
- Update `/api/profil/update` with new fields (occupation, status)
- Validate own-profile-only edit (no branch/role/relation changes)
- Modal-based profile edit UI component

### Task 3.2: Profile Display & Privacy
- Public vs family-only field rendering
- WhatsApp link generation from phone
- Social platform icons & ordering
- Age auto-calculation from birthDate

---

## Phase 4: Governance Structure

### Task 4.1: Governance CRUD
- Create structure with flexible positions
- Assign persons to positions (capacity validation, branch-rep 2-per-branch limit)
- SUPER_ADMIN manages global positions; BRANCH_ADMIN manages own 2 reps only

### Task 4.2: Public Org Chart
- `/pengurus` public page: desktop tree, mobile accordion
- Filter active structure, display assigned persons with branch info

---

## Phase 5: Gallery Member Upload & Secure Media Serving

### Task 5.1: Member Gallery Upload
- New endpoint `/api/galeri/upload` (authenticated MEMBER+)
- Auto-set status PENDING, notify admins
- Reuse existing admin moderation UI

### Task 5.2: Secure Media Serving Fix
- Modify `/api/media/[...path]` to check GalleryMedia.status + Album.isPublished
- PENDING/REJECTED: owner or moderator only
- Unknown files: fail closed (no public fallback for orphan media)
- Change cache header to `private` for moderated content

---

## Phase 6: Landing Animations & PWA

### Task 6.1: Branch Cards with Motion
- 10-card grid responsive (2/3/5 columns)
- Scroll-reveal stagger (60ms), hover lift, keyboard focus
- Reuse Reveal.tsx, add IntersectionObserver stagger

### Task 6.2: PWA Install Prompt
- Verify manifest fields, add maskable icon if missing
- Service worker: cache static + approved media only (exclude admin/PENDING/private)
- InstallPrompt component: show after 2s, dismiss to localStorage
- iOS manual instructions

---

## Execution Strategy

**Recommended: Subagent-driven** - Fresh subagent per task with independent review gates. Total ~18-20 tasks across 6 phases.

**Alternative: Native** - Main session implements all tasks sequentially, then one holistic review.

**For this plan I recommend Subagent-driven**, because authorization boundary testing (Phase 1-2) and security-sensitive media serving (Phase 5.2) benefit from independent verification, and the 6 phases can pipeline (schema → security → features → UI).

