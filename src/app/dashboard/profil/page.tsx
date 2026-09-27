import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProfilForm } from "@/components/dashboard/ProfilForm";
import { getGenerationLabel } from "@/lib/generations";

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
        },
      },
    },
  });
  if (!user) redirect("/login");

  const { person } = user;
  const platforms = await prisma.socialPlatform.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-forest">
          Edit Profil
        </h1>
        <p className="mt-1 text-sm text-muted">
          {getGenerationLabel(person.generationLevel)}
          {person.branch ? ` · Cabang ${person.branch.name}` : ""}
        </p>
      </header>

      <ProfilForm
        initial={{
          fullName: person.fullName,
          nickname: person.nickname ?? "",
          bio: person.bio ?? "",
          occupation: person.occupation ?? "",
          status: person.status ?? "",
          photoUrl: person.photoUrl,
          phone: person.private?.phone ?? "",
          whatsapp: person.private?.whatsapp ?? "",
          addressLine: person.private?.addressLine ?? "",
          city: person.private?.city ?? "",
          visibleToMembers: person.private?.visibleToMembers ?? true,
        }}
        platforms={platforms.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}