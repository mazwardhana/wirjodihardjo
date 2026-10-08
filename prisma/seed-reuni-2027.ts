import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

/**
 * Buat (atau perbarui) event reuni tujuan pendaftaran form registrasi.
 * Idempoten: aman dijalankan berulang. Jadwal sudah tetap (13 Maret 2027),
 * jadi tanggal dan lokasi diisi di sini supaya lingkungan baru ikut benar.
 */
export const REUNI_SLUG = 'reuni-wirjodihardjo-2-0-blitar-2027'
export const REUNI_TITLE = 'Reuni Wirjodihardjo 2.0 - Blitar, 2027'
export const REUNI_LOCATION = "Lesehan d'Dadoz, Blitar"
export const REUNI_START_AT = new Date('2027-03-13T00:00:00+07:00')
export const REUNI_END_AT = null
export const REUNI_DESCRIPTION =
  "Reuni Keluarga Besar Wirjodihardjo di Lesehan d'Dadoz, Blitar pada Sabtu, 13 Maret 2027. Jam pelaksanaan akan diinformasikan kemudian."

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
        description: REUNI_DESCRIPTION,
        startAt: REUNI_START_AT,
        endAt: REUNI_END_AT,
        locationName: REUNI_LOCATION,
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
      description: REUNI_DESCRIPTION,
      startAt: REUNI_START_AT,
      endAt: REUNI_END_AT,
      locationName: REUNI_LOCATION,
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
