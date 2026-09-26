import { prisma } from "@/lib/prisma";

/**
 * Generate unique slug from article title.
 * If collision, appends numeric suffix: slug-2, slug-3, etc.
 */
export async function generateArticleSlug(title: string, excludeId?: string): Promise<string> {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);

  if (!base) return `artikel-${Date.now()}`;

  let slug = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.article.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return slug;
    }

    suffix++;
    slug = `${base}-${suffix}`;
  }
}
