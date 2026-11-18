import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getImmediateFamily, getClassifiedSiblings } from "@/lib/genealogy";
import { FamilyPanel } from "@/components/profil/FamilyPanel";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { projectPublicProfile, projectMemberProfile } from "@/lib/profile";
import { buildLifeTimeline, buildTimelinePoints, type TimelineEvent } from "@/lib/timeline";
import { ContextualHelp } from "@/components/ui/ContextualHelp";
import { TimelinePanel } from "@/components/profil/TimelinePanel";
import { TimelineMap } from "@/components/profil/TimelineMap";
import { MemorySection } from "@/components/profil/MemorySection";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await prisma.person.findFirst({ where: { id, deletedAt: null, isPublicProfile: true }, select: { fullName: true } });
  return { title: person?.fullName ?? "Anggota tidak ditemukan" };
}

export default async function ProfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const viewer = session?.user ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, personId: true } }) : null;
  const isMember = viewer !== null && ["MEMBER", "BRANCH_ADMIN", "SUPER_ADMIN"].includes(viewer.role);
  // Tamu hanya menerima status terbaru di payload; riwayat lengkap khusus anggota.
  const statusTake = isMember ? 20 : 1;
  const person = await prisma.person.findFirst({
    where: { id, deletedAt: null, ...(isMember ? {} : { isPublicProfile: true }) },
    select: {
      id: true, fullName: true, nickname: true, namaPanggilan: true, gender: true, birthDate: true, birthPlace: true, deathDate: true, deathPlace: true,
      occupation: true, status: true, bio: true, photoUrl: true, generationLevel: true, isDeceased: true,
      branch: { select: { name: true, slug: true } },
      education: { orderBy: { startYear: "desc" }, select: { id: true, institution: true, degree: true, fieldOfStudy: true, startYear: true, endYear: true } },
      lifeEvents: {
        orderBy: { date: "asc" },
        select: {
          id: true, kind: true, title: true, description: true, locationName: true,
          latitude: true, longitude: true, date: true, datePrecision: true,
        },
      },
      socialLinks: { include: { platform: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      statuses: { orderBy: { createdAt: "desc" }, take: statusTake },
    },
  });
  if (!person) notFound();

  // Garis waktu hidup: gabungan data inti person, life events, dan pendidikan.
  // Filter privasi tamu dibuat identik dengan route /api/person/[id]/timeline
  // agar tampilan halaman dan data API tidak pernah berbeda.
  const { events: lifeEventsAll } = buildLifeTimeline({
    person: {
      id: person.id,
      birthDate: person.birthDate,
      birthPlace: person.birthPlace,
      deathDate: person.deathDate,
      deathPlace: person.deathPlace,
      isDeceased: person.isDeceased,
    },
    lifeEvents: person.lifeEvents,
    education: person.education,
  });
  const timelineEvents: TimelineEvent[] = isMember
    ? lifeEventsAll
    : lifeEventsAll
        .filter((event) =>
          event.kind === "BIRTH" ||
          event.kind === "DEATH" ||
          event.kind === "EDUCATION" ||
          ((event.kind === "CUSTOM" || event.kind === "MARRIAGE" || event.kind === "OCCUPATION") &&
            event.latitude !== null && event.longitude !== null),
        )
        .map((event) =>
          event.kind === "EDUCATION" || event.kind === "CUSTOM" || event.kind === "OCCUPATION"
            ? { ...event, description: null }
            : event,
        );

  // Kota tetap publik (kebijakan produk). Field kontak hanya di-query bila
  // pengunjung sudah login sebagai anggota, sehingga data sensitif tak pernah
  // menyentuh query untuk guest (kontrak: lapisan publik tak menyentuh
  // PersonPrivate). Bacaan kota dan bacaan kontak tetap terpisah sesuai kontrak
  // (select kontak sengaja tanpa `city`), namun keduanya kini dijalankan paralel
  // lewat Promise.all agar dua round-trip sebelumnya jadi satu masa tunggu.
  const [cityData, privateData] = await Promise.all([
    prisma.personPrivate.findUnique({ where: { personId: id }, select: { city: true } }),
    isMember
      ? prisma.personPrivate.findUnique({
          where: { personId: id },
          select: { phone: true, whatsapp: true, addressLine: true, email: true, visibleToMembers: true },
        })
      : Promise.resolve(null),
  ]);

  const profile = projectPublicProfile({ ...person, city: cityData?.city ?? null });
  const member = projectMemberProfile(
    { ...person, city: cityData?.city ?? null, private: privateData },
    viewer?.role,
  );
  const contacts = isMember && privateData?.visibleToMembers
    ? { phone: member.phone, whatsapp: member.whatsapp, addressLine: member.addressLine, email: member.email }
    : null;

  // Kedua kalkulasi keluarga independen — tetap paralel.
  const [immediateFamily, siblings] = await Promise.all([getImmediateFamily(id), getClassifiedSiblings(id)]);
  const familyData = immediateFamily ? {
    ...immediateFamily, siblings,
    partners: immediateFamily.partners.map(p => ({ ...p, marriageDate: p.marriageDate?.toISOString() ?? null, divorceDate: p.divorceDate?.toISOString() ?? null })),
  } : null;

  // Memori: yang disetujui tampil untuk semua orang; kiriman pengunjung
  // sendiri (semua status) ikut tampil bila ia login, agar ia bisa melihat
  // status moderasinya. Aturan potongan tamu 280 karakter sama dengan GET
  // /api/person/[id]/memories supaya halaman dan API tidak berbeda.
  const memoryRows = await prisma.personMemory.findMany({
    where: {
      personId: id,
      ...(session?.user
        ? { OR: [{ status: "APPROVED" }, { uploadedByUserId: session.user.id }] }
        : { status: "APPROVED" }),
    },
    orderBy: { createdAt: "desc" },
  });
  const memories = memoryRows.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    content:
      m.kind === "STORY"
        ? m.content && !isMember && m.content.length > 280
          ? m.content.slice(0, 280)
          : m.content
        : null,
    fileUrl: m.fileUrl,
    thumbnailUrl: m.thumbnailUrl,
    status: session?.user && m.uploadedByUserId === session.user.id ? m.status : "APPROVED",
    createdAt: m.createdAt.toISOString(),
  }));

  return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
    <ContextualHelp title="Tentang profil ini">
      Halaman ini menampilkan data anggota yang bersifat publik: nama, generasi,
      pendidikan, dan tautan. Data kontak hanya terlihat oleh anggota yang login
      dan sesuai pengaturan privasi pemilik profil.
    </ContextualHelp>
    {viewer?.personId === id && <Link href="/dashboard/profil" className="mb-6 inline-flex min-h-11 items-center rounded-md border border-wood/30 px-4 text-sm text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Kelola profil saya</Link>}
    <ProfileCard profile={profile} contacts={contacts} isMember={isMember} />
    {familyData && <div className="mt-8"><FamilyPanel data={familyData} /></div>}
    <div className="mt-8 space-y-8">
      <TimelinePanel
        events={timelineEvents.map(({ date, ...rest }) => ({ ...rest, date: date ? date.toISOString() : null }))}
      />
      <TimelineMap points={buildTimelinePoints(timelineEvents)} />
      <MemorySection personId={id} memories={memories} canSubmit={isMember} />
    </div>
  </div>;
}
