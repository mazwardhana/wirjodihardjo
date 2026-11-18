import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MemoriModerasiTable } from "@/components/admin/MemoriModerasiTable";

export const dynamic = "force-dynamic";

export default async function AdminMemoriPage() {
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
      <h1 className="font-display text-2xl font-semibold text-forest">Memori</h1>
      <p className="mt-1 text-sm text-muted">
        Setujui, tolak, atau hapus cerita dan berkas yang dikirim anggota keluarga.
      </p>
      <div className="mt-6">
        <MemoriModerasiTable />
      </div>
    </div>
  );
}
