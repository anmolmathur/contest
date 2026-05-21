-- =====================================================================
-- post-process.sql
-- ---------------------------------------------------------------------
-- Runs inside the same transaction as the dump import. Its job: clean up
-- the state we end up in when prod has the OLD schema but local has the
-- NEW v2 schema.
--
-- Concretely:
--   1. Every contest needs exactly one `is_default=true` row for legacy
--      routes to resolve a tenant. If prod doesn't have that column at
--      all, every local row defaults to `false` after import and the
--      legacy /dashboard etc. break.
--   2. Platform admins (globalRole='platform_admin') are no longer auto-
--      granted contest_users rows under the v2 RBAC. The legacy hackathon
--      judges need to be explicitly seeded so they can still access the
--      legacy /judging UI after a sync.
--   3. Sensible visibility defaults on completed contests so the public
--      results page surfaces them.
-- =====================================================================

-- 1. Elect a default contest if none is flagged.
--    Priority: existing default → oldest active → oldest overall.
DO $$
DECLARE
  chosen_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM contests WHERE is_default = true) THEN
    RETURN;
  END IF;

  SELECT id INTO chosen_id
  FROM contests
  WHERE status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF chosen_id IS NULL THEN
    SELECT id INTO chosen_id
    FROM contests
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF chosen_id IS NOT NULL THEN
    UPDATE contests SET is_default = true WHERE id = chosen_id;
    RAISE NOTICE 'Flagged contest % as default', chosen_id;
  END IF;
END $$;

-- 2. Backfill the legacy JUDGE_EMAILS users as contest_users rows on the
--    default contest so /dashboard, /admin, /judging keep working.
--    Idempotent: only inserts when not already present.
INSERT INTO contest_users (contest_id, user_id, role)
SELECT c.id, u.id, 'judge'
FROM contests c
CROSS JOIN users u
WHERE c.is_default = true
  AND u.email IN (
    'shantanu@teamlease.com',
    'jaideep.k@teamlease.com',
    'anmol.mathur@teamlease.com'
  )
  AND NOT EXISTS (
    SELECT 1 FROM contest_users cu
    WHERE cu.contest_id = c.id AND cu.user_id = u.id
  );

-- 3. Make sure completed contests are publicly visible so the results
--    showcase actually has something to show.
UPDATE contests
SET visibility = 'public'
WHERE visibility IS NULL
   OR (status IN ('completed', 'archived') AND visibility = 'private');

-- 4. Sanity: ensure globalRole is set on every user row (old prod schemas
--    may have left it null).
UPDATE users SET global_role = 'user' WHERE global_role IS NULL;

-- 5. If the dump is from a PG that had different default values for new
--    columns, normalize anything obviously wrong. Add more pinned fixes
--    here as schema evolves.
UPDATE contests SET max_teams          = 50  WHERE max_teams          IS NULL OR max_teams          = 0;
UPDATE contests SET max_approved_teams = 10  WHERE max_approved_teams IS NULL OR max_approved_teams = 0;
UPDATE contests SET max_team_members   = 7   WHERE max_team_members   IS NULL OR max_team_members   = 0;
