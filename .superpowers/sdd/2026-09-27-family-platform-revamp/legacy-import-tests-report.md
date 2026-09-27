# Legacy Import Tests — Alignment Report

## Status: Complete

Aligned `tests/import-format.test.ts` and `tests/import-transaction.test.ts` with the simplified import contract introduced by `b9702dc` and `5e1789c`.

## Commit

`test: align import tests with simplified contract`

## What Changed

### Contract changes reflected
- Single **Data** sheet (was Anggota/Relasi/Akun).
- Required fields: `cabang_ke`, `nama_lengkap`, `jenis_kelamin`.
- Optional fields: `nama_panggilan`, `tempat_lahir`, `tanggal_lahir`, `kota_domisili`, `nomor_telepon`, `catatan`, `ref`.
- Gender aliases (`L`/`P`/`pria`/`perempuan`, etc.) normalize to `MALE`/`FEMALE`/`OTHER`.
- `ParsedData` now carries only `anggota`; no `relasi`/`akun` payload.
- `validateImportData` is now async and checks branch existence + external-ref collisions against the database.

### tests/import-format.test.ts
- Rewrote parser/template/validation tests around the single Data sheet.
- Added required-column parse-time rejection test.
- Gender alias normalization and invalid-gender row-error tests.
- Removed all relasi/akun validation tests (two-parent guards, cycles, account refs, etc.).

### tests/import-transaction.test.ts
- Removed relation (PersonChild/PersonPartner) and account (User/bcrypt) transaction tests.
- Kept mock-based commit tests for Person + PersonPrivate upsert, transaction rollback, batch status guards, authorization, serialization/P2034, and concurrency.
- Added `analyzeImportData` upsert-count test.
- Branch resolution now keyed on `branchNumber`; row errors carry `sheet: "Data"`.

## Tests

- `npx tsc --noEmit` — clean (0 errors).
- `tests/import-format.test.ts` — 19/19 pass.
- `tests/import-transaction.test.ts` — 20/20 pass.

Run command (requires local DB at `DATABASE_URL`):
```
DATABASE_URL='postgresql://wirjo:wirjo_secret@localhost:5434/wirjodihardjo' npx tsx --test tests/import-format.test.ts tests/import-transaction.test.ts
```

## Concerns (not blocking, reported separately)

1. **Template example row is not actually skipped by the parser.**
   - `src/lib/import/template.ts` emits example row `"Tn. Contoh Wirjodihardjo"` in both XLSX and CSV.
   - `src/lib/import/parser.ts` only skips rows whose `namaLengkap` **starts with** `CONTOH` (`values.namaLengkap?.toUpperCase().startsWith("CONTOH")`).
   - `"Tn. Contoh Wirjodihardjo".toUpperCase()` begins with `"TN. "`, so the example row is **parsed as real data**, not dropped.
   - The template instructions claim "Baris dengan nama diawali 'CONTOH' akan diabaikan" (rows whose name *begins with* CONTOH are ignored), which contradicts the actual example name.
   - This is a production-contract inconsistency (not fixed here per instruction "do not modify production import code"). The test was written to assert the *actual current behavior* (example row is retained as `anggota[0]`) and the discrepancy is flagged here.

2. **`ImportRowAnggota.cabangKe` is typed `number` (required) but the parser coerces missing values to `0`.**
   - `parser.ts` `appendRow` sets `cabangKe: values.cabangKe ? Number(values.cabangKe) : 0`. A non-numeric or empty `cabang_ke` becomes `0`, which validation then rejects as out of range (1–10). This is a reasonable defense, but the type (`number`, non-optional) does not reflect that `0`/`NaN` may flow into `ImportRowAnggota` before validation. Not a bug per se, just a type/contract mismatch worth a glance.
