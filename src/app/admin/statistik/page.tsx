import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatDateTimeOrDate } from "@/lib/utils";
import { DEFAULT_REGISTRATION_PASSWORD } from "@/lib/registrasi";
import { getStatistics, getRegistrationCredentials } from "@/lib/statistik";
import { asStatisticsDb, type StatisticsDb, type CredentialDb } from "@/lib/statistik";
import { EmptyState } from "@/components/ui/States";
import { angka } from "@/components/statistik/shared";
import { RingkasanAngka } from "@/components/statistik/ringkasan";
import { SebaranCabangAdmin } from "@/components/statistik/sebaran";
import { RingkasanReuniAdmin } from "@/components/statistik/reuni";
import { FilterBar } from "@/components/admin/FilterBar";

export const dynamic = "force-dynamic";

/**
 * Batas baris laporan kredensial. Daftar ini dipakai admin untuk membagikan
 * akun di luar sistem (belum ada layanan surel), jadi 200 baris terbaru sudah
 * lebih dari cukup untuk satu gelombang pembagian.
 */
const CREDENTIAL_LIMIT = 200;

const db = asStatisticsDb<StatisticsDb & CredentialDb>(prisma);

/**
 * Satu sel angka untuk daftar ringkasan. Baris pemisah memakai border asli,
 * bukan celah 1px dengan latar bleeding, supaya angka tetap terbaca saat
 * density admin dinaikkan. */
function Angka({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-t border-wood/15 pt-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-forest tabular-nums">
        {value}
        {hint ? (
          <span className="ml-2 text-sm font-normal text-muted">{hint}</span>
        ) : null}
      </dd>
    </div>
  );
}

