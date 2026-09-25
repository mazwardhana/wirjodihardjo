import Link from "next/link";
import {
  getFounders,
  getBranches,
  getGenerationBreakdown,
  getPersonCount,
} from "@/lib/data";
import { getGenerationLabel } from "@/lib/generations";
import { Scrollytelling } from "@/components/landing/Scrollytelling";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { EmptyState } from "@/components/ui/EmptyState";

// Statistik keluarga dibaca langsung dari basis data saat diminta.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [founders, branches, breakdown, total] = await Promise.all([
    getFounders(),
    getBranches(),
    getGenerationBreakdown(),
    getPersonCount(),
  ]);

  const deepest = breakdown.filter((b) => b.level !== null).map((b) => b.level!);
  const maxGen = deepest.length ? Math.max(...deepest) : 0;

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-wood/15">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-28">
          <div>
            <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
              Catatan trah &amp; silaturahmi keluarga
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-forest sm:text-6xl">
              Keluarga Besar
              <br />
              Wirjodihardjo
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Rumah digital untuk menelusuri silsilah dari pasangan pendiri
              hingga keturunan terkini, menyimpan kenangan bersama, dan
              menjaga hubungan lintas cabang serta generasi.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/silsilah"
                className="inline-flex h-12 items-center justify-center rounded-md bg-gold px-6 text-base font-semibold text-forest transition-colors hover:bg-gold-deep hover:text-cream"
              >
                Jelajahi Silsilah
              </Link>
              <Link
                href="/reuni"
                className="inline-flex h-12 items-center justify-center rounded-md border border-forest/35 px-6 text-base font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
              >
                Lihat Jadwal Reuni
              </Link>
            </div>
          </div>

          {/* Simulasi pohon keluarga (dekorasi, dibangun dari struktur data nyata) */}
          <div className="relative mx-auto hidden w-full max-w-sm lg:block">
            <TreeMotif branchCount={branches.length} />
          </div>
        </div>
      </section>

      {/* ── SCROLLYTELLING ── */}
      <Scrollytelling />

      {/* ── CITA-CITA / TUJUAN (bukan kartu seragam) ── */}
      <SectionReveal className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight text-forest sm:text-4xl">
              Empat hal yang kami rawat di sini
            </h2>
            <div className="motif-divider mt-5 max-w-[180px]" aria-hidden="true" />
          </div>
          <dl className="divide-y divide-wood/15">
            {[
              {
                t: "Silsilah yang hidup",
                d: "Pohon keluarga eksploratif dengan penamaan generasi adat Jawa, dari Anak hingga Trah tumerah.",
              },
              {
                t: "Data yang terjaga",
                d: "Setiap penambahan anggota melewati persetujuan admin cabang, sehingga pohon tetap akurat.",
              },
              {
                t: "Kenangan bersama",
                d: "Galeri foto dari acara dan arsip keluarga, tersimpan dalam satu tempat milik bersama.",
              },
              {
                t: "Ikatan yang terjaga",
                d: "Jadwal reuni dan apresiasi lewat Hall of Fame membuat keluarga tetap saling terhubung.",
              },
            ].map((item) => (
              <div key={item.t} className="grid gap-2 py-6 sm:grid-cols-[auto_1fr] sm:gap-6">
                <dt className="font-display text-lg font-semibold text-wood sm:text-right sm:min-w-[160px]">
                  {item.t}
                </dt>
                <dd className="text-muted leading-relaxed">{item.d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </SectionReveal>

      {/* ── STRUKTUR KELUARGA (angka dari data nyata) ── */}
      <SectionReveal className="border-y border-wood/15 bg-parchment/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold text-forest sm:text-4xl">
            Struktur keluarga
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Angka berikut dihitung langsung dari data yang sudah terverifikasi
            di dalam sistem.
          </p>

          {total <= 2 ? (
            <EmptyState
              title="Belum ada keturunan tercatat"
              description="Silsilah masih menunggu pengisian awal oleh admin cabang."
            />
          ) : (
            <>
              <div className="mt-10 flex flex-wrap items-end gap-x-10 gap-y-6">
                <Stat value={total} label="Anggota tercatat" />
                <Stat value={branches.length} label="Cabang keturunan" />
                <Stat
                  value={maxGen}
                  label={`Generasi terjauh (${getGenerationLabel(maxGen)})`}
                />
              </div>

              {/* Sebaran per generasi */}
              <div className="mt-12">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Sebaran anggota per generasi
                </h3>
                <ul className="mt-4 space-y-2">
                  {breakdown.map((row) => (
                    <GenerationRow
                      key={row.level ?? "unknown"}
                      level={row.level}
                      count={row.count}
                      max={total}
                    />
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </SectionReveal>

      {/* ── CABANG ── */}
      {branches.length > 0 && (
        <SectionReveal className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold text-forest sm:text-4xl">
            Cabang keturunan
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Setiap cabang berakar pada salah satu anak pasangan pendiri.
          </p>

          {/* Kartu dengan hierarki bervariasi (bukan grid seragam) */}
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b, i) => (
              <li
                key={b.id}
                className={
                  i === 0
                    ? "sm:col-span-2 lg:col-span-1"
                    : "border-wood/15 lg:border-l lg:pl-4"
                }
              >
                <div className="group h-full rounded-lg border border-wood/20 bg-cream p-5 transition-colors hover:border-gold/60">
                  <span className="font-display text-2xl font-semibold text-gold-deep">
                    {String(b.orderIndex + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-1 font-display text-lg font-semibold text-forest">
                    {b.name}
                  </h3>
                  {b.rootPerson && (
                    <p className="mt-1 text-sm text-muted">
                      Berakar dari {b.rootPerson.fullName}
                    </p>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {b._count.members} anggota tercatat
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SectionReveal>
      )}

      {/* ── AJAKAN ── */}
      <section className="border-t border-wood/15 bg-forest">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-semibold text-cream">
              Anggota keluarga Wirjodihardjo?
            </h2>
            <p className="mt-2 max-w-xl text-cream/80">
              Masuk untuk melihat kontak antar anggota, melengkapi profil, dan
              mengajukan penambahan keturunan baru.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-md bg-gold px-7 text-base font-semibold text-forest transition-colors hover:bg-cream"
          >
            Masuk ke Dashboard
          </Link>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-5xl font-semibold leading-none text-forest">
        {value.toLocaleString("id-ID")}
      </div>
      <div className="mt-2 text-sm font-medium text-muted">{label}</div>
    </div>
  );
}

function GenerationRow({
  level,
  count,
  max,
}: {
  level: number | null;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <li className="grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-3">
      <span className="truncate text-sm font-medium text-forest">
        {getGenerationLabel(level)}
      </span>
      <span
        className="h-2.5 overflow-hidden rounded-full bg-wood/15"
        role="img"
        aria-label={`${count} anggota, ${pct} persen`}
      >
        <span
          className="block h-full rounded-full bg-forest-soft"
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </span>
      <span className="w-10 text-right text-sm tabular-nums text-muted">
        {count}
      </span>
    </li>
  );
}

function TreeMotif({ branchCount }: { branchCount: number }) {
  const kids = Math.min(Math.max(branchCount, 3), 10);
  const spread = 240;
  const childX = (i: number) =>
    kids === 1 ? 0 : (i / (kids - 1) - 0.5) * spread;

  return (
    <svg
      viewBox="0 0 320 300"
      className="w-full"
      role="img"
      aria-label="Ilustrasi pohon keluarga dengan dua pendiri dan cabang keturunannya"
    >
      <g stroke="#8a6238" strokeOpacity="0.5" strokeWidth="1.5" fill="none">
        {Array.from({ length: kids }).map((_, i) => (
          <path key={i} d={`M160 78 C160 130 ${160 + childX(i)} 130 ${160 + childX(i)} 168`} />
        ))}
      </g>
      {Array.from({ length: kids }).map((_, i) => (
        <g key={i}>
          <circle cx={160 + childX(i)} cy={180} r={13} fill="#efe3c8" stroke="#6f4a2b" strokeWidth="1.5" />
          <circle cx={160 + childX(i)} cy={180} r={4} fill="#2c4f3b" />
        </g>
      ))}
      <circle cx={143} cy={66} r={19} fill="#1f3a2b" />
      <circle cx={177} cy={66} r={19} fill="#b4872a" />
      <circle cx={160} cy={232} r={9} fill="none" stroke="#b4872a" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}