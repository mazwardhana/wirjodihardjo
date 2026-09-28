import { AuthorizationError, type AdminScope } from "@/lib/rbac";

/**
 * Menentukan cabang yang boleh dilihat sebuah permintaan dashboard keluarga.
 * Fail-closed:
 * - SUPER_ADMIN: wajib memilih cabang lewat dropdown (1-10).
 * - BRANCH_ADMIN: terkunci ke cabang penugasan; cabang lain ditolak 403.
 */
export function resolveKeluargaBranch(
  scope: AdminScope,
  requestedBranchId?: string | null,
): string {
  if (scope.role === "SUPER_ADMIN") {
    if (!requestedBranchId) {
      throw new AuthorizationError("Cabang wajib dipilih", 403);
    }
    return requestedBranchId;
  }

  if (!scope.branchId) {
    throw new AuthorizationError("Akses admin ditolak", 403);
  }
  if (requestedBranchId && requestedBranchId !== scope.branchId) {
    throw new AuthorizationError("Di luar cabang Anda", 403);
  }
  return scope.branchId;
}

/** Where clause dasar: anggota sebuah cabang tanpa yang terhapus (soft-delete). */
export function buildBranchWhere(branchId: string) {
  return { branchId, deletedAt: null } as const;
}

/** Variasi where clause untuk tiap angka statistik. */
export function buildStatsWhere(baseWhere: ReturnType<typeof buildBranchWhere>) {
  return {
    total: { ...baseWhere },
    alive: { ...baseWhere, isDeceased: false },
    deceased: { ...baseWhere, isDeceased: true },
    unassigned: { ...baseWhere, generationLevel: null },
    male: { ...baseWhere, gender: "MALE" as const },
    female: { ...baseWhere, gender: "FEMALE" as const },
  };
}
