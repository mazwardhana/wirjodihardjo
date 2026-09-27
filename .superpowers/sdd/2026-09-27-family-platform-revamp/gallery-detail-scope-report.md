# Gallery Detail and Album Metadata Scope Report

**Task**: Prevent cross-branch gallery metadata from reaching `BRANCH_ADMIN` users.
**Branch**: `feature/family-revamp`
**Date**: 2026-09-27

## Scope

Only gallery admin detail/list behavior was changed. Auth, onboarding, PWA, migration, and user-import validator code were not touched.

## Findings Fixed

### Admin album detail

Updated `src/app/admin/galeri/[slug]/page.tsx` to:

- Resolve the actor with `requireAdminScope`.
- Select `uploader.person.branchId` with each media row.
- Return all media to `SUPER_ADMIN`.
- Return only media whose uploader person branch matches `scope.branchId` to `BRANCH_ADMIN`.
- Preserve the existing album metadata and client payload shape.

### Admin album list API

Updated `src/app/api/admin/galeri/route.ts` `GET` to:

- Preserve the existing full album and media count for `SUPER_ADMIN`.
- Filter `BRANCH_ADMIN` album media to the admin branch.
- Set `_count.media` from the filtered media array, so cross-branch and unscoped media are excluded from the count.
- Preserve the existing create, update, and delete RBAC paths.

## Tests

Focused tests were added or updated:

- `src/app/admin/galeri/[slug]/page.test.ts` (3 tests)
  - exercises the actual server component via transpiled module loading
  - branch admin receives only media from their branch
  - super admin receives all media
  - branch admin receives empty media when no match exists
- `src/app/api/admin/galeri/route.test.ts` (6 tests, +2 added)
  - branch admin `_count.media` excludes cross-branch media
  - branch admin media array is filtered to their branch
  - super admin count and media remain global
  - existing album list and update/delete RBAC tests remain covered

### RED evidence

- API route test: run before implementation, failed with `Expected values to be strictly equal: 4 !== 2`, confirming the unscoped count leaked cross-branch metadata.
- Page test: reverted to pre-fix implementation (`HEAD~1`), 3/3 tests failed confirming the page returned all media to BRANCH_ADMIN before the fix.

After implementation, all focused gallery tests pass.

## Verification

```text
npx tsx --test src/app/admin/galeri/[slug]/page.test.ts \
  src/app/api/admin/galeri/route.test.ts \
  src/app/api/galeri/upload/route.test.ts
15 tests passed, 0 failed (3 page + 6 route + 6 upload regression)

npx tsc --noEmit
exit 0
```

No unrelated TypeScript errors were reported.

## Commit

`fix: scope gallery album metadata by branch`
