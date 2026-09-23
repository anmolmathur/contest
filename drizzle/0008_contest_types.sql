-- 0008: contest types (hackathon | business_symposium), generic submission
-- fields, configurable scoring scale, jury feedback, live finale, agenda,
-- internal/external users. Additive + idempotent; safe to re-run.
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "contest_type" varchar(30) DEFAULT 'hackathon' NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "submission_fields" jsonb;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "scoring_scale" jsonb;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "terminology" jsonb;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "settings" jsonb;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "agenda" jsonb;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "speakers" jsonb;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "live_state" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_type" varchar(20) DEFAULT 'external' NOT NULL;--> statement-breakpoint
UPDATE "users" SET "user_type" = 'internal' WHERE lower(split_part("email", '@', 2)) IN ('teamlease.com', 'teamleaseedtech.com');--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "github_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "demo_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "ai_prompts_used" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "ai_tools_utilized" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "ai_screenshots" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "fields" jsonb;--> statement-breakpoint
-- Backfill: legacy hackathon columns -> generic fields (keys = camelCase column names)
UPDATE "submissions" SET "fields" = jsonb_strip_nulls(jsonb_build_object(
  'githubUrl', "github_url",
  'demoUrl', "demo_url",
  'submissionDescription', "submission_description",
  'aiPromptsUsed', "ai_prompts_used",
  'aiToolsUtilized', "ai_tools_utilized",
  'aiScreenshots', to_jsonb("ai_screenshots")
)) WHERE "fields" IS NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "feedback" text;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "private_note" text;--> statement-breakpoint
ALTER TABLE "certificate_templates" ALTER COLUMN "event_name" SET DEFAULT 'Innovation Challenge';
