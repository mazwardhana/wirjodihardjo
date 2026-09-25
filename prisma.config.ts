import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // Fallback hanya untuk perintah yang tidak menyentuh koneksi (mis. generate
    // saat build Docker). Koneksi runtime selalu memakai DATABASE_URL asli.
    url:
      process.env.DATABASE_URL ??
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
  migrations: {
    seed: 'npx tsx ./prisma/seed.ts',
  },
})