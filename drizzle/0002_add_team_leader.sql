-- Add leader_id column to teams table
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "leader_id" uuid;

-- Set leader_id to created_by for existing teams (creator becomes default leader)
UPDATE "teams" SET "leader_id" = "created_by" WHERE "leader_id" IS NULL;

