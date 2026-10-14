import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tidak ada koneksi",
  description: "Halaman cadangan saat perangkat sedang luring.",
};

// Halaman cadangan luring: di-precache service worker dan ditampilkan saat
// navigasi gagal karena jaringan mati, bukan error bawaan peramban.
export default function OfflinePage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl font-semibold text-forest">
        Sedang luring
      </h1>
      <p className="text-muted">
        Perangkat ini tidak terhubung ke internet. Halaman yang sudah pernah
        dibuka masih bisa diakses. Coba sambungkan kembali lalu muat ulang.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-11 items-center rounded-md bg-forest px-5 py-2.5 text-sm font-semibold text-cream"
      >
        Coba beranda
      </Link>
    </section>
  );
}
