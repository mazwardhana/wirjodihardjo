import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ActorScope = {
  role: Role;
  branchId: string | null;
};

export type AdminScope = {
  role: "SUPER_ADMIN" | "BRANCH_ADMIN";
  branchId: string | null;
};

type PrismaBoundary = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { role: true; branchAdminOf: { select: { id: true } } };
    }): Promise<{ role: Role; branchAdminOf: { id: string } | null } | null>;
  };
  person: {
    findUnique(args: {
      where: { id: string };
      select: { branchId: true };
    }): Promise<{ branchId: string | null } | null>;
  };
};

export class AuthorizationError extends Error {
  readonly status: 403 | 404;

  constructor(message: string, status: 403 | 404) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

/** Resolve the actor role and branch assignment in one database read. */
export async function getActorScope(userId: string, db: PrismaBoundary = prisma): Promise<ActorScope> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      branchAdminOf: { select: { id: true } },
    },
  });

  if (!user) {
    throw new AuthorizationError("User tidak ditemukan", 404);
  }

  return {
    role: user.role,
    branchId: user.role === "SUPER_ADMIN" ? null : user.branchAdminOf?.id ?? null,
  };
}

/** Require an admin scope. Missing branch assignment is deliberately denied. */
export async function requireAdminScope(userId: string, db: PrismaBoundary = prisma): Promise<AdminScope> {
  const scope = await getActorScope(userId, db);

  if (scope.role === "SUPER_ADMIN") {
    return { role: "SUPER_ADMIN", branchId: null };
  }

  if (scope.role !== "BRANCH_ADMIN" || scope.branchId === null) {
    throw new AuthorizationError("Akses admin ditolak", 403);
  }

  return { role: "BRANCH_ADMIN", branchId: scope.branchId };
}

/** Assert that a branch falls within the actor's resolved scope. */
export function assertBranchAccess(scope: ActorScope | AdminScope, branchId: string): void {
  if (scope.role === "SUPER_ADMIN") {
    return;
  }

  if (scope.role !== "BRANCH_ADMIN" || scope.branchId === null || scope.branchId !== branchId) {
    throw new AuthorizationError("Di luar cabang Anda", 403);
  }
}

/** Resolve a person branch and assert access without trusting caller-supplied scope data. */
export async function assertPersonAccess(
  scope: ActorScope | AdminScope,
  personId: string,
  db: PrismaBoundary = prisma,
): Promise<void> {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: { branchId: true },
  });

  if (!person) {
    throw new AuthorizationError("Person tidak ditemukan", 404);
  }

  if (scope.role === "SUPER_ADMIN") {
    return;
  }

  assertBranchAccess(scope, person.branchId ?? "");
}
