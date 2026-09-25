import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ReunionForm } from "@/components/admin/ReunionForm";

export default async function AdminReuniBaruPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-forest">
        Buat Reuni Baru
      </h1>
      <p className="mt-1 text-sm text-muted">
        Isi detail acara reuni keluarga. Status awal adalah draf — terbitkan
        setelah semuanya siap.
      </p>
      <div className="mt-8 max-w-xl">
        <ReunionForm isEdit={false} />
      </div>
    </div>
  );
}