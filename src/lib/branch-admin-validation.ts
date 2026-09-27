import { prisma } from "@/lib/prisma";

export class BranchAdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BranchAdminValidationError";
  }
}

type UserBoundary = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { role: string; isActive: boolean };
    }): Promise<{ role: string; isActive: boolean } | null>;
  };
};

type BranchBoundary = {
  branch: {
    updateMany(args: {
      where: { adminId: string };
      data: { adminId: null };
    }): Promise<{ count: number }>;
  };
};

/**
 * Validate that a user can be assigned as a branch admin.
 * The target must exist, hold the BRANCH_ADMIN role, and be active.
 * Throws BranchAdminValidationError when any condition fails.
 */
export async function validateBranchAdminAssignment(
  userId: string,
  db: UserBoundary = prisma,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (!user) {
    throw new BranchAdminValidationError("Pengguna tidak ditemukan");
  }

  if (user.role !== "BRANCH_ADMIN") {
    throw new BranchAdminValidationError("Hanya BRANCH_ADMIN yang dapat ditugaskan sebagai admin cabang");
  }

  if (!user.isActive) {
    throw new BranchAdminValidationError("Pengguna tidak aktif");
  }
}

/**
 * Disconnect a user from any branch they administer.
 * Called inside a transaction when a role change moves a user away
 * from BRANCH_ADMIN, preserving the one-branch-per-admin invariant.
 */
export async function clearBranchAdminOnDemotion(
  userId: string,
  newRole: string,
  db: BranchBoundary = prisma,
): Promise<void> {
  if (newRole === "BRANCH_ADMIN") {
    return;
  }

  await db.branch.updateMany({
    where: { adminId: userId },
    data: { adminId: null },
  });
}
