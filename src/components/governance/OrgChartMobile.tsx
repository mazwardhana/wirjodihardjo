import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import type { OrgChartData, OrgPerson } from "./OrgChart";

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

export function OrgChartMobile({ data }: { data: OrgChartData }) {
  if (!data.structure) {
    return (
      <div className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-6 py-14 text-center md:hidden">
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
    <div className="md:hidden">
      <h2 className="font-display text-xl font-semibold text-forest">
        {data.structure.name}
      </h2>
      {data.structure.description && (
        <p className="mt-1 text-sm text-muted">{data.structure.description}</p>
      )}

      <div className="mt-6 space-y-3">
        {data.levels.map((level) => (
          <details key={level.level} className="group rounded-lg border border-wood/20">
            <summary className="flex cursor-pointer items-center justify-between gap-2 bg-parchment/40 px-4 py-3 font-display text-sm font-semibold text-forest transition-colors hover:bg-parchment/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
              <span>
                {level.positions.map((p) => p.name).join(", ")}
                <span className="ml-2 text-xs font-normal text-muted">
                  ({level.positions.reduce((sum, p) => sum + p.assignments.length, 0)} orang)
                </span>
              </span>
              <svg
                className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="space-y-4 p-4">
              {level.positions.map((position) => (
                <div key={position.id}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-forest/70">
                    {position.name}
                  </h3>
                  {position.assignments.length > 0 ? (
                    <div className="space-y-2">
                      {position.assignments.map((a) => (
                        <PersonCard key={a.id} person={a.person} positionName={position.name} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted/60">(Kosong)</p>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}

        {repSection && (
          <details className="group rounded-lg border border-wood/20">
            <summary className="flex cursor-pointer items-center justify-between gap-2 bg-parchment/40 px-4 py-3 font-display text-sm font-semibold text-forest transition-colors hover:bg-parchment/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
              <span>
                Perwakilan Keluarga Cabang
                <span className="ml-2 text-xs font-normal text-muted">
                  ({data.branches.filter((b) => b.slot1 || b.slot2).length}/{data.branches.length} keluarga cabang)
                </span>
              </span>
              <svg
                className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="space-y-4 p-4">
              {data.branches.map((branch) => (
                <details key={branch.id} className="group/branch">
                  <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-wood/10 bg-cream px-3 py-2 text-sm font-semibold text-forest transition-colors hover:bg-parchment/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    <span>
                      Keluarga Cabang {branch.branchNumber}: {branch.name}
                      <span className="ml-2 text-xs font-normal text-muted">
                        ({[branch.slot1, branch.slot2].filter(Boolean).length}/2)
                      </span>
                    </span>
                    <svg
                      className="h-4 w-4 shrink-0 transition-transform group-open/branch:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="mt-2 space-y-2 pl-2">
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
                </details>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}