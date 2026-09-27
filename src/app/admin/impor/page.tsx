import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ImporClient } from "./ImporClient";

export const dynamic = "force-dynamic";

export default async function AdminImporPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const recentBatches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { createdBy: { select: { person: { select: { fullName: true } } } } },
  });

  return (
    <div className="min-w-0 p-4 sm:p-8 [overflow-wrap:anywhere]">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-forest">Impor Data Keluarga</h1>
        <p className="mt-1 text-sm text-muted">
          Unggah file XLSX atau CSV untuk impor anggota, relasi, dan akun secara massal
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-wood/20 bg-parchment/40 p-4">
        <h2 className="text-sm font-semibold text-forest">Petunjuk</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>1. Unduh template XLSX di bawah (atau CSV per sheet untuk editor spreadsheet sederhana)</li>
          <li>2. Isi sheet Anggota, Relasi, dan Akun sesuai petunjuk</li>
          <li>3. Unggah file yang sudah diisi untuk validasi (XLSX atau CSV)</li>
          <li>4. Periksa pratinjau, lalu konfirmasi untuk menyimpan data</li>
          <li>5. Unduh laporan kredensial untuk dibagikan ke anggota</li>
        </ul>
      </div>

      <ImporClient recentBatches={recentBatches} />
    </div>
  );
}
