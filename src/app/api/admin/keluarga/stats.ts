import { prisma } from "@/lib/prisma";
import { requireAdminScope, type AdminScope } from "@/lib/rbac";
import { buildBranchWhere, buildStatsWhere, resolveKeluargaBranch } from "./scope";

export type KeluargaStats = {
  total: number;
  alive: number;
  deceased: number;
  unassigned: number;
  male: number;
  female: number;
  generationLevels: number[];
};

export type KeluargaBranchInfo = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  branchNumber: number;
  adminName: string | null;
  rootPersonName: string | null;
  memberCount: number;
};

export type KeluargaStatsResult = {
  branchId: string;
  branch: KeluargaBranchInfo | null;
  stats: KeluargaStats;
};

type StatsBoundary = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { role: true; branchAdminOf: { select: { id: true } } };
    }): Promise<{ role: AdminScope["role"] | string; branchAdminOf: { id: string } | null } | null>;
  };
  person: {
    count(args: { where: Record<string, unknown> }): Promise<number>;
    groupBy(args: {
      by: ["generationLevel"];
      where: Record<string, unknown>;
      _count: { _all: true };
    }): Promise<Array<{ generationLevel: number | null; _count: { _all: number } }>>;
  };
  branch: {
    findUnique(args: {
      where: { id: string };
      include: Record<string, unknown>;
    }): Promise<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      branchNumber: number;
      admin: { person: { fullName: string } | null } | null;
      rootPerson: { fullName: string } | null;
      _count: { members: number };
    } | null>;
  };
};

export async function getKeluargaStats(
  userId: string,
  requestedBranchId: string | null | undefined,
  db: StatsBoundary = prisma as unknown as StatsBoundary,
): Promise<KeluargaStatsResult> {
  const scope = await requireAdminScope(userId, db as never);
  const branchId = resolveKeluargaBranch(scope, requestedBranchId);

  const where = buildBranchWhere(branchId);
  const statsWhere = buildStatsWhere(where);

  const [total, alive, deceased, unassigned, male, female, generationRows, branch] =
    await Promise.all([
      db.person.count({ where: statsWhere.total }),
      db.person.count({ where: statsWhere.alive }),
      db.person.count({ where: statsWhere.deceased }),
      db.person.count({ where: statsWhere.unassigned }),
      db.person.count({ where: statsWhere.male }),
      db.person.count({ where: statsWhere.female }),
      db.person.groupBy({
        by: ["generationLevel"],
        where: { ...where },
        _count: { _all: true },
      }),
      db.branch.findUnique({
        where: { id: branchId },
        include: {
          rootPerson: { select: { fullName: true } },
          admin: { select: { person: { select: { fullName: true } } } },
          _count: { select: { members: true } },
        },
      }),
    ]);

  const generationLevels = generationRows
    .filter((row) => row.generationLevel !== null)
    .map((row) => row.generationLevel as number)
    .sort((a, b) => a - b);

  return {
    branchId,
    branch: branch
      ? {
          id: branch.id,
          name: branch.name,
          slug: branch.slug,
          description: branch.description,
          branchNumber: branch.branchNumber,
          adminName: branch.admin?.person?.fullName ?? null,
          rootPersonName: branch.rootPerson?.fullName ?? null,
          memberCount: branch._count.members,
        }
      : null,
    stats: { total, alive, deceased, unassigned, male, female, generationLevels },
  };
}
