import { angka } from "./shared";
import { formatDateTimeOrDate } from "@/lib/utils";
import type { ReunionStats } from "@/lib/statistik";
import { EmptyState } from "@/components/ui/States";

/**
 * Blok rekap reuni. Halaman publik menampilkan kartu peserta + CTA
 * pendaftaran; halaman admin menampilkan grid angka. Angkanya satu sumber.
 */

/** Kartu reuni + rekap peserta — versi halaman publik. */
export function RingkasanReuniPublik({ reunion }: { reunion: ReunionStats }) {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-7">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-forest">
          {reunion.title ?? "Reuni 2027"}
        </h2>

        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div className="border-t border-wood/15 pt-3">
            <dt className="text-sm text-muted">Jadwal</dt>
            <dd className="mt-1 text-forest">
              {reunion.startAt ? (
                formatDateTimeOrDate(reunion.startAt)
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
          <a
            href={`/reuni/${reunion.slug}`}
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-forest px-6 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
          >
            Daftar ikut {reunion.title ?? "Reuni 2027"}
          </a>
        )}
      </div>

      <aside aria-label="Rekapitulasi peserta reuni" className="lg:col-span-5">
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
  );
}

function AngkaItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

/** Grid angka reuni — versi halaman admin. */
export function RingkasanReuniAdmin({ reunion }: { reunion: ReunionStats }) {
  if (!reunion.title) {
    return (
      <div className="mt-4">
        <EmptyState
          title="Belum ada acara reuni"
          description="Buat acara reuni di menu Reuni agar jumlah peserta bisa dihitung di sini."
        />
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-6 rounded-lg border border-wood/15 bg-parchment/30 p-5 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <p className="font-display text-lg font-semibold text-forest">
          {reunion.title}
        </p>
        <p className="mt-1 text-sm text-muted">
          {reunion.startAt
            ? formatDateTimeOrDate(reunion.startAt)
            : "Tanggal & waktu menyusul"}
        </p>
        <p className="text-sm text-muted">
          {reunion.locationName
            ? `Lokasi: ${reunion.locationName}`
            : "Lokasi menyusul"}
        </p>
        <p className="mt-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              reunion.registrationOpen
                ? "bg-forest/10 text-forest"
                : "bg-muted/10 text-muted"
            }`}
          >
            {reunion.registrationOpen
              ? "Pendaftaran dibuka"
              : "Pendaftaran ditutup"}
          </span>
        </p>
      </div>

      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:col-span-7">
        <AngkaItem
          label="Total peserta"
          value={angka(reunion.attendeeCount)}
          hint="terdaftar + waitlist"
        />
        <AngkaItem label="Terkonfirmasi" value={angka(reunion.confirmedPeople)} />
        <AngkaItem label="Waitlist" value={angka(reunion.waitlistPeople)} />
        <AngkaItem label="Dibatalkan" value={angka(reunion.cancelledPeople)} />
      </dl>
    </div>
  );
}
