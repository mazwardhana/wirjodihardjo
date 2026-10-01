-- Isi iconName untuk platform sosial yang dikenal.
-- Idempoten: hanya mengisi baris yang iconName-nya masih kosong.

UPDATE "SocialPlatform" SET "iconName"='instagram' WHERE lower(name)='instagram' AND "iconName" IS NULL;
UPDATE "SocialPlatform" SET "iconName"='facebook' WHERE lower(name)='facebook' AND "iconName" IS NULL;
UPDATE "SocialPlatform" SET "iconName"='linkedin' WHERE lower(name)='linkedin' AND "iconName" IS NULL;
UPDATE "SocialPlatform" SET "iconName"='tiktok' WHERE lower(name)='tiktok' AND "iconName" IS NULL;
