import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { StatusEditor } from "@/components/profile/StatusEditor";
import { getGenerationLabel } from "@/lib/generations";

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function DashboardProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      person: {
        include: {
          private: true,
          branch: { select: { name: true } },
          socialLinks: { include: { platform: { select: { name: true } } } },
          statuses: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      },
    },
  });
  if (!user) redirect("/login");

  const { person } = user;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-forest">
          Profil Lengkap
        </h1>
        <p className="mt-1 text-sm text-muted">
          {getGenerationLabel(person.generationLevel)}
          {person.branch ? ` · Keluarga Cabang ${person.branch.name}` : ""}
        </p>
      </header>

      <StatusEditor
        personId={person.id}
        initialStatuses={person.statuses.map((status) => ({
          id: status.id,
          message: status.message,
          createdAt: status.createdAt.toISOString(),
        }))}
      />

      <ProfileForm
        initial={{
          fullName: person.fullName,
          nickname: person.nickname ?? "",
          namaPanggilan: person.namaPanggilan ?? "",
          gender: person.gender,
          photoUrl: person.photoUrl,
          birthPlace: person.birthPlace ?? "",
          birthDate: isoDate(person.birthDate),
          birthDatePrecision: person.birthDatePrecision ?? "",
          isDeceased: person.isDeceased,
          deathPlace: person.deathPlace ?? "",
          deathDate: isoDate(person.deathDate),
          phone: person.private?.phone ?? "",
          whatsapp: person.private?.whatsapp ?? "",
          addressLine: person.private?.addressLine ?? "",
          city: person.private?.city ?? "",
          province: person.private?.province ?? "",
          postalCode: person.private?.postalCode ?? "",
          visibleToMembers: person.private?.visibleToMembers ?? true,
        }}
        socialLinks={person.socialLinks.map((link) => ({
          id: link.id,
          platform: link.platform.name,
          url: link.url,
          username: link.username,
        }))}
      />
    </div>
  );
}
