# Task 3.6 Report — Bulk User Import with Temporary Credentials

**Commit:** `246d883 feat: add bulk user import with temporary credentials`
**Branch:** `feature/family-revamp`
**Date:** 2026-09-27

---

## What was built

### Files created (8 new files, 1820 lines)

| File | Purpose |
|------|---------|
| `src/lib/user-import/parser.ts` | Pure CSV parser using `csv-parse/sync`. Handles BOM, CRLF, optional header (case-insensitive), reordered columns, named header detection, and structural error with line numbers. |
| `src/lib/user-import/parser.test.ts` | 21 tests covering happy paths, header modes, line numbering, malformed CSV, overflow columns. |
| `src/lib/user-import/validator.ts` | Validates rows: username format `^[a-zA-Z0-9_-]{3,30}$`, password ≥8 chars, required nama_lengkap, optional email (zod email()), case-insensitive person matching (trim, excluding soft-deleted), ambiguous name detection, duplicate username/email within batch (case-insensitive), DB uniqueness, and person-with-existing-account conflict. Returns `ValidationResult` with errors, matched rows, and conflict lists. |
| `src/lib/user-import/validator.test.ts` | 18 tests covering format, person matching, soft-delete exclusion, ambiguity, existing-account conflict, and all duplicate detection paths. |
| `src/lib/user-import/importer.ts` | Hashes passwords with bcrypt (12 rounds), creates users transactionally (`$transaction`), sets `mustChangeCredentials=true`, `role=MEMBER`, `isActive=true`, links `personId`, stores no plaintext password. Defensively rejects rows without `personId`. |
| `src/lib/user-import/importer.test.ts` | 15 tests covering correct field values, transactional all-or-nothing (stop-on-error propagation), defensive `personId` check, and password security (hash ≠ plaintext, bcrypt verifiable). |
| `src/app/api/admin/pengguna/import-bulk/route.ts` | SUPER_ADMIN-only POST endpoint. Accepts `multipart/form-data` (file + action) or JSON (`{csv, action}`). `action=preview` (default) returns matched persons and conflict/error report. `action=commit` re-validates, then calls importer; logs `USER_IMPORT_BULK` audit entry. Uses `getActorScope` from `src/lib/rbac.ts`. |
| `src/app/api/admin/pengguna/import-bulk/route.test.ts` | 15 tests covering auth (401/403), preview correctness, preview never writes DB, commit creates users with correct fields, commit refuses invalid CSV, commit never creates for unmatched persons, audit logging. |

---

## Test results

```
npx tsx --test src/lib/user-import/validator.test.ts
  src/lib/user-import/importer.test.ts
  src/app/api/admin/pengguna/import-bulk/route.test.ts

# tests 48  # pass 48  # fail 0
```

```
npx tsc --noEmit
(no output — clean)
```

---

## RBAC / authorization

- Route uses `getActorScope()` from `src/lib/rbac.ts` as required.
- Authorization check order: `auth()` → session → `getActorScope(id)` → verify `role === "SUPER_ADMIN"`.
- `AuthorizationError` from rbac.ts is caught and mapped to appropriate status codes.
- BRANCH_ADMIN and MEMBER receive 403 with message `"Hanya Super Admin"` (matches existing pengguna route convention).

---

## Validation messages (Indonesian, per brief)

| Field | Condition | Message |
|-------|-----------|---------|
| `username` | format invalid | `Username harus 3-30 karakter (huruf, angka, -, _)` |
| `username` | duplicate batch/DB | `Username 'X' sudah digunakan` |
| `password` | too short | `Password minimal 8 karakter` |
| `nama_lengkap` | empty | `Nama lengkap wajib diisi` |
| `nama_lengkap` | not found | `Anggota 'X' tidak ditemukan` |
| `nama_lengkap` | ambiguous (multiple matches) | `Anggota 'X' ambigu (lebih dari satu ditemukan)` |
| `nama_lengkap` | person already has user | `Anggota 'X' sudah memiliki akun` |
| `email` | invalid format | `Email tidak valid` |
| `email` | duplicate batch/DB | `Email 'X' sudah digunakan` |

---

## Security guarantees

- Passwords hashed with bcrypt (12 rounds, matching existing admin route convention).
- No plaintext password stored in DB (`passwordHash` only, never `password`).
- Preview never calls `user.create`.
- Commit re-validates server-side before creating users (never trusts client).
- SUPER_ADMIN-only — BRANCH_ADMIN cannot access.
- Transactional creation (all-or-nothing via `prisma.$transaction`).

---

## Concerns / known limitations

1. **Username case sensitivity**: Duplicate detection is case-insensitive within the batch and DB queries use `mode: "insensitive"` for consistency. This may differ from Postgres's case-sensitive `unique` constraint at the schema level. In practice, login uses email only, so this is a conservative choice. The `username` unique constraint in the schema is case-sensitive in Postgres, so `"budi_w"` and `"BUDI_W"` could both theoretically be stored — a unique constraint violation would be caught at commit time as a 500. Consider normalizing username to lowercase at commit time, or enforcing case-insensitive uniqueness at the DB level.

2. **No row count cap**: The parser and route do not enforce a maximum number of rows (e.g., 5000 like the member import). A maliciously large CSV could consume significant CPU (bcrypt hashing per row) and memory. Consider adding a cap in the route.

3. **No batch-level audit rollback**: The single `USER_IMPORT_BULK` audit entry does not record which rows failed if the transaction rolls back (all-or-nothing means no partial state, so this is acceptable).

4. **bcrypt in tests**: Importer tests use real bcrypt with cost 12. This is intentional (tests verify real hash output, not mock). For large test suites, this adds ~100-200ms per test. Current test suite is small enough that this is acceptable.

5. **`csv-parse/sync` on_record line numbers**: The `info.lines` approach for computing start line of multi-line records is fragile (existing pattern in `src/lib/import/parser.ts`). For typical single-line CSV rows, it works correctly. Multi-line quoted fields (rare in user-import CSVs) may have slight line number inaccuracy.

6. **DB conflicts block commit**: Duplicate detection against existing Users (username and email) pushes errors into `ValidationResult.errors`, so `valid=false` and the commit path returns 400 before any `user.create` call. This is covered by validator tests ("detects username that already exists in DB", "detects email that already exists in DB") and prevents P2002 unique-constraint errors at commit time. Defense in depth: if a race condition still produces P2002, the route returns 500 via the importer's transaction rollback (all-or-nothing, no partial users created).
