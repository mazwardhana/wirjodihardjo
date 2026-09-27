import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getImmediateFamily, getClassifiedSiblings } from "@/lib/genealogy";
import { FamilyPanel } from "@/components/profil/FamilyPanel";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { projectPublicProfile, projectMemberProfile } from "@/lib/profile";

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
  const person = await prisma.person.findFirst({
    where: { id, deletedAt: null, ...(isMember ? {} : { isPublicProfile: true }) },
    select: {
      id: true, fullName: true, nickname: true, gender: true, birthDate: true,
      occupation: true, status: true, bio: true, photoUrl: true, generationLevel: true, isDeceased: true,
      branch: { select: { name: true, slug: true } },
      education: { orderBy: { startYear: "desc" }, select: { id: true, institution: true, degree: true, fieldOfStudy: true, startYear: true, endYear: true } },
      socialLinks: { include: { platform: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!person) notFound();

  // City is public by product policy; never fetch other private fields for guests.
  const cityData = await prisma.personPrivate.findUnique({ where: { personId: id }, select: { city: true } });
  const profile = projectPublicProfile({ ...person, city: cityData?.city ?? null });
  const privateData = isMember ? await prisma.personPrivate.findUnique({
    where: { personId: id }, select: { phone: true, whatsapp: true, addressLine: true, email: true, visibleToMembers: true },
  }) : null;
  const member = projectMemberProfile({ ...person, city: cityData?.city ?? null, private: privateData }, viewer?.role);
  const contacts = isMember && privateData?.visibleToMembers ? {
    phone: member.phone, whatsapp: member.whatsapp, addressLine: member.addressLine, email: member.email,
  } : null;

  const [immediateFamily, siblings] = await Promise.all([getImmediateFamily(id), getClassifiedSiblings(id)]);
  const familyData = immediateFamily ? {
    ...immediateFamily, siblings,
    partners: immediateFamily.partners.map(p => ({ ...p, marriageDate: p.marriageDate?.toISOString() ?? null, divorceDate: p.divorceDate?.toISOString() ?? null })),
  } : null;

  return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
    {viewer?.personId === id && <Link href="/dashboard/profil" className="mb-6 inline-flex min-h-11 items-center rounded-md border border-wood/30 px-4 text-sm text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Kelola profil saya</Link>}
    <ProfileCard profile={profile} contacts={contacts} isMember={isMember} />
    {familyData && <div className="mt-8"><FamilyPanel data={familyData} /></div>}
  </div>;
}
