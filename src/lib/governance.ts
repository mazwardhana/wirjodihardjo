import type { OrgChartData, OrgLevel, OrgBranch } from "@/components/governance/OrgChart";
import { buildPengurusPlaceholderData } from "@/components/governance/pengurus-placeholder";

type AssignmentRow = {
  id: string;
  person: {
    id: string;
    fullName: string;
    photoUrl: string | null;
    occupation: string | null;
    branch: { name: string; branchNumber: number } | null;
  };
};

type PositionRow = {
  id: string;
  name: string;
  description: string | null;
  level: number;
  assignments: AssignmentRow[];
};

type RepresentativeRow = {
  id: string;
  branchId: string;
  slot: number;
  notes: string | null;
  person: {
    id: string;
    fullName: string;
    photoUrl: string | null;
    occupation: string | null;
    branch: { name: string; branchNumber: number } | null;
  } | null;
};

type ExpiredRow = { branchId: string; slot: number; notes: string | null };

type StructureRow = { name: string; description: string | null; positions: PositionRow[] };

export type GovernanceBoundary = {
  governanceStructure: {
    findFirst(args: unknown): Promise<unknown>;
  };
  branch: {
    findMany(args: unknown): Promise<unknown>;
  };
  branchRepresentative: {
    findMany(args: unknown): Promise<unknown>;
  };
};

/**
 * Baca data kepengurusan untuk halaman publik `/pengurus`. Saat belum ada
 * struktur aktif, halaman memakai kerangka placeholder supaya pengunjung
 * tetap melihat susunan jabatan yang direncanakan.
 */
export async function getGovernanceData(
  now: Date,
  db: GovernanceBoundary,
): Promise<OrgChartData> {
  const [structure, branches, branchReps, expiredReps] = await Promise.all([
    db.governanceStructure.findFirst({
      where: { isActive: true },
      include: {
        positions: {
          where: { isBranchRepresentative: false },
          include: {
            assignments: {
              where: {
                AND: [
                  { person: { deletedAt: null } },
                  { OR: [{ endDate: null }, { endDate: { gte: now } }] },
                ],
              },
              include: {
                person: {
                  select: {
                    id: true,
                    fullName: true,
                    photoUrl: true,
                    occupation: true,
                    branch: { select: { name: true, branchNumber: true } },
                  },
                },
              },
              orderBy: { startDate: "asc" },
            },
          },
          orderBy: [{ level: "asc" }, { name: "asc" }],
        },
      },
      orderBy: { startDate: "desc" },
    }),
    db.branch.findMany({
      where: { isActive: true },
      orderBy: { branchNumber: "asc" },
      select: { id: true, name: true, branchNumber: true },
    }),
    db.branchRepresentative.findMany({
      where: {
        AND: [
          { person: { deletedAt: null } },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      include: {
        person: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
            occupation: true,
            branch: { select: { name: true, branchNumber: true } },
          },
        },
      },
      orderBy: { slot: "asc" },
    }),
    db.branchRepresentative.findMany({
      where: { endDate: { lt: now }, person: { deletedAt: null } },
      select: { branchId: true, slot: true, notes: true },
      orderBy: { endDate: "desc" },
    }),
  ]);

  const structureRow = structure as StructureRow | null;
  const branchRows = branches as Array<{ id: string; name: string; branchNumber: number }>;
  const activeReps = branchReps as RepresentativeRow[];
  const expired = expiredReps as ExpiredRow[];

  if (!structureRow) {
    return buildPengurusPlaceholderData(branchRows);
  }

  const levels: OrgLevel[] = [];
  const levelMap = new Map<number, OrgLevel["positions"]>();
  for (const position of structureRow.positions) {
    const existing = levelMap.get(position.level) ?? [];
    existing.push({
      id: position.id,
      name: position.name,
      description: position.description,
      assignments: position.assignments.map((a) => ({
        id: a.id,
        person: {
          id: a.person.id,
          fullName: a.person.fullName,
          photoUrl: a.person.photoUrl,
          occupation: a.person.occupation,
          branch: a.person.branch,
        },
      })),
    });
    levelMap.set(position.level, existing);
  }
  for (const [level, positions] of Array.from(levelMap.entries()).sort(([a], [b]) => a - b)) {
    levels.push({ level, positions });
  }

  const branchData: OrgBranch[] = branchRows.map((branch) => {
    const reps = activeReps.filter((r) => r.branchId === branch.id);
    const slot1Rep = reps.find((r) => r.slot === 1);
    const slot2Rep = reps.find((r) => r.slot === 2);

    const slot1Notes = !slot1Rep
      ? expired.find((e) => e.branchId === branch.id && e.slot === 1)?.notes ?? null
      : null;
    const slot2Notes = !slot2Rep
      ? expired.find((e) => e.branchId === branch.id && e.slot === 2)?.notes ?? null
      : null;

    const toSlot = (rep: RepresentativeRow | undefined, notes: string | null) => {
      if (rep) {
        return {
          id: rep.id,
          person: rep.person
            ? {
                id: rep.person.id,
                fullName: rep.person.fullName,
                photoUrl: rep.person.photoUrl,
                occupation: rep.person.occupation,
                branch: rep.person.branch,
              }
            : null,
          notes: rep.notes,
        };
      }
      if (notes) return { id: `empty-${branch.id}`, person: null, notes };
      return null;
    };

    return {
      id: branch.id,
      name: branch.name,
      branchNumber: branch.branchNumber,
      slot1: toSlot(slot1Rep, slot1Notes),
      slot2: toSlot(slot2Rep, slot2Notes),
    };
  });

  return {
    structure: { name: structureRow.name, description: structureRow.description },
    levels,
    branches: branchData,
  };
}
