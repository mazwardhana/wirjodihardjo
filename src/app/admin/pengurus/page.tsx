import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PengurusAdmin } from "./PengurusAdmin";

export const dynamic = "force-dynamic";

export default async function AdminPengurusPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const now = new Date();
  const [structures, branches, representatives] = await Promise.all([
    prisma.governanceStructure.findMany({
      orderBy: { startDate: "desc" },
      include: {
        positions: {
          orderBy: [{ level: "asc" }, { name: "asc" }],
          include: {
            assignments: {
              where: {
                AND: [
                  { person: { deletedAt: null } },
                  { OR: [{ endDate: null }, { endDate: { gte: now } }] },
                ],
              },
              orderBy: { startDate: "desc" },
              include: {
                person: {
                  select: {
                    id: true,
                    fullName: true,
                    branch: { select: { name: true, branchNumber: true } },
                  },
                },
                branch: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { branchNumber: "asc" },
      select: { id: true, name: true, branchNumber: true },
    }),
    prisma.branchRepresentative.findMany({
      where: {
        AND: [
          { person: { deletedAt: null } },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: { slot: "asc" },
      include: {
        person: {
          select: {
            id: true,
            fullName: true,
            branch: { select: { name: true, branchNumber: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-forest">
          Kepengurusan
        </h1>
        <p className="mt-1 text-sm text-muted">
          Susun jabatan dan tetapkan pengurus yang tampil di halaman publik
          Pengurus.
        </p>
      </div>

      <PengurusAdmin
        structures={structures.map((structure) => ({
          id: structure.id,
          name: structure.name,
          description: structure.description,
          isActive: structure.isActive,
          startDate: structure.startDate.toISOString(),
          endDate: structure.endDate?.toISOString() ?? null,
          positions: structure.positions.map((position) => ({
            id: position.id,
            name: position.name,
            description: position.description,
            level: position.level,
            capacity: position.capacity,
            assignments: position.assignments.map((assignment) => ({
              id: assignment.id,
              startDate: assignment.startDate.toISOString(),
              endDate: assignment.endDate?.toISOString() ?? null,
              notes: assignment.notes,
              person: {
                id: assignment.person.id,
                fullName: assignment.person.fullName,
                branchName: assignment.person.branch?.name ?? null,
                branchNumber: assignment.person.branch?.branchNumber ?? null,
              },
            })),
          })),
        }))}
        branches={branches}
        representatives={representatives.map((rep) => ({
          id: rep.id,
          branchId: rep.branchId,
          slot: rep.slot,
          person: {
            id: rep.person.id,
            fullName: rep.person.fullName,
            branchName: rep.person.branch?.name ?? null,
            branchNumber: rep.person.branch?.branchNumber ?? null,
          },
        }))}
      />
    </div>
  );
}
