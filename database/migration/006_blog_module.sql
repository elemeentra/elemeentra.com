-- ============================================================
-- Elemeentra Admin Panel — Blog/Posts Module
-- Migration 006: posts, categories, tags, FAQ schema, full SEO
-- Engine: MariaDB (XAMPP local) / MySQL (Hostinger production)
-- ============================================================

-- ------------------------------------------------------------
-- 1. blog_categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_categories (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  slug          VARCHAR(140)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_blog_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. blog_tags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_tags (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)   NOT NULL,
  slug          VARCHAR(100)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_blog_tags_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. blog_posts (core table)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Core content
  title               VARCHAR(255)  NOT NULL,
  slug                VARCHAR(280)  NOT NULL,
  excerpt             VARCHAR(500)  NULL,
  content             LONGTEXT      NOT NULL,               -- sanitized HTML (Tiptap output)
  content_json        LONGTEXT      NULL,                   -- raw Tiptap JSON (for re-editing)
  word_count          INT UNSIGNED  NOT NULL DEFAULT 0,      -- cached, used by SEO scoring

  -- Featured image
  featured_image_id   INT UNSIGNED  NULL,                    -- FK -> media_library.id
  featured_image_alt  VARCHAR(255)  NULL,

  -- Publish state
  status              ENUM('draft','published','scheduled','archived') NOT NULL DEFAULT 'draft',
  published_at        DATETIME      NULL,
  scheduled_at        DATETIME      NULL,

  -- Authorship
  author_id           INT UNSIGNED  NOT NULL,                -- FK -> admin_users.id

  -- SEO (RankMath-style)
  focus_keyword       VARCHAR(160)  NULL,
  seo_title           VARCHAR(60)   NULL,
  meta_description    VARCHAR(160)  NULL,
  canonical_url       VARCHAR(500)  NULL,
  seo_noindex         TINYINT(1)    NOT NULL DEFAULT 0,
  seo_nofollow        TINYINT(1)    NOT NULL DEFAULT 0,
  og_title            VARCHAR(120)  NULL,
  og_description      VARCHAR(200)  NULL,
  seo_score           TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- cached last-computed score (0-100)

  -- FAQ schema (FAQPage JSON-LD) — array of {question, answer}
  faq_schema          JSON          NULL,

  -- Misc / bulk actions support
  is_featured         TINYINT(1)    NOT NULL DEFAULT 0,

  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME      NULL,                    -- soft delete (Trash, WP-style)

  UNIQUE KEY uq_blog_posts_slug (slug),
  KEY idx_blog_posts_status (status),
  KEY idx_blog_posts_author (author_id),
  KEY idx_blog_posts_published_at (published_at),
  KEY idx_blog_posts_deleted_at (deleted_at),
  FULLTEXT KEY ft_blog_posts_search (title, excerpt),

  CONSTRAINT fk_blog_posts_author
    FOREIGN KEY (author_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_blog_posts_featured_image
    FOREIGN KEY (featured_image_id) REFERENCES media_library(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Pivot: blog_post_categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_post_categories (
  post_id       INT UNSIGNED NOT NULL,
  category_id   INT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, category_id),
  CONSTRAINT fk_bpc_post
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpc_category
    FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. Pivot: blog_post_tags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id   INT UNSIGNED NOT NULL,
  tag_id    INT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  CONSTRAINT fk_bpt_post
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpt_tag
    FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. blog_post_revisions (optional but recommended — undo safety)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_post_revisions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id       INT UNSIGNED  NOT NULL,
  content       LONGTEXT      NOT NULL,
  content_json  LONGTEXT      NULL,
  edited_by     INT UNSIGNED  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_revisions_post (post_id),
  CONSTRAINT fk_revisions_post
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
