CREATE TYPE "public"."contest_status" AS ENUM('draft', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "contest_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"participant_role" varchar(100),
	"team_id" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "contest_users_contest_id_user_id_unique" UNIQUE("contest_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"status" "contest_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"hero_title" text,
	"hero_subtitle" text,
	"hero_cta_text" varchar(255),
	"banner_image_url" varchar(500),
	"rules_content" text,
	"eligibility_rules" text,
	"team_structure_rules" text,
	"deliverable_rules" text,
	"scoring_criteria" jsonb,
	"phase_config" jsonb,
	"prizes" jsonb,
	"role_config" jsonb,
	"max_teams" integer DEFAULT 50 NOT NULL,
	"max_approved_teams" integer DEFAULT 10 NOT NULL,
	"max_team_members" integer DEFAULT 7 NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_name_unique";--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "ai_usage_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "business_impact_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "ux_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "innovation_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "execution_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "track" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_templates" ADD COLUMN "contest_id" uuid;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "criteria_scores" jsonb;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "contest_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "track_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "global_role" varchar(50) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "contest_users" ADD CONSTRAINT "contest_users_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_users" ADD CONSTRAINT "contest_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;