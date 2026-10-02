import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { OrgChart } from "@/components/governance/OrgChart";
import { OrgChartMobile } from "@/components/governance/OrgChartMobile";
import { buildPengurusPlaceholderData } from "@/components/governance/pengurus-placeholder";
import type { OrgChartData, OrgLevel, OrgBranch } from "@/components/governance/OrgChart";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengurus",
  description: "Struktur kepengurusan keluarga besar Wirjodihardjo.",
};

export default async function PengurusPage() {
  const now = new Date();

  // Empat pembacaan independen dijalankan bersamaan; sebelumnya berurutan
  // (structure → branches → branchReps → expiredReps) sehingga menambah tiga
  // round-trip tanpa alasan.
  const [structure, branches, branchReps, expiredReps] = await Promise.all([
    // Query active governance structure with positions and assignments
    prisma.governanceStructure.findFirst({
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

    // Query active branches
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { branchNumber: "asc" },
      select: { id: true, name: true, branchNumber: true },
    }),

    // Perwakilan keluarga cabang aktif. `branch: true` dihapus karena hanya `branchId`
    // yang dipakai; relasi penuh tidak pernah dirender.
    prisma.branchRepresentative.findMany({
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

    // Perwakilan yang sudah berakhir, untuk catatan pada slot kosong.
    prisma.branchRepresentative.findMany({
      where: {
        endDate: { lt: now },
        person: { deletedAt: null },
      },
      select: {
        branchId: true,
        slot: true,
        notes: true,
      },
      orderBy: { endDate: "desc" },
    }),
  ]);

  // Build level-grouped data
  const levels: OrgLevel[] = [];
  if (structure) {
    const levelMap = new Map<number, OrgLevel["positions"]>();
    for (const position of structure.positions) {
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
  }

  // Build branch data with slots
  const branchData: OrgBranch[] = branches.map((branch) => {
    const reps = branchReps.filter((r) => r.branchId === branch.id);
    const slot1Rep = reps.find((r) => r.slot === 1);
    const slot2Rep = reps.find((r) => r.slot === 2);

    // Find notes from expired representatives if slot empty
    const slot1Notes = !slot1Rep
      ? expiredReps.find((e) => e.branchId === branch.id && e.slot === 1)?.notes ?? null
      : null;
    const slot2Notes = !slot2Rep
      ? expiredReps.find((e) => e.branchId === branch.id && e.slot === 2)?.notes ?? null
      : null;

    return {
      id: branch.id,
      name: branch.name,
      branchNumber: branch.branchNumber,
      slot1: slot1Rep
        ? {
            id: slot1Rep.id,
            person: {
              id: slot1Rep.person.id,
              fullName: slot1Rep.person.fullName,
              photoUrl: slot1Rep.person.photoUrl,
              occupation: slot1Rep.person.occupation,
              branch: slot1Rep.person.branch,
            },
            notes: slot1Rep.notes,
          }
        : slot1Notes
          ? { id: `empty-${branch.id}-1`, person: null, notes: slot1Notes }
          : null,
      slot2: slot2Rep
        ? {
            id: slot2Rep.id,
            person: {
              id: slot2Rep.person.id,
              fullName: slot2Rep.person.fullName,
              photoUrl: slot2Rep.person.photoUrl,
              occupation: slot2Rep.person.occupation,
              branch: slot2Rep.person.branch,
            },
            notes: slot2Rep.notes,
          }
        : slot2Notes
          ? { id: `empty-${branch.id}-2`, person: null, notes: slot2Notes }
          : null,
    };
  });

  const data: OrgChartData = structure
    ? {
        structure: { name: structure.name, description: structure.description },
        levels,
        branches: branchData,
      }
    : buildPengurusPlaceholderData(branches);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
          Kepengurusan
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
          Struktur Pengurus
        </h1>
      </div>

      <OrgChart data={data} />
      <OrgChartMobile data={data} />
    </div>
  );
}
