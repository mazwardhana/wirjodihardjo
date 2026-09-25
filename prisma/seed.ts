import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding GenerationLabels...')

  const labels = [
    { level: 0, jawa: 'Leluhur / Pendiri', indonesia: 'Pendiri Keluarga' },
    { level: 1, jawa: 'Anak', indonesia: 'Anak' },
    { level: 2, jawa: 'Putu / Wayah', indonesia: 'Cucu' },
    { level: 3, jawa: 'Buyut', indonesia: 'Cicit' },
    { level: 4, jawa: 'Canggah', indonesia: 'Piut' },
    { level: 5, jawa: 'Wareng', indonesia: 'Anggas' },
    { level: 6, jawa: 'Udheg-udheg', indonesia: null },
    { level: 7, jawa: 'Gantung siwur', indonesia: null },
    { level: 8, jawa: 'Gropak senthe', indonesia: null },
    { level: 9, jawa: 'Debog bosok', indonesia: null },
    { level: 10, jawa: 'Galih asem', indonesia: null },
    { level: 11, jawa: 'Gropak waton', indonesia: null },
    { level: 12, jawa: 'Cendheng', indonesia: null },
    { level: 13, jawa: 'Giyeng', indonesia: null },
    { level: 14, jawa: 'Cumpleng', indonesia: null },
    { level: 15, jawa: 'Ampleng', indonesia: null },
    { level: 16, jawa: 'Menyaman', indonesia: null },
    { level: 17, jawa: 'Menya-menya', indonesia: null },
    { level: 18, jawa: 'Trah tumerah', indonesia: null },
  ]

  for (const label of labels) {
    await prisma.generationLabel.upsert({
      where: { level: label.level },
      update: { jawa: label.jawa, indonesia: label.indonesia },
      create: label,
    })
  }

  console.log('✅ GenerationLabels seeded.')

  // Cek apakah pasangan pendiri sudah ada
  const existingFounder = await prisma.person.findFirst({
    where: { fullName: 'Tn. Wirjodihardjo' },
  })
  if (existingFounder) {
    console.log('⏭️  Founder already exists, skipping seed.')
    return
  }

  console.log('👥 Seeding founding family...')

  // Pasangan pendiri — generationLevel = 0
  const founderHusband = await prisma.person.create({
    data: {
      fullName: 'Tn. Wirjodihardjo',
      gender: 'MALE',
      generationLevel: 0,
      bio: 'Pendiri keluarga besar Wirjodihardjo.',
    },
  })

  const founderWife = await prisma.person.create({
    data: {
      fullName: 'Ny. Wirjodihardjo',
      gender: 'FEMALE',
      generationLevel: 0,
      bio: 'Ibu dari keluarga besar Wirjodihardjo.',
    },
  })

  // Relasi pasangan
  await prisma.personPartner.create({
    data: {
      partnerAId: founderHusband.id,
      partnerBId: founderWife.id,
      status: 'MARRIED',
    },
  })

  console.log('✅ Founding couple created.')

  // 10 anak — generationLevel = 1
  const childNames = [
    'Raden Aria Wirjodihardjo',
    'Raden Ayu Wirjodihardjo',
    'Raden Bagus Wirjodihardjo',
    'Raden Mas Wirjodihardjo',
    'Raden Tumenggung Wirjodihardjo',
    'Raden Nyi Wirjodihardjo',
    'Raden Panji Wirjodihardjo',
    'Raden Harya Wirjodihardjo',
    'Raden Nyai Wirjodihardjo',
    'Raden Sasra Wirjodihardjo',
  ]

  for (let i = 0; i < childNames.length; i++) {
    const child = await prisma.person.create({
      data: {
        fullName: childNames[i],
        gender: i % 2 === 0 ? 'MALE' : 'FEMALE', // alternating for realistic demo
        generationLevel: 1,
        bio: `Anak ke-${i + 1} dari pasangan Tn. & Ny. Wirjodihardjo.`,
      },
    })

    // Relasi ke ayah
    await prisma.personChild.create({
      data: {
        parentId: founderHusband.id,
        childId: child.id,
        parentRole: 'FATHER',
      },
    })

    // Relasi ke ibu
    await prisma.personChild.create({
      data: {
        parentId: founderWife.id,
        childId: child.id,
        parentRole: 'MOTHER',
      },
    })

    // Buat Branch
    const slug = `cabang-${(i + 1).toString().padStart(2, '0')}`
    await prisma.branch.create({
      data: {
        name: `Cabang ke-${i + 1}`,
        slug,
        description: `Garis keturunan dari ${childNames[i]}`,
        orderIndex: i,
        rootPersonId: child.id,
      },
    })
  }

  console.log('✅ 10 children and branches seeded.')
  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })