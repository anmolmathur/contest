CREATE TABLE "certificate_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"title_text" varchar(255) DEFAULT 'Certificate of Achievement' NOT NULL,
	"subtitle_text" varchar(500) DEFAULT 'This certificate is awarded to' NOT NULL,
	"event_name" varchar(255) DEFAULT 'AI Vibe Coding Challenge 2024' NOT NULL,
	"footer_text" text,
	"signature_name" varchar(255),
	"signature_title" varchar(255),
	"primary_logo_url" varchar(500),
	"secondary_logo_url" varchar(500),
	"primary_color" varchar(7) DEFAULT '#7c3aed' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#2563eb' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "submission_description" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "leader_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_phase_unique" UNIQUE("team_id","phase");