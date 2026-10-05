-- Registrasi lama dibuat sebelum `ReunionRegistration.personId` ada, jadi
-- `personId`-nya kosong dan peserta itu hanya tertaut lewat `userId`.
-- Effect: `ReunionRegistration.personId` jadi satu-satunya penanda ke orang,
-- dan daftar "tambah peserta" tidak lagi menawarkan orang yang sebenarnya sudah
-- terdaftar. Idempoten: hanya menyentuh baris yang `personId`-nya masih kosong.
UPDATE "ReunionRegistration" rr
SET "personId" = u."personId"
FROM "User" u
WHERE rr."userId" = u."id"
  AND rr."personId" IS NULL;