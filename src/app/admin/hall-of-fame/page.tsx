import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { HallOfFameList } from "@/components/admin/HallOfFameList";
import { Prisma } from "@prisma/client";
import { FilterBar } from "@/components/admin/FilterBar";
import { HallOfFameCreateModal } from "./HallOfFameCreateModal";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminHallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; kategori?: string | string[]; status?: string | string[]; entryType?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const q = first(sp.q).trim();
  const categoryFilter = first(sp.kategori).trim();
  const status = first(sp.status).trim();
  const statusFilter = status === "published" || status === "draft" ? status : "";
  const entryType = first(sp.entryType).trim();
  const entryTypeFilter = entryType === "ACHIEVEMENT" || entryType === "IN_MEMORIAM" ? entryType : undefined;

  const where: Prisma.HallOfFameEntryWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { person: { fullName: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (categoryFilter) where.category = categoryFilter;
  if (statusFilter === "published") where.isPublished = true;
  else if (statusFilter === "draft") where.isPublished = false;
  if (entryTypeFilter) where.entryType = entryTypeFilter;

  const entries = await prisma.hallOfFameEntry.findMany({
    where,
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    include: {
      person: { select: { id: true, fullName: true, photoUrl: true } },
    },
  });

  const allCategories = await prisma.hallOfFameEntry.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categories = allCategories.map((c) => c.category).filter(Boolean);

  const total = await prisma.hallOfFameEntry.count();
  const filtering = q !== "" || categoryFilter !== "" || statusFilter !== "" || entryTypeFilter !== undefined;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">Kelola Hall of Fame</h1>
          <p className="mt-1 text-sm text-muted">{total} entri tercatat</p>
        </div>
        <div className="flex items-center gap-3">
          <HallOfFameCreateModal />
        </div>
      </div>

      <div className="mt-6">
        <FilterBar
          config={{
            search: {
              placeholder: "Cari judul, deskripsi, atau nama anggota...",
              param: "q",
            },
            filters: [
              {
                param: "kategori",
                label: "Kategori",
                options: categories.map((c) => ({ value: c, label: c })),
              },
              {
                param: "status",
                label: "Status",
                options: [
                  { value: "published", label: "Terbit" },
                  { value: "draft", label: "Draf" },
                ],
              },
              {
                param: "entryType",
                label: "Jenis",
                options: [
                  { value: "ACHIEVEMENT", label: "Prestasi" },
                  { value: "IN_MEMORIAM", label: "In Memoriam" },
                ],
              },
            ],
          }}
        />
      </div>

      {entries.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-wood/25 bg-cream px-4 py-12 text-center text-muted">
          {filtering
            ? "Tidak ada entri yang cocok dengan filter."
            : "Belum ada entri. Tambahkan entri pertama."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-wood/15">
          <HallOfFameList
            entries={entries.map((e) => ({
              id: e.id,
              category: e.category,
              title: e.title,
              description: e.description,
              year: e.year,
              photoUrl: e.photoUrl,
              entryType: e.entryType,
              isPublished: e.isPublished,
              person: {
                id: e.person.id,
                fullName: e.person.fullName,
                photoUrl: e.person.photoUrl,
              },
            }))}
            total={total}
          />
        </div>
      )}
    </div>
  );
}