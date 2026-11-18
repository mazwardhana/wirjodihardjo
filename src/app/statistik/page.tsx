import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStatistics, asStatisticsDb } from "@/lib/statistik";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import { angka, jarakHari } from "@/components/statistik/shared";
import { RingkasanKondisiArsip } from "@/components/statistik/ringkasan";
import { SebaranCabangPublik } from "@/components/statistik/sebaran";
import { RingkasanReuniPublik } from "@/components/statistik/reuni";

// Angka statistik dibaca dari basis data saat halaman diminta, supaya yang
// tampil selalu sama dengan isi arsip hari ini.
export const dynamic = "force-dynamic";

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


export default async function StatistikPage() {
  const { family, branches, reunion, registration } = await getStatistics(asStatisticsDb(prisma));
  const now = new Date();

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
          <RingkasanKondisiArsip family={family} />
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
            {angka(branches.length)} keluarga cabang
          </p>
        </div>

        <SebaranCabangPublik branches={branches} unassigned={family.unassigned} />
      </section>

      <div className="motif-divider mt-16" aria-hidden="true" />

      {/* Reuni. Jadwal masih dibicarakan, jadi tanggal yang kosong itu keadaan
          sah dan ditulis apa adanya, bukan tanda hubung. */}
      <Reveal as="div" className="mt-12">
        <section aria-labelledby="judul-reuni">
          <RingkasanReuniPublik reunion={reunion} />
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
