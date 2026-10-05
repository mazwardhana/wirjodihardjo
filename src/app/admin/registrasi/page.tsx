import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { REGISTRASI_IMPORT_TYPE } from "@/lib/registrasi-import/types";
import { RegistrasiImporClient } from "./RegistrasiImporClient";
import type { RegistrasiBatchSummary } from "./RegistrasiImporClient";

export const dynamic = "force-dynamic";

export default async function AdminRegistrasiImporPage() {
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
    where: { type: REGISTRASI_IMPORT_TYPE },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { createdBy: { select: { person: { select: { fullName: true } } } } },
  });

  const batchSummaries: RegistrasiBatchSummary[] = recentBatches.map((batch) => ({
    id: batch.id,
    filename: batch.filename,
    status: batch.status,
    totalRows: batch.totalRows,
    successRows: batch.successRows,
    errorRows: batch.errorRows,
    createdAt: batch.createdAt.toISOString(),
    createdBy: batch.createdBy?.person?.fullName ?? "-",
  }));

  return (
    <div className="min-w-0 p-4 sm:p-8 [overflow-wrap:anywhere]">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-forest">Impor Data Registrasi Keluarga</h1>
        <p className="mt-1 text-sm text-muted">
          Unggah file XLSX atau CSV untuk membuat akun dan data registrasi keluarga secara massal
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-wood/20 bg-parchment/40 p-4">
        <h2 className="text-sm font-semibold text-forest">Petunjuk</h2>
        <div className="mt-2 flex flex-wrap gap-3">
          <a href="/api/admin/registrasi/template?format=xlsx" download className="inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold hover:bg-parchment focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
            Unduh template XLSX
          </a>
          <a href="/api/admin/registrasi/template?format=csv" download className="inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold hover:bg-parchment focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
            Unduh template CSV
          </a>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>1. Isi sheet Data dengan kolom: kode cabang keluarga*, nama panggilan*, nama lengkap*, gender* (L/P), status* (hidup/wafat), hadir reuni (ya/tidak)</li>
          <li>2. Kolom bertanda * wajib diisi. Satu berkas boleh memuat beberapa cabang</li>
          <li>3. Password akun default adalah 12345678 dan wajib diganti saat login pertama</li>
          <li>4. Baris yang sudah ada (cabang + nama lengkap) akan dilewati dan dilaporkan</li>
          <li>5. Unggah file (XLSX, XLSM, atau CSV) untuk divalidasi, periksa pratinjau, lalu konfirmasi untuk menyimpan</li>
          <li>6. Unduh laporan kredensial untuk dibagikan ke anggota</li>
        </ul>
      </div>

      <RegistrasiImporClient recentBatches={batchSummaries} />
    </div>
  );
}
