-- =====================================================================
-- anonymize.sql
-- ---------------------------------------------------------------------
-- OPTIONAL. Runs only when sync.sh is invoked with --anonymize.
-- Scrubs PII from the local copy so you can share dev screenshots,
-- let contractors see the DB, or reset when you're done testing.
--
-- Deterministic: every user gets the same pseudonym across re-syncs so
-- you can still trace specific rows through your tests. The hash is
-- derived from the user's id (a uuid), so each account → one stable alias.
-- =====================================================================

-- Users: name → "User ABC123", email → "user-abc123@example.test",
--        department → generic, image → null.
UPDATE users SET
  name = 'User ' || UPPER(SUBSTRING(md5(id::text), 1, 6)),
  email = 'user-' || LOWER(SUBSTRING(md5(id::text), 1, 6)) || '@example.test',
  department = CASE
    WHEN md5(id::text) LIKE '0%' THEN 'Engineering'
    WHEN md5(id::text) LIKE '1%' THEN 'Product'
    WHEN md5(id::text) LIKE '2%' THEN 'Design'
    WHEN md5(id::text) LIKE '3%' THEN 'Data'
    WHEN md5(id::text) LIKE '4%' THEN 'Marketing'
    WHEN md5(id::text) LIKE '5%' THEN 'Operations'
    ELSE 'Other'
  END,
  image = NULL
WHERE email NOT IN (
  -- Keep the platform-admin seed accounts recognizable so you can still
  -- log in during testing.
  'shantanu@teamlease.com',
  'jaideep.k@teamlease.com',
  'anmol.mathur@teamlease.com'
);

-- Teams: name → "Team A1B2" (hash of team id). Keeps team count + track
-- distribution realistic.
UPDATE teams SET
  name = 'Team ' || UPPER(SUBSTRING(md5(id::text), 1, 4));

-- Submissions: strip URLs and prose so you can't see what real teams built.
UPDATE submissions SET
  github_url              = 'https://example.test/redacted',
  demo_url                = 'https://example.test/redacted',
  submission_description  = '[redacted]',
  ai_prompts_used         = '[redacted]',
  ai_tools_utilized       = '[redacted]',
  ai_screenshots          = ARRAY[]::text[];

-- Announcements: keep title lengths but scrub the body.
UPDATE announcements SET
  title = 'Announcement ' || UPPER(SUBSTRING(md5(id::text), 1, 4)),
  body  = '[redacted]';

-- Team pitches: obliterate freeform bio + media refs.
UPDATE team_pitches SET
  title = 'Pitch',
  bio_markdown = '[redacted]',
  hero_media_url = NULL,
  video_url = NULL,
  image_urls = NULL;

-- Media assets: URLs likely point at prod S3 and we don't want hot-links.
UPDATE media_assets SET
  url = 'https://example.test/redacted',
  bucket = NULL,
  object_key = NULL;

-- Notifications: clear titles/bodies/action URLs.
UPDATE notifications SET
  title = 'Notification',
  body = NULL,
  action_url = NULL;

-- Certificate templates: overwrite copy that may include contest branding.
UPDATE certificate_templates SET
  event_name   = 'Sample Event',
  footer_text  = NULL,
  signature_name  = 'Sample Signatory',
  signature_title = 'Sample Title';
