import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ReunionDetail } from "@/components/reuni/ReunionDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const reunion = await prisma.reunion.findUnique({
    where: { slug },
    select: { title: true },
  });
  return { title: reunion?.title ?? "Reuni tidak ditemukan" };
}

export default async function ReuniSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  const reunion = await prisma.reunion.findUnique({ where: { slug } });
  if (!reunion) notFound();

  // Periksa peran pengunjung lebih dulu: reuni DRAFT hanya boleh dilihat admin.
  const viewer = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
    : null;
  const isAdmin = viewer?.role === "SUPER_ADMIN" || viewer?.role === "BRANCH_ADMIN";
  if (reunion.status === "DRAFT" && !isAdmin) notFound();

  // Empat pembacaan independen (jumlah peserta plus pendaftaran diri) dijalankan
  // paralel; sebelumnya tiga `await` berurutan.
  const [confirmedAgg, waitlistAgg, ownRegistration] = await Promise.all([
    prisma.reunionRegistration.aggregate({
      where: { reunionId: reunion.id, status: "CONFIRMED" },
      _sum: { guestCount: true },
    }),
    prisma.reunionRegistration.aggregate({
      where: { reunionId: reunion.id, status: "WAITLIST" },
      _sum: { guestCount: true },
    }),
    session?.user
      ? prisma.reunionRegistration.findUnique({
          where: {
            reunionId_userId: { reunionId: reunion.id, userId: session.user.id },
          },
          select: { status: true, guestCount: true },
        })
      : Promise.resolve(null),
  ]);

  const attendeeCount =
    (confirmedAgg._sum.guestCount ?? 0) + (waitlistAgg._sum.guestCount ?? 0);

  // Pendaftaran pengguna yang sedang login
  const registration = ownRegistration
    ? { status: ownRegistration.status, guestCount: ownRegistration.guestCount }
    : null;

  return (
    <ReunionDetail
      reunion={{
        id: reunion.id,
        title: reunion.title,
        slug: reunion.slug,
        description: reunion.description,
        startAt: reunion.startAt,
        endAt: reunion.endAt,
        locationName: reunion.locationName,
        locationUrl: reunion.locationUrl,
        capacity: reunion.capacity,
        registrationDeadline: reunion.registrationDeadline,
        heroImageUrl: reunion.heroImageUrl,
        status: reunion.status,
      }}
      attendeeCount={attendeeCount}
      registration={registration}
      isLoggedIn={!!session?.user}
    />
  );
}