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

  // Jumlah total orang yang sudah terdaftar (CONFIRMED + WAITLIST)
  const confirmedAgg = await prisma.reunionRegistration.aggregate({
    where: { reunionId: reunion.id, status: "CONFIRMED" },
    _sum: { guestCount: true },
  });
  const waitlistAgg = await prisma.reunionRegistration.aggregate({
    where: { reunionId: reunion.id, status: "WAITLIST" },
    _sum: { guestCount: true },
  });
  const attendeeCount = (confirmedAgg._sum.guestCount ?? 0) + (waitlistAgg._sum.guestCount ?? 0);

  // Pendaftaran pengguna yang sedang login
  let registration: { status: string; guestCount: number } | null = null;
  if (session?.user) {
    const reg = await prisma.reunionRegistration.findUnique({
      where: {
        reunionId_userId: { reunionId: reunion.id, userId: session.user.id },
      },
      select: { status: true, guestCount: true },
    });
    if (reg) registration = reg;
  }

  // Admin bisa melihat reuni draf
  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
    : null;
  const isAdmin =
    user?.role === "SUPER_ADMIN" || user?.role === "BRANCH_ADMIN";

  if (reunion.status === "DRAFT" && !isAdmin) notFound();

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