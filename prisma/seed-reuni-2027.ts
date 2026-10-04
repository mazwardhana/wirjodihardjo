import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

/**
 * Buat (atau perbarui) event reuni tujuan pendaftaran form registrasi.
 * Idempoten: aman dijalankan berulang. Tanggal sengaja dikosongkan karena
 * jadwal masih dibahas; kolom startAt nullable agar pendaftaran tetap terbuka.
 */
export const REUNI_SLUG = 'reuni-wirjodihardjo-2-0-blitar-2027'
export const REUNI_TITLE = 'Reuni Wirjodihardjo 2.0 - Blitar, 2027'

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!admin) {
    throw new Error('Tidak ada SUPER_ADMIN aktif untuk mencatat pembuat reuni.')
  }

  const existing = await prisma.reunion.findUnique({ where: { slug: REUNI_SLUG } })
  if (existing) {
    await prisma.reunion.update({
      where: { slug: REUNI_SLUG },
      data: {
        title: REUNI_TITLE,
        description:
          'Reuni Keluarga Besar Wirjodihardjo di Blitar. Tanggal dan waktu pelaksanaan menyusul, masih dalam pembahasan pengurus.',
        locationName: 'Blitar',
        status: 'PUBLISHED',
      },
    })
    console.log('ℹ️  Reuni 2027 sudah ada, diperbarui.')
    return
  }

  const reunion = await prisma.reunion.create({
    data: {
      title: REUNI_TITLE,
      slug: REUNI_SLUG,
      description:
        'Reuni Keluarga Besar Wirjodihardjo di Blitar. Tanggal dan waktu pelaksanaan menyusul, masih dalam pembahasan pengurus.',
      locationName: 'Blitar',
      status: 'PUBLISHED',
      createdByUserId: admin.id,
    },
  })
  console.log(`✅ Reuni dibuat: ${reunion.title} (${reunion.slug})`)
}

main()
  .catch((e) => {
    console.error('❌ Gagal menyiapkan reuni:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
