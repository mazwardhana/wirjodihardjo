import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AddChildForm } from "@/components/dashboard/AddChildForm";
import { getGenerationLabel } from "@/lib/generations";

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">
        Pengajuan Baru
      </h1>
      <p className="mt-2 text-sm text-muted">
        Ajukan penambahan data anggota keluarga. Pengajuan akan diperiksa oleh admin sebelum disetujui.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold text-forest">
          Tambah Anak
        </h2>
        <p className="mb-4 text-sm text-muted">
          {getGenerationLabel(user.person.generationLevel)} - {user.person.fullName}
        </p>
        <div className="rounded-lg border border-wood/15 bg-cream p-6">
          <AddChildForm personId={user.personId} personName={user.person.fullName} />
        </div>
      </section>
    </div>
  );
}