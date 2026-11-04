-- Migration 009: blog / comments / contacts parity
-- Run ONCE in phpMyAdmin (SQL tab) on your live database.
--
--  1) posts:            OG title/description + reading time
--  2) comments:         threaded replies (parent_id) and moderation status
--                       (pending / approved / spam / trash)
--  3) contact_messages: trash + stored reply text
--
-- The app detects these columns, so it keeps working (minus the new fields)
-- until this has been run.

-- 1) Posts
ALTER TABLE posts
  ADD COLUMN og_title       VARCHAR(255)      NULL AFTER og_image,
  ADD COLUMN og_description VARCHAR(500)      NULL AFTER og_title,
  ADD COLUMN read_time      SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER og_description;

-- 2) Comments
ALTER TABLE comments
  ADD COLUMN parent_id         INT NULL AFTER comment_text,
  ADD COLUMN moderation_status ENUM('pending','approved','spam','trash') NOT NULL DEFAULT 'pending' AFTER approved,
  ADD INDEX idx_comments_parent_id (parent_id),
  ADD INDEX idx_comments_moderation_status (moderation_status);

-- keep existing comments exactly as they were: approved stays approved
UPDATE comments SET moderation_status = IF(approved = 1, 'approved', 'pending');

-- 3) Contact messages
ALTER TABLE contact_messages
  ADD COLUMN is_trashed    TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN reply_message TEXT       NULL,
  ADD INDEX idx_contact_is_trashed (is_trashed);
