import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getGovernanceData } from "@/lib/governance";
import { OrgChart } from "@/components/governance/OrgChart";
import { OrgChartMobile } from "@/components/governance/OrgChartMobile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengurus",
  description: "Struktur kepengurusan keluarga besar Wirjodihardjo.",
};

export default async function PengurusPage() {
  const data = await getGovernanceData(new Date(), prisma);

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

      <OrgChart data={data} />
      <OrgChartMobile data={data} />
    </div>
  );
}
