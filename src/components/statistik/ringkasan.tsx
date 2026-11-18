import { angka } from "./shared";

/**
 * Ringkasan kondisi arsip: total anggota + proporsi hidup/wafat + gender.
 * Dipakai oleh halaman statistik publik dan admin dengan gaya masing-masing;
 * angka dan hitungannya datang dari satu tempat.
 */

function BatangProporsi({
  livingPercent,
  total,
  living,
  deceased,
}: {
  livingPercent: number;
  total: number;
  living: number;
  deceased: number;
}) {
  const deceasedPercent = Math.max(0, 100 - livingPercent);
  return (
    <div>
      <p className="font-display text-lg font-semibold text-forest">
        Masih hidup atau sudah wafat
      </p>
      <div
        role="img"
        aria-label={`Dari ${angka(total)} anggota tercatat, ${angka(living)} masih hidup (${livingPercent} persen) dan ${angka(deceased)} sudah wafat (${deceasedPercent} persen).`}
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
            {angka(living)}
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
            {angka(deceased)}
            <span className="ml-2 text-base font-normal text-muted tabular-nums">
              {deceasedPercent}%
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Ringkasan angka utama (tanpa narasi): dipakai halaman admin. */
export function RingkasanAngka({
  family,
}: {
  family: {
    total: number;
    living: number;
    deceased: number;
    male: number;
    female: number;
    unassigned: number;
    livingPercent: number;
  };
}) {
  const items = [
    { label: "Masih hidup", value: family.living },
    { label: "Sudah wafat", value: family.deceased },
    { label: "Laki-laki", value: family.male },
    { label: "Perempuan", value: family.female },
    { label: "Belum ditugaskan ke keluarga besar", value: family.unassigned },
  ];
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="border-t border-wood/15 pt-3">
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="mt-1 font-display text-2xl font-semibold text-forest tabular-nums">
            {angka(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Blok kondisi arsip lengkap dengan batang proporsi (gaya halaman publik). */
export function RingkasanKondisiArsip({
  family,
}: {
  family: {
    total: number;
    living: number;
    deceased: number;
    male: number;
    female: number;
    unassigned: number;
    livingPercent: number;
  };
}) {
  const belumTerisiJenisKelamin = Math.max(0, family.total - family.male - family.female);
  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-5">
        <p className="text-sm text-muted">Anggota tercatat</p>
        <p className="mt-1 font-display text-6xl font-semibold text-forest tabular-nums sm:text-7xl">
          {angka(family.total)}
        </p>
        <span aria-hidden="true" className="mt-4 block h-1 w-16 rounded-full bg-gold" />
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
          Hitungan ini mencakup anggota yang masih hidup dan yang sudah
          wafat, jadi silsilah yang bisa Anda telusuri di situs ini utuh.
        </p>
      </div>
      <div className="lg:col-span-7">
        <BatangProporsi
          livingPercent={family.livingPercent}
          total={family.total}
          living={family.living}
          deceased={family.deceased}
        />
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Laki-laki {angka(family.male)} orang, perempuan{" "}
          {angka(family.female)} orang
          {belumTerisiJenisKelamin > 0 &&
            `, serta ${angka(belumTerisiJenisKelamin)} orang yang belum diisi jenis kelaminnya`}
          .
        </p>
      </div>
    </div>
  );
}
