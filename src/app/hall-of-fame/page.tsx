import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { auth } from "@/lib/auth";

// Entri dibaca langsung dari basis data saat diminta.
export const dynamic = "force-dynamic";

export default async function HallOfFamePage() {
  const session = await auth();
  const entries = await prisma.hallOfFameEntry.findMany({
    where: { isPublished: true },
    include: {
      person: { select: { id: true, fullName: true, photoUrl: true, gender: true } },
    },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
        Apresiasi
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
        Hall of Fame
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Prestasi dan kontribusi anggota keluarga. Setiap entri berasal dari data
        nyata, dikelola oleh admin keluarga.
      </p>

      {entries.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada entri Hall of Fame"
            description="Admin keluarga dapat menambahkan entri pertama melalui panel admin."
          />
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group rounded-lg border border-wood/20 bg-cream p-5 transition-colors hover:border-gold/60"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  name={entry.person.fullName}
                  photoUrl={entry.person.photoUrl}
                  size="md"
                />
                <div>
                  <Link
                    href={`/profil/${entry.person.id}`}
                    className="font-semibold text-forest hover:text-gold-deep"
                  >
                    {entry.person.fullName}
                  </Link>
                  <p className="text-xs font-medium text-wood">{entry.category}</p>
                </div>
              </div>
              <h3 className="mt-3 font-display text-base font-semibold text-forest">
                {entry.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {entry.description}
              </p>
              {entry.year && (
                <p className="mt-2 text-xs text-muted">{entry.year}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}