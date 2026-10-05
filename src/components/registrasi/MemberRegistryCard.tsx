import Link from "next/link";

/**
 * Pintu masuk ke daftar anggota tercatat.
 *
 * Daftar lengkapnya tinggal di halamannya sendiri (`/registrasi/anggota`); di
 * sini cukup satu kartu yang menyebut jumlah anggota, supaya halaman registrasi
 * tetap fokus pada form. Seluruh kartu adalah tautan, jadi bidang kliknya luas
 * dan namanya terbaca utuh oleh pembaca layar.
 */
export function MemberRegistryCard({ count }: { count: number }) {
  const jumlah = new Intl.NumberFormat("id-ID").format(count);

  return (
    <Link
      href="/registrasi/anggota"
      className="group flex min-h-11 items-center gap-4 rounded-lg border border-wood/25 bg-parchment/50 px-5 py-4 transition-colors hover:border-forest/60 hover:bg-parchment focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      <span aria-hidden="true" className="shrink-0 text-wood">
        <IkonBuku />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold text-forest">
          Daftar anggota tercatat
        </span>
        <span className="mt-0.5 block text-sm text-muted">
          {jumlah} anggota tercatat
        </span>
      </span>

      <span
        aria-hidden="true"
        className="shrink-0 text-wood transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
      >
        <IkonPanah />
      </span>
    </Link>
  );
}

function IkonBuku() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}

function IkonPanah() {
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
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
