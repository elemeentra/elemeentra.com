-- 010 — reviews.featured
-- The admin Reviews module needs a `featured` flag. The app now adds this
-- column automatically the first time it is missing, so running this file is
-- optional — it is here for databases where the app user has no ALTER rights.
--
-- MariaDB (Hostinger):
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS featured TINYINT(1) NOT NULL DEFAULT 0;
-- MySQL 8 does not support IF NOT EXISTS for columns; use this instead (and skip the line above):
-- ALTER TABLE reviews ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0;
