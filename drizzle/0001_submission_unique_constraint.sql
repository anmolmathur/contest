-- Add updated_at column to submissions table
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

-- Add unique constraint on team_id and phase
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_phase_unique" UNIQUE("team_id", "phase");

