import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRegistrationBranches } from "@/lib/registrasi";
import { BukuTamuClient } from "./BukuTamuClient";

// Daftar keluarga besar dibaca dari basis data saat halaman diminta. Halaman
// ini terbuka untuk umum lewat QR di lokasi reuni, jadi tidak ada yang di-cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buku Tamu Reuni",
  description:
    "Catat kehadiran Anda dan rombongan di reuni Keluarga Besar Wirjodihardjo. Pilih keluarga besar, cari nama, lalu tandai hadir. Tanpa perlu masuk akun.",
};

export default async function BukuTamuPage() {
  const branches = await getRegistrationBranches(prisma);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="border-b border-wood/20 pb-6">
        <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
          Buku Tamu
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-balance text-forest sm:text-4xl">
          Kehadiran Reuni
        </h1>
        <div className="motif-divider mt-5" aria-hidden="true" />
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Selamat datang. Tuliskan siapa saja yang datang bersama Anda, supaya
          panitia punya catatan kehadiran yang rapi. Nama yang belum ada di buku
          besar keluarga tetap bisa ditambahkan; pengurus yang akan membuatkan
          akunnya.
        </p>
      </header>

      <div className="mt-8">
        <BukuTamuClient branches={branches} />
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Butuh mencatat data keluarga lebih lengkap?{" "}
        <Link
          href="/registrasi"
          className="font-semibold text-forest underline decoration-gold-deep decoration-2 underline-offset-4"
        >
          Buka halaman registrasi
        </Link>
        .
      </p>
    </div>
  );
}
