-- 0009: Ideathon contest type — Problem Bank, gate-stage decisions,
-- validated impact metrics, multi-role participants, category awards.
-- Additive + idempotent; safe to re-run.
ALTER TABLE "contests" ADD COLUMN IF NOT EXISTS "awards" jsonb;--> statement-breakpoint
ALTER TABLE "contest_users" ADD COLUMN IF NOT EXISTS "extra_roles" jsonb;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "problem_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "solution_paths" jsonb;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "problem_statements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contest_id" uuid NOT NULL,
  "track_id" uuid,
  "title" varchar(255) NOT NULL,
  "description" text,
  "owner_department" varchar(255),
  "sponsor" varchar(255),
  "metric_template" jsonb,
  "max_teams" integer DEFAULT 1 NOT NULL,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "proposed_by_team_id" uuid,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stage_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contest_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "phase" integer NOT NULL,
  "decision" varchar(20) NOT NULL,
  "conditions" text,
  "decided_by" uuid,
  "decided_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "impact_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contest_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "unit" varchar(50),
  "direction" varchar(10) DEFAULT 'decrease' NOT NULL,
  "category" varchar(20) DEFAULT 'time' NOT NULL,
  "source_system" varchar(255),
  "method" text,
  "baseline_value" double precision,
  "baseline_period" varchar(120),
  "baseline_evidence" jsonb,
  "baseline_status" varchar(20) DEFAULT 'draft' NOT NULL,
  "baseline_validator_id" uuid,
  "baseline_note" text,
  "target_value" double precision,
  "actual_value" double precision,
  "actual_period" varchar(120),
  "actual_evidence" jsonb,
  "actual_status" varchar(20) DEFAULT 'draft' NOT NULL,
  "actual_validator_id" uuid,
  "actual_note" text,
  "realised_value_inr" integer,
  "recurring_annual_value_inr" integer,
  "recurring_years" integer DEFAULT 1,
  "valuation_basis" text,
  "finance_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "finance_validator_id" uuid,
  "finance_note" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "problem_statements" ADD CONSTRAINT "problem_statements_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "problem_statements" ADD CONSTRAINT "problem_statements_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "problem_statements" ADD CONSTRAINT "problem_statements_proposed_by_team_id_teams_id_fk" FOREIGN KEY ("proposed_by_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stage_decisions" ADD CONSTRAINT "stage_decisions_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stage_decisions" ADD CONSTRAINT "stage_decisions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stage_decisions" ADD CONSTRAINT "stage_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stage_decisions" ADD CONSTRAINT "stage_decisions_team_id_phase_unique" UNIQUE ("team_id", "phase");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_baseline_validator_id_users_id_fk" FOREIGN KEY ("baseline_validator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_actual_validator_id_users_id_fk" FOREIGN KEY ("actual_validator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_finance_validator_id_users_id_fk" FOREIGN KEY ("finance_validator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
