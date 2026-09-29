import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getActorScope } from "@/lib/rbac";
import { CabangDetail } from "@/components/admin/CabangDetail";

export default async function AdminKeluargaCabangDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const scope = await getActorScope(session.user.id).catch(() => null);
  if (!scope || scope.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;

  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      rootPerson: { select: { id: true, fullName: true } },
      admin: { select: { id: true, email: true, role: true, person: { select: { fullName: true } } } },
      _count: { select: { members: true } },
    },
  });

  if (!branch) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Kelola Cabang</h1>
      <p className="mt-1 text-sm text-muted">
        {branch.name} &middot; {branch._count.members} anggota
      </p>
      <div className="mt-8">
        <CabangDetail branch={branch} />
      </div>
    </div>
  );
}
