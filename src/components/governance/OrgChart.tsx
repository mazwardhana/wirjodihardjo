import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OrgChartData } from "./types";

function PersonCard({
  person,
  positionName,
}: {
  person: { id: string; fullName: string; photoUrl: string | null; branch: { name: string; branchNumber: number } | null };
  positionName: string;
}) {
  return (
    <Link
      href={`/profil/${person.id}`}
      className="flex min-h-11 items-center gap-3 rounded-lg border border-wood/20 bg-cream p-3 text-left transition-colors hover:border-gold/60 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      <Avatar name={person.fullName} photoUrl={person.photoUrl} size="sm" className="shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-forest">
          {person.fullName}
        </p>
        <p className="truncate text-xs text-muted">{positionName}</p>
        {person.branch && (
          <p className="truncate text-xs text-wood/70">
            Cabang {person.branch.branchNumber}: {person.branch.name}
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border border-dashed border-wood/20 bg-parchment/30 p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest/5 text-xs font-semibold text-forest/30">
        ?
      </span>
      <span className="text-xs italic text-muted/60">{label}</span>
    </div>
  );
}

function LevelRow({
  positions,
  level,
}: {
  positions: Array<OrgChartData["positions"][number]>;
  level: number;
}) {
  const nonBranchReps = positions.filter((p) => !p.isBranchRepresentative);
  if (nonBranchReps.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      {nonBranchReps.map((position) => (
        <div key={position.id} className="flex flex-wrap justify-center gap-3">
          {position.assignments.length > 0 ? (
            position.assignments.map((assignment) => (
              <PersonCard
                key={assignment.id}
                person={assignment.person}
                positionName={position.name}
              />
            ))
          ) : (
            <div className="flex min-h-11 items-center gap-3 rounded-lg border border-dashed border-wood/20 bg-parchment/30 p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest/5 text-xs font-semibold text-forest/30">
                ?
              </span>
              <span className="text-xs italic text-muted/60">(Kosong)</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function OrgChart({ data }: { data: OrgChartData }) {
  const levels = Array.from(data.positionsByLevel.entries()).sort(([a], [b]) => a - b);
  const hasNonBranchLevels = levels.some(([, positions]) =>
    positions.some((p) => !p.isBranchRepresentative),
  );

  if (!hasNonBranchLevels && data.branches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-6 py-14 text-center">
        <h2 className="font-display text-lg font-semibold text-forest">
          Struktur kepengurusan belum tersedia
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Data kepengurusan belum dimasukkan oleh admin keluarga.
        </p>
      </div>
    );
  }

  return (
    <div className="hidden md:flex flex-col items-center gap-0">
      {/* Tree connector: decorative line that bridges levels */}
      {levels.map(([level, positions], idx) => {
        const nonBranchPositions = positions.filter((p) => !p.isBranchRepresentative);
        if (nonBranchPositions.length === 0 && level !== levels[levels.length - 1]?.[0]) return null;

        return (
          <div key={level} className="flex flex-col items-center">
            <LevelRow positions={positions} level={level} />
            {idx < levels.length - 1 && (
              <div className="my-4 flex justify-center" aria-hidden="true">
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" aria-hidden="true">
                  <line x1="8" y1="0" x2="8" y2="24" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
                  <polygon points="8,22 5,16 11,16" fill="currentColor" fillOpacity="0.3" />
                </svg>
              </div>
            )}
          </div>
        );
      })}

      {/* Branch representatives section */}
      {data.branches.length > 0 && (
        <div className="mt-6 w-full max-w-4xl">
          <div className="motif-divider mb-6" aria-hidden="true" />
          <h3 className="mb-4 text-center font-display text-lg font-semibold text-forest">
            Perwakilan Cabang
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.branches.map((branch) => {
              const reps = data.branchRepresentativesByBranch.get(branch.id) ?? [];
              const slot1 = reps.find((r) => r.slot === 1);
              const slot2 = reps.find((r) => r.slot === 2);
              return (
                <div
                  key={branch.id}
                  className="rounded-lg border border-wood/20 bg-cream p-4"
                >
                  <h4 className="mb-3 font-display text-sm font-semibold text-forest">
                    Cabang {branch.branchNumber}: {branch.name}
                  </h4>
                  <div className="space-y-2">
                    {slot1 ? (
                      <PersonCard person={slot1.person} positionName={`Perwakilan ${branch.name}`} />
                    ) : (
                      <EmptySlot label="(Kosong)" />
                    )}
                    {slot2 ? (
                      <PersonCard person={slot2.person} positionName={`Perwakilan ${branch.name}`} />
                    ) : (
                      <EmptySlot label="(Kosong)" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}