export default async function AdminStatistikPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // SUPER_ADMIN saja. Berbeda dari daftar admin lain yang menerima
  // BRANCH_ADMIN: isi halaman ini adalah daftar akun keluarga besar beserta
  // password awal, bukan data satu cabang.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const [sp, statistics, credentials] = await Promise.all([
    searchParams,
    getStatistics(db),
    getRegistrationCredentials(db, { take: CREDENTIAL_LIMIT }),
  ]);
  const { family, branches, reunion, registration } = statistics;

  const q = sp.q?.trim() ?? "";
  const needle = q.toLowerCase();
  const rows = needle
    ? credentials.filter(
        (row) =>
          row.username.toLowerCase().includes(needle) ||
          row.fullName.toLowerCase().includes(needle) ||
          (row.branchName ?? "").toLowerCase().includes(needle),
      )
    : credentials;
  const terpotong = credentials.length >= CREDENTIAL_LIMIT;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b border-wood/20 pb-6">
        <h1 className="font-display text-2xl font-semibold text-forest sm:text-3xl">
          Statistik Keluarga
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Angka yang sama dengan halaman statistik publik, ditambah laporan
          kredensial hasil registrasi. Laporan kredensial hanya untuk pengurus
          inti dan tidak boleh dibagikan apa adanya.
        </p>
      </header>

      <section aria-labelledby="judul-ringkasan" className="mt-10">
        <h2
          id="judul-ringkasan"
          className="font-display text-xl font-semibold text-forest"
        >
          Ringkasan
        </h2>

        <div className="mt-4 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-sm text-muted">Anggota tercatat</p>
            <p className="mt-1 font-display text-5xl font-semibold text-forest tabular-nums">
              {angka(family.total)}
            </p>
            <span aria-hidden="true" className="mt-3 block h-1 w-16 bg-gold" />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {angka(family.living)} masih hidup ({family.livingPercent}%),{" "}
              {angka(family.deceased)} sudah wafat.
            </p>
          </div>

          <RingkasanAngka family={family} />
        </div>

        <div className="mt-8 border-t border-wood/15 pt-6">
          <h3 className="font-display text-base font-semibold text-forest">
            Hasil form registrasi
          </h3>
          <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Angka
              label="Batch terkirim"
              value={angka(registration.batchCount)}
            />
            <Angka
              label="Baris data dikirim"
              value={angka(registration.rowsSubmitted)}
            />
            <Angka
              label="Akun dibuat"
              value={angka(registration.accountsMade)}
            />
            <Angka
              label="Anggota menyatakan hadir"
              value={angka(registration.attendeesFromForm)}
            />
          </dl>
          <p className="mt-4 text-sm text-muted">
            Pengiriman terakhir:{" "}
            {registration.lastSubmittedAt
              ? formatDateTime(registration.lastSubmittedAt)
              : "belum ada batch yang masuk"}
          </p>
        </div>
      </section>

      <section aria-labelledby="judul-cabang" className="mt-12">
        <h2
          id="judul-cabang"
          className="font-display text-xl font-semibold text-forest"
        >
          Sebaran per keluarga besar
        </h2>
        <p className="mt-1 text-sm text-muted">
          Anggota yang belum ditugaskan ke keluarga besar mana pun tidak
          terhitung di tabel ini, hanya di Ringkasan.
        </p>

        <SebaranCabangAdmin branches={branches} />
      </section>

      <section aria-labelledby="judul-reuni" className="mt-12">
        <h2
          id="judul-reuni"
          className="font-display text-xl font-semibold text-forest"
        >
          Reuni 2027
        </h2>

        <RingkasanReuniAdmin reunion={reunion} />
      </section>

      <section aria-labelledby="judul-kredensial" className="mt-12">
        <h2
          id="judul-kredensial"
          className="font-display text-xl font-semibold text-forest"
        >
          Laporan kredensial hasil registrasi
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Daftar akun yang dibuat dari form registrasi publik. Belum ada layanan
          surel di situs ini, jadi kredensial dibagikan manual: salin nama
          pengguna dan password awal kepada pemilik akun lewat kanal keluarga
          yang sudah disepakati.
        </p>

        <div className="mt-5 rounded-lg border border-wood/30 bg-parchment/50 p-5">
          <h3 className="font-display text-base font-semibold text-forest">
            Password awal bersama
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Semua akun hasil registrasi memakai password awal yang sama:{" "}
            <code className="rounded-sm bg-cream px-1.5 py-0.5 font-mono text-sm font-semibold text-forest">
              {DEFAULT_REGISTRATION_PASSWORD}
            </code>
            . Ini password awal bersama, wajib diganti saat login pertama.
            Setiap akun dibuat dengan penanda{" "}
            <span className="font-medium text-forest">
              wajib mengganti kredensial
            </span>
            , jadi anggota akan diminta membuat username dan password sendiri
            sebelum masuk ke halaman anggota. Minta anggota mengganti password
            segera setelah login pertama, jangan menyimpan daftar ini di
            perangkat bersama.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Isi halaman ini hanya Username, nama lengkap, dan nama keluarga
            besar. Surel dan alamat IP pengirim tidak pernah ditampilkan, dan
            halaman ini hanya terbuka untuk pengurus inti.
          </p>
        </div>

        <p className="mt-5 text-sm text-muted">
          Hanya akun yang belum mengganti kredensial awal yang tampil. Baris
          hilang dari daftar begitu anggotanya mengganti password sendiri.
        </p>

        <div className="mt-4">
          <FilterBar
            config={{
              search: {
                placeholder: "Cari nama pengguna, nama lengkap, atau keluarga besar...",
                param: "q",
              },
            }}
          />
        </div>

        {/*
          Baris hitungan disembunyikan saat daftarnya kosong: keadaan kosong di
          bawah sudah menjelaskan sendiri, jadi angka "0 akun" hanya menambah
          bacaan sia-sia.
        */}
        {credentials.length > 0 ? (
          <p className="mt-4 text-sm text-muted">
            {needle
              ? `${angka(rows.length)} dari ${angka(credentials.length)} akun cocok dengan "${q}".`
              : `${angka(credentials.length)} akun menunggu password diganti.`}
          </p>
        ) : null}

        {credentials.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Belum ada akun hasil registrasi"
              description="Laporan ini terisi begitu form registrasi publik mengirim data dan sistem membuat satu akun untuk setiap baris yang lolos validasi."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Tidak ada akun yang cocok"
              description={`Tidak ada akun dalam ${angka(CREDENTIAL_LIMIT)} akun terbaru yang cocok dengan "${q}". Kosongkan pencarian untuk melihat daftar lengkap.`}
              action={
                <Link
                  href="/admin/statistik"
                  className="inline-flex min-h-11 items-center rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  Kosongkan pencarian
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-wood/15">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <caption className="sr-only">
                  Daftar akun hasil registrasi yang belum mengganti kredensial
                  awal: nama lengkap, nama pengguna, keluarga besar, status
                  verifikasi, dan tanggal akun dibuat.
                </caption>
                <thead>
                  <tr className="border-b border-wood/15 bg-parchment/40 text-xs font-medium uppercase tracking-wide text-muted">
                    <th scope="col" className="px-4 py-3">
                      Nama lengkap
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Nama pengguna
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Keluarga besar
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Verifikasi
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Dibuat
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-wood/15">
                      <th
                        scope="row"
                        className="px-4 py-3 text-left font-semibold text-forest"
                      >
                        <span className="block break-words">{row.fullName}</span>
                      </th>
                      <td className="px-4 py-3">
                        <code className="block break-all font-mono text-sm text-forest">
                          {row.username}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {row.branchName ?? "Belum ditugaskan"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            row.isVerified
                              ? "bg-forest/10 text-ink"
                              : "bg-gold/20 text-gold-deep"
                          }`}
                        >
                          {row.isVerified ? "Terverifikasi" : "Belum verifikasi"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted">
                        {formatDateTime(row.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {terpotong ? (
              <p className="mt-3 text-sm text-muted">
                Tabel menampilkan {angka(CREDENTIAL_LIMIT)} akun terbaru. Sisanya
                bisa dicari di{" "}
                <Link
                  href="/admin/pengguna"
                  className="font-medium text-gold-deep underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  menu Pengguna
                </Link>
                .
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}