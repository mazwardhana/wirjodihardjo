import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getGovernanceData } from "@/lib/governance";
import { PENGURUS_PLACEHOLDER_NAME } from "@/components/governance/pengurus-placeholder";
import { OrgChart } from "@/components/governance/OrgChart";
import { OrgChartMobile } from "@/components/governance/OrgChartMobile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengurus",
  description: "Struktur kepengurisan keluarga besar Wirjodihardjo.",
};

export default async function PengurusPage() {
  const now = new Date();
  const data = await getGovernanceData(now, prisma);

  // Halaman ini publik. Saat data kepengurusan belum diisi, getGovernanceData
  // mengembalikan kerangka placeholder (bukan null). Deteksi via nama khas
  // placeholder supaya ajakan pengisian muncul (O2): rute tujuan
  // /admin/pengurus akan mengarahkan pengunjung yang belum masuk ke /login.
  const strukturKosong =
    data.structure === null ||
    data.structure.name === PENGURUS_PLACEHOLDER_NAME;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
          Kepengurusan
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
          Struktur Pengurus
        </h1>
      </div>

      {strukturKosong && (
        <div className="mx-auto mb-10 max-w-2xl rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-6 py-8 text-center">
          <h2 className="font-display text-lg font-semibold text-forest">
            Belum ada data kepengurusan
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Susunan pengurus keluarga besar sedang dilengkapi. Anggota yang
            ditunjuk dapat mengisi data ini lewat halaman pengelolaan.
          </p>
          <Link
            href="/admin/pengurus"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Ajukan Pengisian
          </Link>
        </div>
      )}

      <OrgChart data={data} />
      <OrgChartMobile data={data} />
    </div>
  );
}
