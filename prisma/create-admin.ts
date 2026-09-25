import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@wirjodihardjo.id";
  const password = process.env.ADMIN_PASSWORD ?? "Wirjodihardjo2026!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ️  Admin ${email} sudah ada.`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);

  // Person untuk admin (dibuat terpisah agar tidak terhubung ke silsilah)
  const person = await prisma.person.create({
    data: {
      fullName: "Administrator Keluarga",
      gender: "OTHER",
      isPublicProfile: false,
      bio: "Pengelola sistem website keluarga.",
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      role: "SUPER_ADMIN",
      isVerified: true,
      isActive: true,
      personId: person.id,
    },
  });

  console.log("✅ Super Admin dibuat:");
  console.log(`   Email   : ${user.email}`);
  console.log(`   Sandi   : ${password}`);
  console.log("   Segera ganti sandi setelah login pertama.");
}

main()
  .catch((e) => {
    console.error("❌ Gagal membuat admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });