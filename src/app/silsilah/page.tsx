import Link from "next/link";
import { getGenerationLabel } from "@/lib/generations";
import { searchPersons, getFamilyTree, getBranches, getGenerationBreakdown } from "@/lib/data";
import { auth } from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FamilyTreeCanvas } from "@/components/silsilah/FamilyTreeCanvas";
import { FilterPanel } from "@/components/silsilah/FilterPanel";

// Data silsilah dibaca langsung dari basis data saat diminta.
export const dynamic = "force-dynamic";

export default async function SilsilahPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branchId?: string; generation?: string; deceased?: string }>;
}) {
  const { q, branchId, generation, deceased } = await searchParams;
  const session = await auth();

  // Tombol Reset di samping kotak cari hanya menghapus kata kunci, sementara
  // filter keluarga cabang/generasi/status tetap dipertahankan (kebalikan dari
  // "Reset filter" di FilterPanel). Dengan begitu kedua kontrol tidak saling
  // menghapus tanpa disadari.
  function clearSearchHref(): string {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (generation) params.set("generation", generation);
    if (deceased !== undefined) params.set("deceased", deceased);
    return `/silsilah${params.toString() ? `?${params.toString()}` : ""}`;
  }

  // Parse filter: `q` hanya memengaruhi daftar hasil pencarian, bukan pohon.
  // Pohon selalu dirender, disaring hanya oleh keluarga cabang, generasi, dan status.
  const filters = {
    branchId: branchId || undefined,
    generationLevel: generation ? parseInt(generation) : undefined,
    isDeceased: deceased !== undefined ? deceased === "true" : undefined,
  };

  const [results, treeData, branches, genBreakdown] = await Promise.all([
    q ? searchPersons(q) : null,
    getFamilyTree(filters),
    getBranches(),
    getGenerationBreakdown(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
            Jelajahi
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
            Silsilah Keluarga
          </h1>
          <p className="mt-2 max-w-xl text-muted">
            Cari anggota keluarga dan jelajahi pohon silsilah interaktif.
            Klik simpul untuk detail, klik ganda untuk melipat keluarga cabang.
            Data kontak hanya untuk anggota yang login.
          </p>
        </div>

        {/* Filter — client component */}
        <FilterPanel
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          generations={genBreakdown.filter((g): g is { level: number; count: number } => g.level !== null)}
          current={{ branchId, generationLevel: generation ? parseInt(generation) : undefined, isDeceased: deceased }}
        />
      </div>

      {/* Pencarian */}
      <form
        action="/silsilah"
        method="GET"
        role="search"
        aria-label="Cari anggota keluarga"
        className="mt-6"
      >
        <div className="flex max-w-lg gap-3">
          <label htmlFor="q" className="sr-only">
            Nama anggota
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Cari nama atau nama panggilan…"
            className="block min-h-11 w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-md bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Cari
          </button>
          {q && (
            <Link
              href={clearSearchHref()}
              className="min-h-11 shrink-0 rounded-md border border-wood/30 px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Reset
            </Link>
          )}
        </div>

        {/* Filter aktif harus ikut terkirim, supaya pencarian tidak diam-diam
            menghapus filter keluarga cabang/generasi/status yang sudah dipilih. */}
        {branchId && <input type="hidden" name="branchId" value={branchId} />}
        {generation && <input type="hidden" name="generation" value={generation} />}
        {deceased !== undefined && (
          <input type="hidden" name="deceased" value={deceased} />
        )}
      </form>

      {/* Hasil pencarian */}
      {results !== null && (
        <section aria-label="Hasil pencarian" className="mt-8">
          {results.length === 0 ? (
            <div role="status">
              <EmptyState
                title="Anggota tidak ditemukan"
                description={`Tidak ada anggota dengan nama "${q}". Coba ejaan lain atau lihat seluruh pohon.`}
                action={
                  <Link
                    href={clearSearchHref()}
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    Tampilkan seluruh pohon
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <p role="status" className="mb-4 text-sm text-muted">
                {results.length} hasil untuk &ldquo;{q}&rdquo;
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((person) => (
                  <li key={person.id}>
                    <Link
                      href={`/profil/${person.id}`}
                      className="group flex items-center gap-3 rounded-lg border border-wood/15 bg-cream p-3 transition-colors hover:border-gold/50"
                    >
                      <Avatar
                        name={person.fullName}
                        photoUrl={person.photoUrl}
                        size="md"
                      />
                      <div>
                        <p className="font-semibold text-forest transition-colors group-hover:text-gold-deep">
                          {person.fullName}
                        </p>
                        {person.nickname && (
                          <p className="text-xs text-muted">
                            {person.nickname}
                          </p>
                        )}
                        <p className="text-xs text-wood">
                          {getGenerationLabel(person.generationLevel)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Kanvas Silsilah */}
      <section
        aria-label="Pohon keluarga interaktif"
        className="tree-canvas mt-6 h-[70vh] rounded-lg border border-wood/20"
      >
        <FamilyTreeCanvas
          data={treeData}
          isAuthenticated={!!session?.user}
        />
      </section>
    </div>
  );
}