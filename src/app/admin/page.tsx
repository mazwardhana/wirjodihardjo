import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminOverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, branchAdminOf: { select: { id: true } } },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const branchFilter = user.role === "BRANCH_ADMIN" && user.branchAdminOf?.id
    ? { branchId: user.branchAdminOf.id }
    : {};

  const [
    totalAnggota,
    anggotaHidup,
    anggotaWafat,
    pendingPengajuan,
    totalCabang,
    totalPengguna,
  ] = await Promise.all([
    prisma.person.count({ where: branchFilter }),
    prisma.person.count({ where: { ...branchFilter, isDeceased: false } }),
    prisma.person.count({ where: { ...branchFilter, isDeceased: true } }),
    prisma.submission.count({ where: { status: "PENDING" } }),
    prisma.branch.count({ where: { isActive: true } }),
    prisma.user.count(),
  ]);

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-forest">Overview</h1>
      <p className="mt-1 text-sm text-muted">
        Ringkasan data Keluarga Besar Wirjodihardjo
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="Total Anggota" value={String(totalAnggota)} />
        <Card label="Anggota Hidup" value={String(anggotaHidup)} />
        <Card label="Almarhum/Almarhumah" value={String(anggotaWafat)} />
        <Card label="Pengajuan Tertunda" value={String(pendingPengajuan)} highlight />
        <Card label="Cabang Aktif" value={String(totalCabang)} />
        <Card label="Pengguna Terdaftar" value={String(totalPengguna)} />
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        highlight
          ? "border-gold/40 bg-gold/5"
          : "border-wood/15 bg-cream"
      }`}
    >
      <p className="font-display text-3xl font-semibold text-forest">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}