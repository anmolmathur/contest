-- 0011: (1) team_members — lets one person sit on several teams in Ideathon
-- contests; contest_users.team_id stays their active team.
-- (2) Repair memberships that only landed in the legacy users.team_id column:
-- a platform admin with no contest_users row who created a team was shown as
-- leader in the admin panel but saw "not part of any team" on the dashboard.
-- Additive + idempotent; safe to re-run.
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contest_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "team_members_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE,
  CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE,
  CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "team_members_team_id_user_id_unique" UNIQUE ("team_id", "user_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_contest_user_idx" ON "team_members" ("contest_id", "user_id");--> statement-breakpoint

-- Repair: user on a team (users.team_id) but no contest_users row in that contest.
INSERT INTO "contest_users" ("contest_id", "user_id", "role", "team_id")
SELECT t."contest_id", u."id", 'participant', t."id"
FROM "users" u
JOIN "teams" t ON t."id" = u."team_id"
WHERE t."contest_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "contest_users" cu
    WHERE cu."contest_id" = t."contest_id" AND cu."user_id" = u."id"
  )
ON CONFLICT ("contest_id", "user_id") DO NOTHING;--> statement-breakpoint

-- Repair: contest_users row exists but lost its team while users.team_id kept it.
UPDATE "contest_users" cu
SET "team_id" = u."team_id"
FROM "users" u
JOIN "teams" t ON t."id" = u."team_id"
WHERE cu."user_id" = u."id"
  AND cu."contest_id" = t."contest_id"
  AND cu."team_id" IS NULL
  AND cu."role" = 'participant';--> statement-breakpoint

-- Seed team_members for existing Ideathon teams from current memberships.
INSERT INTO "team_members" ("contest_id", "team_id", "user_id")
SELECT cu."contest_id", cu."team_id", cu."user_id"
FROM "contest_users" cu
JOIN "contests" c ON c."id" = cu."contest_id"
JOIN "teams" t ON t."id" = cu."team_id"
WHERE c."contest_type" = 'ideathon'
  AND cu."role" = 'participant'
ON CONFLICT ("team_id", "user_id") DO NOTHING;
