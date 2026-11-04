-- Migration 008: lightweight page-view tracking table
-- Called from the public Next.js route handler on each page visit.
-- No PII stored — just path + referrer domain + country code.

CREATE TABLE IF NOT EXISTS page_views (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  path         VARCHAR(500)  NOT NULL,
  referrer     VARCHAR(255)  NULL,   -- domain only, e.g. "google.com"
  country_code CHAR(2)       NULL,   -- ISO 3166-1 alpha-2, from CF-IPCountry header
  device       ENUM('desktop','mobile','tablet','unknown') NOT NULL DEFAULT 'unknown',
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pv_path       (path(200)),
  KEY idx_pv_created_at (created_at),
  KEY idx_pv_country    (country_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
