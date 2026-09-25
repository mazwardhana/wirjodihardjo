import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { HallOfFameForm } from "@/components/admin/HallOfFameForm";

export default async function AdminHallOfFameEditPage({
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

  const entry = await prisma.hallOfFameEntry.findUnique({
    where: { id },
    include: {
      person: { select: { id: true, fullName: true } },
    },
  });
  if (!entry) notFound();

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-forest">Ubah Entri Hall of Fame</h1>
      <p className="mt-1 text-sm text-muted">Perbarui data entri yang sudah ada.</p>

      <div className="mt-8">
        <HallOfFameForm
          entryId={id}
          initial={{
            category: entry.category,
            title: entry.title,
            description: entry.description,
            year: entry.year,
            entryType: entry.entryType as "ACHIEVEMENT" | "IN_MEMORIAM",
            isPublished: entry.isPublished,
            photoUrl: entry.photoUrl,
          }}
          initialPerson={entry.person}
        />
      </div>
    </div>
  );
}