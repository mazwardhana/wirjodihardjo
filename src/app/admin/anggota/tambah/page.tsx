import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AnggotaForm } from "@/components/admin/AnggotaForm";

export default async function AdminAnggotaTambahPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, branchAdminOf: { select: { id: true } } },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const branches = await prisma.branch.findMany({
    where: user.role === "BRANCH_ADMIN" && user.branchAdminOf?.id
      ? { id: user.branchAdminOf.id }
      : {},
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-forest">Tambah Anggota</h1>
      <p className="mt-1 text-sm text-muted">
        Data anggota baru akan langsung tersimpan di database.
      </p>

      <div className="mt-8 max-w-xl">
        <AnggotaForm branches={branches.map((b) => ({ id: b.id, name: b.name }))} />
      </div>
    </div>
  );
}