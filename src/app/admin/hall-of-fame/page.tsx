import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HallOfFameList } from "@/components/admin/HallOfFameList";

export default async function AdminHallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; status?: string }>;
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
  const categoryFilter = sp.kategori?.trim() ?? "";
  const statusFilter = sp.status?.trim() ?? "all";

  const where: Record<string, unknown> = {};
  if (categoryFilter) where.category = categoryFilter;
  if (statusFilter === "published") where.isPublished = true;
  else if (statusFilter === "draft") where.isPublished = false;

  const entries = await prisma.hallOfFameEntry.findMany({
    where: where as any,
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

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">Kelola Hall of Fame</h1>
          <p className="mt-1 text-sm text-muted">{total} entri tercatat</p>
        </div>
        <Link
          href="/admin/hall-of-fame/baru"
          className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Tambah Entri
        </Link>
      </div>

      <HallOfFameList
        entries={entries.map((e) => ({
          id: e.id,
          category: e.category,
          title: e.title,
          description: e.description,
          year: e.year,
          photoUrl: e.photoUrl,
          entryType: e.entryType as "ACHIEVEMENT" | "IN_MEMORIAM",
          isPublished: e.isPublished,
          person: {
            id: e.person.id,
            fullName: e.person.fullName,
            photoUrl: e.person.photoUrl,
          },
        }))}
        categories={categories}
        filters={{ category: categoryFilter, status: statusFilter }}
        total={total}
      />
    </div>
  );
}