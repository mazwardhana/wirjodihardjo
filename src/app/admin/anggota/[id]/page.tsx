import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { AdminAnggotaDetail } from "@/components/admin/AnggotaDetail";

export default async function AdminAnggotaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, branchAdminOf: { select: { id: true } } },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      branch: true,
      private: true,
      user: { select: { id: true, email: true, role: true } },
      parents: {
        include: { parent: { select: { id: true, fullName: true, photoUrl: true } } },
      },
      children: {
        include: {
          child: {
            select: { id: true, fullName: true, photoUrl: true, gender: true, generationLevel: true },
          },
        },
      },
      partnershipsA: {
        include: { partnerB: { select: { id: true, fullName: true, photoUrl: true } } },
      },
      partnershipsB: {
        include: { partnerA: { select: { id: true, fullName: true, photoUrl: true } } },
      },
      adminNotes: {
        include: { author: { select: { person: { select: { fullName: true } } } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!person) notFound();

  const branches = await prisma.branch.findMany({
    where: user.role === "BRANCH_ADMIN" && user.branchAdminOf?.id
      ? { id: user.branchAdminOf.id }
      : {},
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8">
      <AdminAnggotaDetail
        person={person as any}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        isSuperAdmin={user.role === "SUPER_ADMIN"}
      />
    </div>
  );
}