import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActorScope } from "@/lib/rbac";
import { KeluargaDashboard, type BranchOption } from "./KeluargaDashboard";

export default async function AdminKeluargaPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const scope = await getActorScope(session.user.id).catch(() => null);
  if (!scope || (scope.role !== "SUPER_ADMIN" && scope.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const sp = await searchParams;

  // BRANCH_ADMIN: terkunci ke cabang yang ditugaskan. Tanpa penugasan -> tanpa data.
  if (scope.role === "BRANCH_ADMIN") {
    if (!scope.branchId) {
      return (
        <div className="p-8">
          <h1 className="font-display text-2xl font-semibold text-forest">Keluarga</h1>
          <div className="mt-6 rounded-lg border border-dashed border-wood/30 p-12 text-center">
            <p className="text-sm font-semibold text-forest">Akses ditolak</p>
            <p className="mt-2 text-sm text-muted">
              Akun Anda belum ditugaskan ke satu cabang. Hubungi Super Admin untuk penugasan cabang.
            </p>
          </div>
        </div>
      );
    }

    return (
      <KeluargaDashboard
        isSuperAdmin={false}
        initialBranchId={scope.branchId}
        branchOptions={[]}
      />
    );
  }

  // SUPER_ADMIN: pilih cabang.
  const branches = await prisma.branch.findMany({
    orderBy: { branchNumber: "asc" },
    select: { id: true, name: true, branchNumber: true },
  });

  if (branches.length === 0) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl font-semibold text-forest">Keluarga</h1>
        <div className="mt-6 rounded-lg border border-dashed border-wood/30 p-12 text-center text-sm text-muted">
          Belum ada cabang. Buat cabang terlebih dahulu untuk mulai mengelola anggota keluarga.
        </div>
      </div>
    );
  }

  const branchOptions: BranchOption[] = branches.map((b) => ({
    id: b.id,
    name: b.name,
    branchNumber: b.branchNumber,
  }));

  const requested = sp.branchId;
  const branchId =
    requested && branches.some((b) => b.id === requested) ? requested : branches[0].id;

  return (
    <KeluargaDashboard
      isSuperAdmin
      initialBranchId={branchId}
      branchOptions={branchOptions}
    />
  );
}
