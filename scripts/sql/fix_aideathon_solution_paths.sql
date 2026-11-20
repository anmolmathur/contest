-- Restore TLE AIdeathon 2026 submission-field settings lost by an admin save.
--
-- The admin contest editor used to keep `options` only for single-choice
-- `select` fields and dropped `requiredForPaths`. Saving the contest therefore
-- emptied the "Solution Paths" chips (a required field, so no team could
-- submit their Idea Pitch) and made the path-specific fields optional.
--
-- SAFE TO RE-RUN: only touches the four fields below, by key.
-- Run against the prod DB:  psql "$DATABASE_URL" -f scripts/sql/fix_aideathon_solution_paths.sql

BEGIN;

UPDATE contests c
SET submission_fields = (
  SELECT jsonb_agg(
    CASE f->>'key'
      WHEN 'solutionPaths'    THEN f || '{"options": ["Process Re-engineering", "System Change", "Agent Build", "Tool Purchase"]}'::jsonb
      WHEN 'systemChangeSpec' THEN f || '{"requiredForPaths": ["System Change"]}'::jsonb
      WHEN 'agentCharter'     THEN f || '{"requiredForPaths": ["Agent Build"]}'::jsonb
      WHEN 'toolBusinessCase' THEN f || '{"requiredForPaths": ["Tool Purchase"]}'::jsonb
      ELSE f
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(c.submission_fields) WITH ORDINALITY AS t(f, ord)
),
updated_at = now()
WHERE c.slug = 'tle-aideathon-2026';

-- Check: should list the 4 options and 3 path rules.
SELECT f->>'key' AS key, f->'options' AS options, f->'requiredForPaths' AS required_for_paths
FROM contests c, jsonb_array_elements(c.submission_fields) f
WHERE c.slug = 'tle-aideathon-2026'
  AND f->>'key' IN ('solutionPaths', 'systemChangeSpec', 'agentCharter', 'toolBusinessCase');

COMMIT;
