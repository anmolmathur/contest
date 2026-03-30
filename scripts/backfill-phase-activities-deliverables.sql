-- Migration Script: Backfill Activities & Deliverables for existing contests
--
-- This script updates the phase_config JSONB column for all existing contests,
-- adding details (Activities) and deliverables arrays to phases that are missing them.
-- It preserves existing phase fields (name, dates, maxPoints, description) and only
-- adds details/deliverables based on matching phase names.
--
-- Usage (production):
--   psql -U <user> -d <database> -f scripts/backfill-phase-activities-deliverables.sql
--
-- Or via Docker:
--   docker exec -i <postgres_container> psql -U <user> -d <database> < scripts/backfill-phase-activities-deliverables.sql

BEGIN;

-- Define the default activities and deliverables per phase name
-- This uses a CTE to map phase names to their default details/deliverables
WITH phase_defaults(phase_name_pattern, default_details, default_deliverables, default_description) AS (
  VALUES
    (
      'Team Formation',
      '["Announcement emailed to all participants","Team formation and role assignments","Final teams published","Track selection completed"]'::jsonb,
      '["Kickoff Workshop: Intro to the Event","Expectations & deliverables overview","Judging process explained","Q&A session"]'::jsonb,
      'Challenge begins! Team formation, nominations, and kickoff workshop.'
    ),
    (
      'Vibe Coding',
      '["Defining the Scope of the Project","Architecture co-design with AI","UI/UX sketching using AI tools","Backend scaffolding via AI code generation","Automated test and documentation generation","Regular stand-ups & async check-ins"]'::jsonb,
      '["Statement of Work (Scope)","Technical plan","Prompt strategy and Examples","Sprint progress update","10-minute checkpoint demo to Mentor + Judges"]'::jsonb,
      'Rapid AI-assisted development sprint with checkpoint demo.'
    ),
    (
      'Mid-Point Review',
      '["Prototype progress evaluation","Alignment check","AI usage evidence review","Roadblocks identification"]'::jsonb,
      '["In Progress Prototype","Sprint progress update","10-minute checkpoint demo to Mentor + Judges","Committee provides actionable feedback"]'::jsonb,
      'Prototype progress review with alignment and feedback.'
    ),
    (
      'Grand Finale',
      '["AI Project Development Completion","Deployment to the Infrastructure"]'::jsonb,
      '["Final Presentation","12 minutes Demo","3 minutes Q&A","2 minutes AI usage showcase"]'::jsonb,
      'Final project completion, deployment, and comprehensive demo.'
    ),
    (
      'Evaluation',
      '["Complete evaluation of all submissions","Final scoring and ranking","Award ceremony for top teams"]'::jsonb,
      '[]'::jsonb,
      'Final evaluation and recognition of top performing teams.'
    )
),
-- For each contest, rebuild the phase_config array with details/deliverables added
updated_configs AS (
  SELECT
    c.id,
    jsonb_agg(
      CASE
        -- If the phase already has non-empty details and deliverables, keep as-is
        WHEN (phase_elem->>'details') IS NOT NULL
             AND jsonb_array_length(COALESCE(phase_elem->'details', '[]'::jsonb)) > 0
        THEN phase_elem
        -- Otherwise, try to match by phase name and add defaults
        ELSE (
          SELECT
            -- Merge: keep all existing fields, add/overwrite details + deliverables + description
            phase_elem
            || jsonb_build_object(
                 'details', COALESCE(pd.default_details, '[]'::jsonb),
                 'deliverables', COALESCE(pd.default_deliverables, '[]'::jsonb)
               )
            || CASE
                 WHEN (phase_elem->>'description') IS NULL OR (phase_elem->>'description') = ''
                 THEN jsonb_build_object('description', COALESCE(pd.default_description, ''))
                 ELSE '{}'::jsonb
               END
          FROM (SELECT 1) AS dummy
          LEFT JOIN phase_defaults pd
            ON phase_elem->>'name' ILIKE '%' || pd.phase_name_pattern || '%'
        )
      END
      ORDER BY (phase_elem->>'phase')::int
    ) AS new_phase_config
  FROM contests c,
       jsonb_array_elements(c.phase_config) AS phase_elem
  WHERE c.phase_config IS NOT NULL
    AND jsonb_typeof(c.phase_config) = 'array'
    AND jsonb_array_length(c.phase_config) > 0
  GROUP BY c.id
)
UPDATE contests
SET phase_config = uc.new_phase_config,
    updated_at = NOW()
FROM updated_configs uc
WHERE contests.id = uc.id;

-- Report what was updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % contest(s) with activities and deliverables data.', updated_count;
END $$;

COMMIT;
