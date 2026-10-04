import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getRegistrationBranches, REUNI_2027_TITLE } from "@/lib/registrasi";
import { RegistrasiForm } from "./RegistrasiForm";

// Daftar keluarga besar dibaca dari basis data saat halaman diminta; form ini
// terbuka untuk umum, jadi tidak ada yang perlu di-cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registrasi Data Keluarga",
  description:
    "Catat anggota keluarga besar Wirjodihardjo di buku besar keluarga dan daftarkan kehadirannya untuk reuni. Tanpa perlu masuk akun.",
};

export default async function RegistrasiPage() {
  const branches = await getRegistrationBranches(prisma);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <header className="border-b border-wood/20 pb-7">
        {/* Aksen emas hanya pada satu kata: '&' adalah poros antara daftar
            data keluarga dan pendaftaran reuni. */}
        <h1 className="font-display text-[2rem] font-semibold text-balance text-forest sm:text-4xl lg:text-5xl">
          Registrasi Data Keluarga Wirjodihardjo{" "}
          <span className="text-gold-deep">{"&"}</span> Pendaftaran Reuni
        </h1>

        <div className="motif-divider mt-6" aria-hidden="true" />

        <div className="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <p className="text-base leading-relaxed text-muted">
            Buku besar keluarga kami terbuka untuk semua cabang. Pilih keluarga besar tempat
            Anda berasal, lalu tuliskan anggota yang ingin Anda catat: nama panggilan, nama lengkap,
            dan apakah mereka bisa hadir di {REUNI_2027_TITLE}. Tidak perlu masuk akun, dan Anda
            boleh mengisi lebih dari sekali.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Setiap nama panggilan yang Anda tuliskan dibuatkan satu akun anggota. Nama pengguna dan
            kata sandi tidak ditampilkan di halaman ini: pengurus membagikannya lewat kanal
            keluarga, dan setiap anggota diminta menggantinya saat pertama kali masuk.
          </p>
        </div>
      </header>

      <div className="mt-10">
        <RegistrasiForm branches={branches} reuniTitle={REUNI_2027_TITLE} />
      </div>
    </div>
  );
}