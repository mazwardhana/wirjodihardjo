-- Task D2: tempat wafat pada profil anggota.
-- Additive saja: kolom nullable, tanpa drop/alter kolom lain.

ALTER TABLE "Person" ADD COLUMN "deathPlace" TEXT;
