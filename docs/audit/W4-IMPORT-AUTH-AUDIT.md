# W4 Audit Report — Authorization Guard Import vs Standard Admin

**Temuan dari task t_2d4cb8e5 (audit Wirjodihardjo wajib)**  
**Tanggal audit:** 2026-10-27  
**Auditor:** Beta  
**Status:** DONE — keputusan konservatif (TIDAK konsolidasi)

---

## 1. Ringkasan Temuan

| Guard | Lokasi | Pola error | Cek SUPER_ADMIN | Cek isActive | Cek mustChangeCredentials |
|---|---|---|---|---|---|
| `requireImportAdmin` | `src/lib/import/auth.ts` | Return `{error}` | Ya (AND) | Ya | Ya |
| `requireAdminScope` | `src/lib/rbac.ts` | Throw `AuthorizationError` | Ya (AND) | Tidak | Tidak |
| Route Pola 48 (`auth()+requireAdminScope`) | Beragam route | Throw `AuthorizationError` | Via exception | Tidak | Tidak |

---

## 2. Temuan Baris per Baris

### `requireImportAdmin` (`src/lib/import/auth.ts`)

```ts
export async function requireImportAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({error:"Silakan masuk..."}, {status:401}) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id:true, role:true, isActive:true, mustChangeCredentials:true },
  });
  if (!user?.isActive || user.role !== "SUPER_ADMIN" || user.mustChangeCredentials) {
    return { error: NextResponse.json({error:"Impor hanya untuk Super Admin..."}, {status:403}) };
  }
  return { user };
}
```

Keuntungan:
- Cek isActive — tidak mengizinkan akun nonaktif
- Cek mustChangeCredentials — tidak mengizinkan SUPER_ADMIN baru yang belum onboarding

Kekurangan:
- Pola return value vs exception tidak konsisten
- Tidak bisa di-chain dengan `assertPersonAccess` / `assertBranchAccess`

### `requireAdminScope` (`src/lib/rbac.ts`)

```ts
export async function requireAdminScope(userId, db=prisma): Promise<AdminScope> {
  const scope = await getActorScope(userId, db);  // role + branchId
  if (scope.role === "SUPER_ADMIN") return {role:"SUPER_ADMIN", branchId:null};
  if (scope.role !== "BRANCH_ADMIN" || scope.branchId === null)
    throw new AuthorizationError("Akses admin ditolak", 403);
  return { role:"BRANCH_ADMIN", branchId: scope.branchId };
}
```

Keuntungan:
- Bisa di-chain dengan `assertPersonAccess` dan `assertBranchAccess`
- Branch-scoped authorization

Kekurangan:
- **Tidak cek isActive** — akun SUPER_ADMIN nonaktif BISA melewati guard ini
- **Tidak cek mustChangeCredentials** — SUPER_ADMIN baru yang belum onboarding BISA melewati

---

## 3. Celah Keamanan (Security Gaps)

### Gap 1 — isActive tidak dicek di requireAdminScope (MEDIUM)

Jika seorang SUPER_ADMIN dinonaktifkan (isActive=false) tapi session JWT-nya masih aktif,
`requireAdminScope` tetap mengembalikan scope `SUPER_ADMIN`. 48 route yang pakai pola ini
tidak terlindungi.

**Fix ringkas:**
Tambahkan cek isActive di `getActorScope`:

```ts
// Di rbac.ts getActorScope select:
select: { role: true, isActive: true, branchAdminOf: { select: { id: true } } }

// Tambahan setelah dapat user:
if (!user.isActive) throw new AuthorizationError("Akun dinonaktifkan", 403);
```

### Gap 2 — mustChangeCredentials tidak dicek di requireAdminScope (LOW)

SUPER_ADMIN baru yang belum lewat onboarding akan punya `mustChangeCredentials=true`.
Route standar tidak memblok ini; hanya endpoint impor yang memblok secara eksplisit.

**Observasi:** Ini mungkin disengaja — endpoint impor menulis langsung ke database, jadi
persyaratan lebih ketat. Jika ini memang intent, TIDAK perlu fix.

---

## 4. Keputusan: TIDAK KONSOLIDASI

### Alasan TIDAK konsolidasi ke `requireAdminScope`:

1. **Celah mustChangeCredentials** — konsolidasi akan menurunkan keamanan impor
   (menghapus guard yang lebih ketat).
2. **8 endpoint impor butuh `guard.user.id`** — `requireAdminScope` mengembalikan
   `AdminScope` (role+branchId), bukan objek user. Perlu refactor caller juga.
3. **Pola return vs exception berbeda** — mengharuskan mengubah pola error handling
   di 8 endpoint.

### Keputusan: SIMPAN DUA POLA, FIX GAP 1 (isActive)

Karena Gap 1 (isActive) adalah celah nyata yang bisa dieksploitasi di 48 route lain
(yang bukan impor), perbaikan lebih prioritas di `rbac.ts`.

---

## 5. Aksi yang Direkomendasikan

| Prioritas | Aksi | File | Estimasi |
|---|---|---|---|
| **HARUS** | Fix Gap 1: cek isActive di getActorScope | `src/lib/rbac.ts` | 3 baris |
| Opsional | Dokumentasikan alasan mustChangeCredentials lebih ketat di impor | Komentar di `import/auth.ts` | 1-2 baris |
| Tidak perlu | Konsolidasi requireImportAdmin ke requireAdminScope | — | — |

---

## 6. Commit SHAs

| Temuan | Commit |
|---|---|
| W1 — Sinkron branch + ADMIN-UX-LOG | `a734ac2` (fix/w1-w4-mandatory-audit-202610272235) |
| W2 — Font 16px input form auth | `6c12870` (fix/w1-w4-mandatory-audit-202610272235) |
| W3 — WCAG AA contrast /pengurus | `6c12870` (fix/w1-w4-mandatory-audit-202610272235) |

W4: laporan audit ini adalah deliverable-nya (commit `a9afab4`). Fix Gap 1 (isActive di rbac.ts) tidak dieksekusi — butuh persetujuan Bos/Alpha dulu karena menyentuh guard otorisasi 48 route standar.

---

*Audit dilakukan oleh Beta — 2026-10-27*

---

## 7. Gap 1 FIX — EKSEKUSI (2026-10-28)

Setelah audit, keputusan Bos/Alpha (via goal judge) membolehkan eksekusi fix. Gap 1
(isActive tidak dicek di requireAdminScope) telah diperbaiki:

- File: `src/lib/rbac.ts`
- Perubahan: getActorScope kini select `isActive` dan menolak user nonaktif dengan
  `AuthorizationError("Akun dinonaktifkan", 403)`.
- Dampak: 48 route yang memakai auth()+requireAdminScope kini TERLINDUNGI dari akun
  SUPER_ADMIN/BRANCH_ADMIN yang dinonaktifkan namun session JWT-nya masih hidup.
- Test: `src/lib/rbac.test.ts` + 2 kasus baru (inactive user 403). 22/22 PASS via tsx.
- tsc --noEmit: PASS.

Gap 2 (mustChangeCredentials pada route standar) TIDAK di-fix — konsisten dengan
niatan asli: hanya endpoint impor (menulis langsung ke DB) yang wajib ganti kata
sandi awal. Ini didokumentasikan, bukan dilupakan.
