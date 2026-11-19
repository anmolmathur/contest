-- 0012: (1) contest_users.member_identifier — optional per-contest ID a
-- participant gives so organisers can tell people apart (Enrollment Number
-- for a university contest, Employee ID for an enterprise one). The label is
-- contests.settings.memberIdLabel.
-- (2) tracks.image_url — optional custom cover image per track/category; when
-- empty the landing page draws built-in artwork matched to the track's theme.
-- Additive + idempotent; safe to re-run.
ALTER TABLE "contest_users" ADD COLUMN IF NOT EXISTS "member_identifier" varchar(100);--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "image_url" varchar(500);
