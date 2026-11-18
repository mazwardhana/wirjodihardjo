# Laporan: Push & Merge release/des2026 → main

**Tanggal eksekusi:** 19 Nov 2026, 01:23–01:55 WIB · **Host:** orca (100.66.50.103) · **Repo:** `/opt/projects/wirjodihardjo` (utama, di `feat/gedcom`) dan worktree `/opt/projects/wirjodihardjo-wt-mainmerge`

## Hasil akhir

| Butir | Nilai | Bukti |
|---|---|---|
| Merge commit di main | `c091b21a90367bc8b5de0f4866bf58d964e7452e` — *"Merge release/des2026: GEDCOM + pedigree/fan + relasi + timeline/memori + kalender"* | `git log --oneline -2` = c091b21 → c5263fd |
| GitHub URL | https://github.com/mazwardhana/wirjodihardjo/commit/c091b21a90367bc8b5de0f4866bf58d964e7452e | `gh api repos/.../commits/c091b21... --jq .html_url` |
| Remote `refs/heads/main` | `c091b21a90367bc8b5de0f4866bf58d964e7452e` | `git ls-remote origin main` |
| Push log | `d11b0f4..c091b21  main -> main`, exit 0 | output `git push origin main` |
| Backup bundle | `/home/orca/backups/wirjo-main-premerge-20261119T012331.bundle` (9.3 MB, 39 refs, "complete history") | `git bundle verify` → "is okay" |
| Verifikasi tsc | `npx tsc --noEmit` → **exit 0** | (setelah `prisma generate` + `next typegen`; lihat catatan) |
| Suite tes | 1107 tes, 62 suite: **1060 pass, 47 fail** — ke-47 persis baseline RBAC pre-existing (dinamai di bawah), 0 gagal baru | `npx tsx --test $(find src tests -name "*.test.ts")` |
| Build produksi | `npm run build` → **exit 0** ("✓ Compiled successfully", 90/90 halaman, sw.js ditulis) — dijalankan 2×, dua-duanya exit 0 | `/home/orca/build-mainmerge2.log`, `build-mainmerge3.log` |
| Smoke HTTP (build produksi, `next start -p 3212`, hanya di worktree) | 19 halaman publik/admin = 200 dengan konten nyata (`<title>Keluarga Besar Wirjodihardjo</title>`, 90 KB HTML); `/admin` & `/dashboard` → 307/redirect login (benar); `/api/admin/gedcom` → 401 tanpa sesi (benar, RBAC); `/api/family/graph` → 400 tanpa personId (benar) | `/home/orca/smoke-results.json` |

## Catatan penting

1. **Merge --no-ff menghasilkan commit baru `c091b21`, bukan `a1eef17`** — sesuai spec, ini normal. Tidak ada redeploy; produksi tetap image `sha256:4928f1358090` (`release-des2026-20261117`).
2. **Worktree mainmerge baru** di `/opt/projects/wirjodihardjo-wt-mainmerge` (`git worktree add`, checkout `main` di `d11b0f4`). Working tree kotor 75 file di repo utama **tidak disentuh sama sekali** (dicek ulang: masih 75 file M, tidak ada commit baru di `feat/gedcom`).
3. **Prisma client + typegen:** tsc pertama gagal (exit 2, 19 error: `FamilyEventType` dkk.) karena `node_modules` repo utama berisi Prisma client lama tanpa model kalender. Diperbaiki dengan menyalin utuh `node_modules` dari worktree rilis (schema identik), `npx prisma generate` (v7.10.0), lalu `npx next typegen`. Setelah itu tsc exit 0 — bukan perubahan kode, hanya artefak build environment worktree baru.
4. **Smoke test 500 di dev-mode:** `next dev` (Turbopack) gagal parse `globals.css` (env() di class arbitrary) → semua halaman 500 di dev. Build produksi TIDAK terpengaruh (build + start exit 0). Ini bug tooling dev-mode, bukan regresi kode.
5. Ke-47 tes gagal = baseline `1e47c6f` (RBAC/branch-admin/relasi/keluarga): nama tes terverifikasi identik dengan daftar pre-existing yang diizinkan spec.
6. `feat/kalender-keluarga` sudah benar-benar masuk rilis (jangan dihapus dari remote).

## Checklist spec A

- [x] Backup bundle + verify — sebelum merge
- [x] Working tree kotor tidak di-commit, tidak `git add -A`
- [x] Worktree mainmerge checkout main
- [x] `git merge --no-ff release/des2026` dengan pesan sesuai spec
- [x] tsc exit 0
- [x] Suite targeted (GEDCOM 82 tes, timeline/calendar/family-tree/genealogy 55 tes) + full suite 1107 tes
- [x] `npm run build` background, exit 0
- [x] `git push origin main` (hanya main; branch lain tidak disentuh)
- [x] Tidak ada redeploy
- [x] Lapor hash merge commit, tsc/tes/build, URL GitHub
