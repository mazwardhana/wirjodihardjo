import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";

export type OrgPerson = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  occupation: string | null;
  branch: { name: string; branchNumber: number } | null;
};

export type OrgSlot = {
  id: string;
  person: OrgPerson | null;
  notes: string | null;
};

export type OrgBranch = {
  id: string;
  name: string;
  branchNumber: number;
  slot1: OrgSlot | null;
  slot2: OrgSlot | null;
};

export type OrgLevel = {
  level: number;
  positions: Array<{
    id: string;
    name: string;
    description: string | null;
    assignments: Array<{
      id: string;
      person: OrgPerson;
    }>;
  }>;
};

export type OrgChartData = {
  structure: { name: string; description: string | null } | null;
  levels: OrgLevel[];
  branches: OrgBranch[];
};

function PersonCard({
  person,
  positionName,
}: {
  person: OrgPerson;
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
        <p className="truncate text-xs text-muted">{person.occupation ?? positionName}</p>
        {person.branch && (
          <p className="truncate text-xs text-wood/70">
            Keluarga Cabang {person.branch.branchNumber}: {person.branch.name}
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptySlot({ notes }: { notes?: string | null }) {
  return (
    <div className="flex min-h-11 items-start gap-3 rounded-lg border border-dashed border-wood/20 bg-parchment/30 p-3">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest/5 text-xs font-semibold text-forest/30"
      >
        ?
      </span>
      <div className="min-w-0">
        <span className="block text-xs italic text-muted/60">(Kosong)</span>
        {notes && <span className="mt-1 block text-xs leading-relaxed text-wood/70">{notes}</span>}
      </div>
    </div>
  );
}

export function OrgChart({ data }: { data: OrgChartData }) {
  if (!data.structure) {
    return (
      <div className="hidden rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-6 py-14 text-center md:block">
        <h2 className="font-display text-lg font-semibold text-forest">
          Struktur kepengurusan belum tersedia
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Data kepengurusan belum dimasukkan oleh admin keluarga.
        </p>
      </div>
    );
  }

  const repSection = data.branches.length > 0;

  return (
    <div className="hidden md:flex md:flex-col md:items-center md:gap-0">
      <h2 className="font-display text-xl font-semibold text-forest">
        {data.structure.name}
      </h2>
      {data.structure.description && (
        <p className="mt-1 text-sm text-muted">{data.structure.description}</p>
      )}

      <div className="mt-8 flex flex-col items-center" role="list" aria-label="Level kepengurusan">
        {data.levels.map((level, idx) => (
          <div key={level.level} className="flex flex-col items-center" role="listitem">
            {/* Position row */}
            <div className="flex flex-wrap justify-center gap-4">
              {level.positions.map((position) => (
                <div key={position.id} className="flex flex-col items-center">
                  <h3 className="mb-2 text-center font-display text-sm font-semibold uppercase tracking-wide text-forest/80">
                    {position.name}
                  </h3>
                  {position.assignments.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {position.assignments.map((a) => (
                        <PersonCard key={a.id} person={a.person} positionName={position.name} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-11 items-center gap-3 rounded-lg border border-dashed border-wood/20 bg-parchment/30 p-3">
                      <span className="text-xs italic text-muted/60">(Kosong)</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Connector to next level */}
            {idx < data.levels.length - 1 && (
              <div className="my-4 flex justify-center" aria-hidden="true">
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" aria-hidden="true">
                  <line x1="8" y1="0" x2="8" y2="24" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
                  <polygon points="8,22 5,16 11,16" fill="currentColor" fillOpacity="0.25" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {repSection && (
        <div className="mt-10 w-full max-w-5xl">
          <div className="motif-divider mb-6" aria-hidden="true" />
          <h3 className="mb-6 text-center font-display text-lg font-semibold text-forest">
            Perwakilan Keluarga Cabang
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.branches.map((branch) => (
              <div key={branch.id} className="rounded-lg border border-wood/20 bg-cream p-4">
                <h4 className="mb-3 font-display text-sm font-semibold text-forest">
                  Keluarga Cabang {branch.branchNumber}: {branch.name}
                </h4>
                <div className="space-y-2">
                  {branch.slot1 && branch.slot1.person ? (
                    <PersonCard person={branch.slot1.person} positionName={`Perwakilan ${branch.name}`} />
                  ) : (
                    <EmptySlot notes={branch.slot1?.notes} />
                  )}
                  {branch.slot2 && branch.slot2.person ? (
                    <PersonCard person={branch.slot2.person} positionName={`Perwakilan ${branch.name}`} />
                  ) : (
                    <EmptySlot notes={branch.slot2?.notes} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}