import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  asRegistryDb,
  getPublicMembers,
  REGISTRY_PAGE_SIZE,
} from "@/lib/registrasi-registry";
import { MemberRegistry } from "@/components/registrasi/MemberRegistry";

// Daftar anggota dibaca dari basis data setiap kali halaman diminta, termasuk
// filter dan halamannya: arsip keluarga berubah terus lewat form registrasi.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar Anggota Tercatat",
  description:
    "Seluruh anggota keluarga besar Wirjodihardjo yang sudah tercatat di buku besar keluarga, beserta keluarga cabang asalnya. Bisa difilter dan dicari namanya.",
};

export default async function DaftarAnggotaPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const branchId = typeof params.branchId === "string" ? params.branchId.trim() : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = params.page ? Number.parseInt(params.page, 10) : 1;

  const members = await getPublicMembers(asRegistryDb(prisma), {
    branchId,
    q,
    page: Number.isFinite(page) ? page : 1,
    pageSize: REGISTRY_PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <Link
        href="/registrasi"
        className="inline-flex min-h-11 items-center text-sm text-muted transition-colors hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
      >
        ← Registrasi Data Keluarga
      </Link>

      <div className="mt-6">
        <MemberRegistry
          result={members}
          branches={members.branches}
          branchId={branchId}
          q={q}
          basePath="/registrasi/anggota"
          headingLevel="h1"
        />
      </div>
    </div>
  );
}
