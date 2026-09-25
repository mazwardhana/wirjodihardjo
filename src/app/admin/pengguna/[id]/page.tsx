import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PenggunaDetail } from "@/components/admin/PenggunaDetail";

export default async function PenggunaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      person: { select: { id: true, fullName: true, photoUrl: true, generationLevel: true } },
      createdBy: { select: { person: { select: { fullName: true } } } },
      branchAdminOf: { select: { name: true } },
    },
  });
  if (!user) redirect("/admin/pengguna");

  return (
    <div className="p-8">
      <PenggunaDetail user={user as any} />
    </div>
  );
}