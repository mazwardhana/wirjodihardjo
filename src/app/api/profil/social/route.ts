import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  platformId: z.string().uuid().optional(),
  platform: z.string().min(1).max(100).optional(),
  url: z.string().max(500).optional(),
  username: z.string().max(100).optional(),
});

// Bentuk kanonik untuk platform yang dikenal. Platform tak dikenal hanya
// menerima URL lengkap dan tidak menebak alamat.
const PLATFORM_RULES: Record<string, { base: string; handlePrefix: string }> = {
  instagram: { base: "https://instagram.com", handlePrefix: "" },
  facebook: { base: "https://facebook.com", handlePrefix: "" },
  linkedin: { base: "https://linkedin.com/in", handlePrefix: "" },
  tiktok: { base: "https://tiktok.com", handlePrefix: "@" },
};

const PLATFORM_BASE: Record<string, string> = {
  instagram: "https://instagram.com",
  facebook: "https://facebook.com",
  linkedin: "https://linkedin.com",
  tiktok: "https://tiktok.com",
};

/** Hanya http(s) yang boleh disimpan sebagai tautan sosial. */
function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractHandle(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  let value = raw;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const parts = url.pathname.split("/").filter(Boolean);
    value = parts.length > 0 ? parts[parts.length - 1] : url.hostname.replace(/^www\./, "");
  } catch {
    // Bukan URL, pakai apa adanya.
  }
  return value.replace(/^@/, "").trim();
}

function buildSocialUrl(platformName: string, input: string) {
  const rule = PLATFORM_RULES[platformName.toLowerCase()];
  const handle = extractHandle(input);
  if (!rule) {
    return { url: /^https?:\/\//i.test(input.trim()) ? input.trim() : "", username: null };
  }
  if (!handle) return { url: "", username: null };
  return { url: `${rule.base}/${rule.handlePrefix}${handle}`, username: handle };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  const socialLinks = await prisma.socialLink.findMany({
    where: { personId: user.personId },
    include: {
      platform: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ socialLinks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  // Jalur lama: platformId + URL lengkap.
  if (parsed.data.platformId) {
    if (!parsed.data.url || !isHttpUrl(parsed.data.url)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const platform = await prisma.socialPlatform.findUnique({
      where: { id: parsed.data.platformId },
    });
    if (!platform) {
      return NextResponse.json({ error: "Platform tidak ditemukan" }, { status: 400 });
    }

    const socialLink = await prisma.socialLink.create({
      data: {
        personId: user.personId,
        platformId: parsed.data.platformId,
        url: parsed.data.url!,
        username: parsed.data.username ?? null,
      },
      include: {
        platform: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_SOCIAL_LINK",
        entityType: "SocialLink",
        entityId: socialLink.id,
        actorUserId: session.user.id,
      },
    });

    return NextResponse.json({ socialLink }, { status: 201 });
  }

  // Jalur baru: nama platform di-get-or-create, terima username atau URL.
  if (!parsed.data.platform) {
    return NextResponse.json({ error: "Platform wajib dipilih" }, { status: 400 });
  }
  const raw = (parsed.data.url ?? parsed.data.username ?? "").trim();
  const built = buildSocialUrl(parsed.data.platform, raw);
  if (!built.url || !isHttpUrl(built.url)) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const platform = await prisma.socialPlatform.upsert({
    where: { name: parsed.data.platform },
    update: {},
    create: {
      name: parsed.data.platform,
      baseUrl: PLATFORM_BASE[parsed.data.platform.toLowerCase()] ?? null,
    },
  });

  const existing = await prisma.socialLink.findFirst({
    where: { personId: user.personId, platformId: platform.id },
  });

  const socialLink = existing
    ? await prisma.socialLink.update({
        where: { id: existing.id },
        data: { url: built.url, username: built.username },
        include: { platform: true },
      })
    : await prisma.socialLink.create({
        data: {
          personId: user.personId,
          platformId: platform.id,
          url: built.url,
          username: built.username,
        },
        include: { platform: true },
      });

  await prisma.auditLog.create({
    data: {
      action: existing ? "UPDATE_SOCIAL_LINK" : "CREATE_SOCIAL_LINK",
      entityType: "SocialLink",
      entityId: socialLink.id,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ socialLink }, { status: 201 });
}
