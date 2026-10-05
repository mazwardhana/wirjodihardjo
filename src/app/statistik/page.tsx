import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getStatistics,
  asStatisticsDb,
  type BranchStat,
} from "@/lib/statistik";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";

// Angka statistik dibaca dari basis data saat halaman diminta, supaya yang
// tampil selalu sama dengan isi arsip hari ini.
export const dynamic = "force-dynamic";

function angka(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

/** Waktu lokal tengah malam, supaya selisih hari tidak terseset oleh jam. */
function tengahMalam(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function jarakHari(date: Date, now: Date): string {
  const selisih = Math.round((tengahMalam(date) - tengahMalam(now)) / 86_400_000);
  if (selisih === 0) return "hari ini";
  return new Intl.RelativeTimeFormat("id", { numeric: "auto" }).format(selisih, "day");
}

function IkonArsip() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5" />
      <path d="M9 7.5h6" />
    </svg>
  );
}

function IkonOrang() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M4 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16.2 5.4a3.2 3.2 0 0 1 0 6.1" />
      <path d="M17.6 14.7A5.5 5.5 0 0 1 21 20" />
    </svg>
  );
}

function IkonKalender() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

function IkonLembar() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </svg>
  );
}

function BarisKeluarga({
  branch,
  terbesar,
}: {
  branch: BranchStat;
  terbesar: number;
}) {
  // Batang 0% itu disengaja: keluarga tanpa anggota harus terbaca kosong,
  // bukan tersirat punya sedikit anggota.
  const lebar =
    branch.total === 0 || terbesar === 0
      ? 0
      : Math.max(3, Math.round((branch.total / terbesar) * 100));

  return (
    <tr className="border-b border-wood/15 align-top">
      {/* Batang di sel terakhir disembunyikan dari pembaca layar karena
          angkanya sudah tertulis lengkap di dua sel sebelumnya. */}
      <th scope="row" className="break-words py-3 pr-3 font-normal">
        <span className="block text-sm font-medium text-balance text-forest">
          {branch.name}
        </span>
        <span className="mt-0.5 block text-xs text-muted">
          Cabang {branch.branchNumber}
          {branch.total === 0
            ? " · belum ada anggota tercatat"
            : ` · ${angka(branch.living)} hidup, ${angka(branch.deceased)} wafat`}
        </span>
      </th>
      <td className="py-3 px-3 text-right font-display text-lg font-semibold text-forest tabular-nums">
        {angka(branch.total)}
      </td>
      <td className="py-3 pl-3">
        <span aria-hidden="true" className="block h-2.5 w-full rounded-sm bg-parchment ring-1 ring-inset ring-wood/20">
          <span
            className="block h-full rounded-sm bg-wood/80"
            style={{ width: `${lebar}%` }}
          />
        </span>
      </td>
    </tr>
  );
}

