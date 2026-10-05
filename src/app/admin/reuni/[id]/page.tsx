import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ReunionForm } from "@/components/admin/ReunionForm";
import { ReunionRegistrations } from "@/components/admin/ReunionRegistrations";
import { AddReunionParticipant } from "@/components/admin/AddReunionParticipant";

const statusMeta: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draf", className: "bg-muted/10 text-muted" },
  PUBLISHED: { label: "Terbit", className: "bg-forest/10 text-forest" },
  CANCELLED: { label: "Dibatalkan", className: "bg-wood/10 text-wood" },
  COMPLETED: { label: "Selesai", className: "bg-gold/20 text-gold-deep" },
};

export default async function AdminReuniDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const reunion = await prisma.reunion.findUnique({
    where: { id },
    include: {
      _count: { select: { registrations: true } },
      registrations: {
        orderBy: { createdAt: "desc" },
        include: {
          // Baris yang dibuat panitia hanya menunjuk `person`; baris lama dari
          // pendaftaran mandiri tidak punya `personId`, jadi nama diambil dari
          // profil pemilik akun sebagai cadangan.
          person: {
            select: {
              fullName: true,
              namaPanggilan: true,
              branch: { select: { name: true, branchNumber: true } },
            },
          },
          user: { select: { person: { select: { fullName: true } } } },
        },
      },
    },
  });

  if (!reunion) notFound();

  // Kandidat peserta manual: anggota yang belum punya baris pendaftaran untuk
  // reuni ini. Diambil terpisah agar daftar peserta yang sudah ada tetap ringkas.
  //
  // Pendaftaran bisa menunjuk orang lewat `personId` (dibuat panitia) atau lewat
  // akun peminjamnya, `userId` (daftar mandiri). Keduanya harus dicek, kalau tidak
  // anggota yang sudah terdaftar akan ikut muncul sebagai kandidat.
  const candidates = await prisma.person.findMany({
    where: {
      deletedAt: null,
      reunionRegistrations: { none: { reunionId: reunion.id } },
      OR: [
        { user: { is: null } },
        { user: { is: { reunionRegistrations: { none: { reunionId: reunion.id } } } } },
      ],
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      namaPanggilan: true,
      branch: { select: { name: true } },
    },
  });

  const meta = statusMeta[reunion.status] ?? statusMeta.DRAFT;

  const confirmedCount = reunion.registrations.filter(
    (r) => r.status === "CONFIRMED"
  ).length;
  const waitlistCount = reunion.registrations.filter(
    (r) => r.status === "WAITLIST"
  ).length;
  const cancelledCount = reunion.registrations.filter(
    (r) => r.status === "CANCELLED"
  ).length;

  // Format dates for the form
  const formatDT = (d: Date | null | undefined) => {
    if (!d) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">
            {reunion.title}
          </h1>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}
          >
            {meta.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-wood/15 bg-cream p-4 text-center">
          <p className="text-2xl font-bold text-forest">{reunion._count.registrations}</p>
          <p className="text-xs text-muted">Total pendaftar</p>
        </div>
        <div className="rounded-lg border border-wood/15 bg-cream p-4 text-center">
          <p className="text-2xl font-bold text-forest">{confirmedCount}</p>
          <p className="text-xs text-muted">Dikonfirmasi</p>
        </div>
        <div className="rounded-lg border border-wood/15 bg-cream p-4 text-center">
          <p className="text-2xl font-bold text-gold-deep">{waitlistCount}</p>
          <p className="text-xs text-muted">Daftar tunggu</p>
        </div>
        <div className="rounded-lg border border-wood/15 bg-cream p-4 text-center">
          <p className="text-2xl font-bold text-wood">{cancelledCount}</p>
          <p className="text-xs text-muted">Dibatalkan</p>
        </div>
      </div>

      {/* Edit form */}
      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold text-forest">
          Edit Reuni
        </h2>
        <div className="mt-4 max-w-xl">
          <ReunionForm
            isEdit
            initial={{
              id: reunion.id,
              title: reunion.title,
              slug: reunion.slug,
              description: reunion.description ?? "",
              startAt: formatDT(reunion.startAt),
              endAt: formatDT(reunion.endAt),
              locationName: reunion.locationName ?? "",
              locationUrl: reunion.locationUrl ?? "",
              capacity: reunion.capacity?.toString() ?? "",
              registrationDeadline: formatDT(reunion.registrationDeadline),
              heroImageUrl: reunion.heroImageUrl,
            }}
          />
        </div>
      </div>

      {/* Registrations */}
      <div className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-forest">
            Daftar Peserta
          </h2>
          <AddReunionParticipant reunionId={reunion.id} candidates={candidates} />
        </div>
        <div className="mt-4">
          <ReunionRegistrations
            registrations={reunion.registrations.map((r) => ({
              id: r.id,
              personId: r.personId,
              guestCount: r.guestCount,
              notes: r.notes,
              status: r.status,
              attendance: r.attendance,
              createdAt: r.createdAt.toISOString(),
              fullName: r.person?.fullName ?? r.user?.person.fullName ?? "(tanpa profil)",
              branchName: r.person?.branch?.name ?? null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}