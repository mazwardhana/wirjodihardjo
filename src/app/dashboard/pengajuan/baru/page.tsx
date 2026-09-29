import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getGenerationLabel } from "@/lib/generations";
import {
  AddChildForm,
  AddPersonForm,
  AddSpouseForm,
} from "../_components/PengajuanForms";

export default async function PengajuanBaruPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      personId: true,
      person: {
        select: { id: true, fullName: true, generationLevel: true },
      },
    },
  });
  if (!user) redirect("/login");

  // Jangan tautkan ke bagian yang tidak dirender saat anggota belum punya data diri.
  const jumpNav = [
    ...(user.person
      ? [
          { href: "#tambah-anak", label: "Tambah Anak" },
          { href: "#tambah-pasangan", label: "Tambah Pasangan" },
        ]
      : []),
    { href: "#daftarkan-anggota", label: "Daftarkan Anggota" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/pengajuan"
        className="inline-flex min-h-11 items-center text-sm font-medium text-gold-deep underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Kembali ke Daftar Pengajuan
      </Link>

      <h1 className="mt-4 font-display text-3xl font-semibold text-forest">
        Pengajuan Baru
      </h1>
      <p className="mt-2 text-sm text-muted">
        Ajukan penambahan data anggota keluarga. Pengajuan akan diperiksa
        oleh admin sebelum disetujui.
      </p>

      <nav
        aria-label="Jenis pengajuan"
        className="mt-6 flex flex-wrap gap-2 text-sm"
      >
        {jumpNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-wood/15 bg-cream px-4 py-2 text-sm font-semibold text-forest underline hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {user.person ? (
        <>
          <section id="tambah-anak" className="mt-10">
            <h2 className="font-display text-xl font-semibold text-forest">
              Tambah Anak
            </h2>
            <p className="mb-4 text-sm text-muted">
              {getGenerationLabel(user.person.generationLevel)} -{" "}
              {user.person.fullName}
            </p>
            <div className="rounded-lg border border-wood/15 bg-cream p-6">
              <AddChildForm
                personId={user.personId}
                personName={user.person.fullName}
              />
            </div>
          </section>

          <section id="tambah-pasangan" className="mt-10">
            <h2 className="font-display text-xl font-semibold text-forest">
              Tambah Pasangan
            </h2>
            <p className="mb-4 text-sm text-muted">
              {getGenerationLabel(user.person.generationLevel)} -{" "}
              {user.person.fullName}
            </p>
            <div className="rounded-lg border border-wood/15 bg-cream p-6">
              <AddSpouseForm
                personId={user.personId}
                personName={user.person.fullName}
              />
            </div>
          </section>
        </>
      ) : (
        <p className="mt-8 text-sm text-muted">
          Untuk menambah anak atau pasangan, lengkapi profil Anda terlebih
          dahulu di{" "}
          <Link
            href="/dashboard/profil"
            className="text-gold-deep underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            halaman profil
          </Link>
          .
        </p>
      )}

      <section id="daftarkan-anggota" className="mt-10">
        <h2 className="font-display text-xl font-semibold text-forest">
          Daftarkan Anggota
        </h2>
        <p className="mb-4 text-sm text-muted">
          Tambahkan anggota keluarga yang belum tercatat dalam pohon keluarga.
        </p>
        <div className="rounded-lg border border-wood/15 bg-cream p-6">
          <AddPersonForm />
        </div>
      </section>
    </div>
  );
}