export default async function StatistikPage() {
  const { family, branches, reunion, registration } = await getStatistics(asStatisticsDb(prisma));
  const now = new Date();

  const livingPercent = family.livingPercent;
  const deceasedPercent = Math.max(0, 100 - livingPercent);
  const belumTerisiJenisKelamin = Math.max(0, family.total - family.male - family.female);

  // Peringkat keluarga besar: yang paling banyak dulu, lalu nomor cabang.
  const peringkat = [...branches].sort(
    (a, b) => b.total - a.total || a.branchNumber - b.branchNumber,
  );
  const terbesar = peringkat.reduce((maks, b) => Math.max(maks, b.total), 0);
  const jumlahDitugaskan = peringkat.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="border-b border-wood/20 pb-8">
        <div className="flex items-start gap-3">
          <span className="mt-2 text-wood">
            <IkonArsip />
          </span>
          <h1 className="font-display text-4xl font-semibold text-balance text-forest sm:text-5xl">
            Statistik Keluarga
          </h1>
        </div>
        <p className="mt-4 max-w-2xl text-muted">
          Keadaan arsip keluarga besar Wirjodihardjo dalam angka, dibaca langsung
          dari data yang kami simpan. Tidak ada nama dan tidak ada akun di sini,
          hanya hitungan.
        </p>
        <div className="motif-divider mt-8" aria-hidden="true" />
      </header>

      {/* Angka utama. Hubungan hidup dan wafat disajikan sebagai satu batang
          proporsi, bukan empat kartu ikon dengan bentuk yang sama. */}
      <section aria-labelledby="judul-kondisi" className="mt-12">
        <h2
          id="judul-kondisi"
          className="flex items-center gap-2 font-display text-xl font-semibold text-forest"
        >
          <span className="text-wood">
            <IkonOrang />
          </span>
          Kondisi arsip
        </h2>

        {family.total === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Belum ada anggota tercatat"
              description="Angka di halaman ini muncul begitu admin Family mulai memasukkan anggota ke arsip. Sampai saat itu tidak ada data contoh yang ditampilkan."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <p className="text-sm text-muted">Anggota tercatat</p>
              <p className="mt-1 font-display text-6xl font-semibold text-forest tabular-nums sm:text-7xl">
                {angka(family.total)}
              </p>
              <span
                aria-hidden="true"
                className="mt-4 block h-1 w-16 rounded-full bg-gold"
              />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
                Hitungan ini mencakup anggota yang masih hidup dan yang sudah
                wafat, jadi silsilah yang bisa Anda telusuri di situs ini utuh.
              </p>
            </div>

            <div className="lg:col-span-7">
              <p className="font-display text-lg font-semibold text-forest">
                Masih hidup atau sudah wafat
              </p>
              <div
                role="img"
                aria-label={`Dari ${angka(family.total)} anggota tercatat, ${angka(family.living)} masih hidup (${livingPercent} persen) dan ${angka(family.deceased)} sudah wafat (${deceasedPercent} persen).`}
              >
                <div className="mt-4 flex h-4 w-full overflow-hidden rounded-sm ring-1 ring-inset ring-wood/15">
                  <div className="bg-forest" style={{ width: `${livingPercent}%` }} />
                  <div className="flex-1 bg-wood/35" />
                </div>
              </div>

              <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div className="border-t border-wood/15 pt-4">
                  <dt className="flex items-center gap-2 text-sm text-muted">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-sm bg-forest ring-1 ring-inset ring-wood"
                    />
                    Masih hidup
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-forest tabular-nums">
                    {angka(family.living)}
                    <span className="ml-2 text-base font-normal text-gold-deep tabular-nums">
                      {livingPercent}%
                    </span>
                  </dd>
                </div>
                <div className="border-t border-wood/15 pt-4">
                  <dt className="flex items-center gap-2 text-sm text-muted">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-sm bg-wood/35 ring-1 ring-inset ring-wood"
                    />
                    Sudah wafat
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-wood tabular-nums">
                    {angka(family.deceased)}
                    <span className="ml-2 text-base font-normal text-muted tabular-nums">
                      {deceasedPercent}%
                    </span>
                  </dd>
                </div>
              </dl>

              <p className="mt-6 text-sm leading-relaxed text-muted">
                Laki-laki {angka(family.male)} orang, perempuan{" "}
                {angka(family.female)} orang
                {belumTerisiJenisKelamin > 0 &&
                  `, serta ${angka(belumTerisiJenisKelamin)} orang yang belum diisi jenis kelaminnya`}
                .
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Sebaran per keluarga besar. Bentuknya tabel karena yang dicari pembaca
          adalah membandingkan jumlah, bukan sekadar ikon. */}
      <section aria-labelledby="judul-sebaran" className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2
            id="judul-sebaran"
            className="font-display text-2xl font-semibold text-forest"
          >
            Sebaran per keluarga besar
          </h2>
          <p className="text-sm text-muted">
            {angka(peringkat.length)} keluarga cabang
            {terbesar > 0 && (
              <>
                <span aria-hidden="true" className="px-2 text-wood/40">
                  /
                </span>
                keluarga terbesar: {angka(terbesar)} anggota
              </>
            )}
          </p>
        </div>

        {peringkat.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Belum ada keluarga cabang"
              description="Daftar keluarga cabang dibuat oleh admin Family. Setelah ada, jumlah anggota tiap keluarga akan tampil di sini beserta batangnya."
            />
          </div>
        ) : (
          <>
            <Reveal as="div" className="mt-6">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] border-collapse text-left">
                  <caption className="sr-only">
                    Jumlah anggota tiap keluarga cabang, diurutkan dari yang paling
                    banyak. Kolom porsi memuat batang yang lebarnya sebanding
                    dengan keluarga cabang terbesar.
                  </caption>
                  <thead>
                    <tr className="border-b border-wood/25">
                      <th
                        scope="col"
                        className="w-[45%] py-2 pr-3 text-sm font-semibold text-forest"
                      >
                        Keluarga besar
                      </th>
                      <th
                        scope="col"
                        className="w-20 py-2 px-3 text-right text-sm font-semibold text-forest"
                      >
                        Anggota
                      </th>
                      <th
                        scope="col"
                        className="w-24 py-2 pl-3 text-sm font-semibold text-forest sm:w-32"
                      >
                        Porsi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {peringkat.map((branch: BranchStat) => (
                      <BarisKeluarga
                        key={branch.id}
                        branch={branch}
                        terbesar={terbesar}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>

            <p className="mt-4 text-sm leading-relaxed text-muted">
              {angka(jumlahDitugaskan)} anggota sudah ditugaskan ke keluarga
              cabang.{" "}
              {family.unassigned > 0 ? (
                <span className="text-wood">
                  {angka(family.unassigned)} anggota lain belum ditugaskan ke
                  keluarga cabang mana pun
                </span>
              ) : (
                <span>Tidak ada anggota yang belum ditugaskan.</span>
              )}
            </p>
          </>
        )}
      </section>

      <div className="motif-divider mt-16" aria-hidden="true" />

      {/* Reuni. Jadwal masih dibicarakan, jadi tanggal yang kosong itu keadaan
          sah dan ditulis apa adanya, bukan tanda hubung. */}
      <Reveal as="div" className="mt-12">
        <section aria-labelledby="judul-reuni">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <h2
                id="judul-reuni"
                className="flex items-center gap-2 font-display text-2xl font-semibold text-forest"
              >
                <span className="text-wood">
                  <IkonKalender />
                </span>
                {reunion.title ?? "Reuni 2027"}
              </h2>

              <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <div className="border-t border-wood/15 pt-3">
                  <dt className="text-sm text-muted">Jadwal</dt>
                  <dd className="mt-1 text-forest">
                    {reunion.startAt ? (
                      formatDateTime(reunion.startAt)
                    ) : (
                      <span className="text-wood">Tanggal &amp; waktu menyusul</span>
                    )}
                  </dd>
                </div>
                <div className="border-t border-wood/15 pt-3">
                  <dt className="text-sm text-muted">Tempat</dt>
                  <dd className="mt-1 text-forest">
                    {reunion.locationName ?? "Belum ditentukan"}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-sm leading-relaxed text-muted">
                {reunion.registrationOpen ? (
                  <>
                    Pendaftaran peserta sedang dibuka. Buka halaman reuni untuk
                    membaca ketentuan lengkap dan mendaftarkan keluarga Anda.
                  </>
                ) : (
                  <>
                    Pendaftaran peserta belum dibuka. Nantikan pengumuman pengurus
                    di halaman reuni, halaman itu bisa dibaca tanpa login.
                  </>
                )}
              </p>

              {reunion.registrationOpen && (
                <Link
                  href={`/reuni/${reunion.slug}`}
                  className="mt-6 inline-flex min-h-11 items-center rounded-md bg-forest px-6 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
                >
                  Daftar ikut {reunion.title ?? "Reuni 2027"}
                </Link>
              )}
            </div>

            <aside
              aria-label="Rekapitulasi peserta reuni"
              className="lg:col-span-5"
            >
              <div className="rounded-lg border border-wood/20 bg-parchment/40 p-6">
                <p className="text-sm text-muted">Peserta tercatat</p>
                <p className="mt-1 font-display text-5xl font-semibold text-forest tabular-nums">
                  {angka(reunion.attendeeCount)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  orang terdaftar, termasuk yang masih di daftar tunggu
                </p>
                <dl className="mt-5 grid gap-3 border-t border-wood/15 pt-4 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Sudah pasti</dt>
                    <dd className="font-semibold text-forest tabular-nums">
                      {angka(reunion.confirmedPeople)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Daftar tunggu</dt>
                    <dd className="font-semibold text-forest tabular-nums">
                      {angka(reunion.waitlistPeople)}
                    </dd>
                  </div>
                  {reunion.cancelledPeople > 0 && (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-muted">Batal</dt>
                      <dd className="font-semibold text-wood tabular-nums">
                        {angka(reunion.cancelledPeople)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </aside>
          </div>
        </section>
      </Reveal>

      {/* Kontribusi form. Angkanya dijaga kecil: ini catatan kerja, bukan
          pameran. */}
      <section aria-labelledby="judul-form" className="mt-16">
        <div className="border-t border-wood/20 pt-8">
          <h2
            id="judul-form"
            className="flex items-center gap-2 font-display text-lg font-semibold text-forest"
          >
            <span className="text-wood">
              <IkonLembar />
            </span>
            Kontribusi form registrasi
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Berapa banyak baris data anggota yang masuk lewat formulir registrasi
            publik, dan berapa banyak akun yang sudah terbentuk darinya.
          </p>

          {/* Daftar nama sengaja tidak ditampilkan di sini: halaman statistik
              hanya memuat hitungan. Nama-namanya dibuka lewat tautan ini ke
              halaman daftar anggota tercatat. */}
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Ingin melihat <span className="font-medium text-forest">siapa saja</span> yang sudah
            tercatat beserta keluarga cabangnya? Buka{" "}
            <Link
              href="/registrasi/anggota"
              className="font-medium text-forest underline decoration-gold-deep decoration-2 underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              daftar anggota tercatat
            </Link>{" "}
            — bisa difilter per keluarga cabang dan dicari namanya.
          </p>

          {registration.batchCount === 0 ? (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
              Belum ada formulir yang dikirim. Bagian ini terisi sendiri begitu
              ada data anggota yang dikirim lewat form registrasi.
            </p>
          ) : (
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-3">
              <div className="border-t border-wood/15 pt-3">
                <dt className="text-sm text-muted">Baris terkirim</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-forest tabular-nums">
                  {angka(registration.rowsSubmitted)}
                </dd>
              </div>
              <div className="border-t border-wood/15 pt-3">
                <dt className="text-sm text-muted">Akun terbentuk</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-forest tabular-nums">
                  {angka(registration.accountsMade)}
                </dd>
              </div>
              <div className="border-t border-wood/15 pt-3">
                <dt className="text-sm text-muted">Pengiriman terakhir</dt>
                <dd className="mt-1 text-forest">
                  {registration.lastSubmittedAt ? (
                    <>
                      {formatDateTime(registration.lastSubmittedAt)}
                      <span className="mt-0.5 block text-sm text-muted">
                        {jarakHari(registration.lastSubmittedAt, now)}
                      </span>
                    </>
                  ) : (
                    "Belum ada"
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <p className="mt-14 max-w-2xl border-t border-wood/20 pt-6 text-sm leading-relaxed text-muted">
        Halaman ini hanya memuat hitungan agregat. Tidak ada nama, alamat email,
        kata sandi, atau data pribadi anggota yang ditampilkan. Kalau ada angka
        yang terasa tidak sesuai dengan keadaan sebenarnya, admin Family yang
        bisa memperbarui arsipnya.
      </p>
    </div>
  );
}
