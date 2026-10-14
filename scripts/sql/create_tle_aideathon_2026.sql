-- =============================================================================
-- Create the contest "TLE AIdeathon 2026" (contest type: ideathon)
--
-- Reproduces the configuration approved on the test site
-- (contest.anmolmathur.com/c/tle-aideathon-2026-demo) WITHOUT any demo data:
-- no crews, users, entries, scores or metrics, and no demo banner.
--
-- Creates: 1 contest (status DRAFT), 7 value lenses (tracks), 13 Problem Bank
-- problems, prizes + 6 category awards, roles, rubric, stages, playbooks
-- (built into the app), and the AI/dea/thon wordmark.
--
-- PREREQUISITES
--   * The app build that contains the Ideathon feature is deployed.
--   * Migrations 0008_contest_types.sql and 0009_ideathon.sql have been applied.
--
-- HOW TO RUN (as the application DB user, e.g. against hackathon_db):
--   psql -v ON_ERROR_STOP=1 -v launch_date=2026-11-02 "$DATABASE_URL" -f create_tle_aideathon_2026.sql
--
--   launch_date = Monday of Week 1. All stage dates are derived from it:
--     Stage 1 Idea Pitch   launch .. +4   (pitch on the Friday)
--     Stage 2 Blueprint    +7  .. +11
--     Stage 3 The Build    +14 .. +18
--     Stage 4 Live Run     +21 .. +32
--     Stage 5 The Reveal   +35 .. +39
--   Registration closes launch + 2. Dates can be changed later in Admin → Settings.
--
-- SAFE TO RE-RUN: aborts without changes if a contest with slug
-- 'tle-aideathon-2026' already exists. Everything runs in one transaction.
--
-- AFTER RUNNING: open https://hackathon.teamleaseedtech.com/c/tle-aideathon-2026/admin,
-- review, add Jury and Auditors (Users tab), then set Status = Active.
-- =============================================================================

\if :{?launch_date}
\else
  \echo 'ERROR: pass the launch date, e.g.  -v launch_date=2026-11-02'
  \quit 3
\endif

BEGIN;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM contests WHERE slug = 'tle-aideathon-2026') THEN
    RAISE EXCEPTION 'Contest tle-aideathon-2026 already exists — nothing changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'problem_statements') THEN
    RAISE EXCEPTION 'Migration 0009_ideathon.sql has not been applied yet.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE global_role = 'platform_admin') THEN
    RAISE EXCEPTION 'No platform admin user found to own the contest.';
  END IF;
END
$guard$;

CREATE TEMP TABLE _new_contest ON COMMIT DROP AS
WITH ins AS (
  INSERT INTO contests (
    name, slug, description, status, visibility, is_default, created_by,
    hero_title, hero_subtitle, hero_cta_text, banner_image_url,
    branding_config, faq_config, rules_content,
    eligibility_rules, team_structure_rules, deliverable_rules,
    scoring_criteria, phase_config, prizes, role_config,
    contest_type, submission_fields, scoring_scale, terminology, settings, awards,
    max_teams, max_approved_teams, max_team_members,
    start_date, end_date, registration_deadline
  ) VALUES (
    'TLE AIdeathon 2026',
    'tle-aideathon-2026',
    $t$Cross-functional crews from across TeamLease EdTech fix real business problems and prove the before/after with validated numbers.$t$,
    'draft',
    'public',
    false,
    COALESCE(
      (SELECT id FROM users WHERE lower(email) = 'anmol.mathur@teamlease.com' LIMIT 1),
      (SELECT id FROM users WHERE global_role = 'platform_admin' ORDER BY created_at LIMIT 1)
    ),
    $t$TLE AIdeathon 2026$t$,
    $t$Pick a real problem. Fix it with people, process, systems and AI. Prove it with numbers.$t$,
    $t$Form Your Crew$t$,
    NULL,
    $j${"wordmark": [{"font": "sans", "text": "TLE ", "tone": "muted", "scale": 0.42, "weight": 600}, {"font": "display", "text": "AI", "tone": "accent", "scale": 1.25, "weight": 700}, {"font": "serif", "text": "dea", "tone": "base", "scale": 1, "italic": true, "weight": 400}, {"font": "mono", "text": "thon", "tone": "muted", "scale": 0.72, "weight": 300}, {"font": "sans", "text": " 2026", "tone": "muted", "scale": 0.42, "weight": 600}], "metaTitle": "TLE AIdeathon 2026"}$j$::jsonb,
    $j$[{"answer": "No. Process-only solutions are welcome; value to TLE carries the most weight.", "question": "Do we have to use AI?"}, {"answer": "Yes. Every Heist role must be covered; one person can cover several.", "question": "Can one person play several roles?"}, {"answer": "The jury says Go, Go-with-changes (you agree the changes) or Out.", "question": "What happens at the Idea Pitch?"}, {"answer": "Data/BI Auditors validate baselines and actuals; Finance values them in ₹.", "question": "Who checks the numbers?"}]$j$::jsonb,
    $t$## How value is counted

Only numbers validated by an Auditor count. Finance converts validated results to ₹ with this rate card:

| Item | Rate |
|---|---|
| Loaded staff time | ₹450 / hour (ops), ₹300 / hour (counsellor), ₹5,000 / day (finance) |
| Enrolment | ₹14,000 TLE share |
| Recurring value | Annualised, counted for up to 3 years |

Value to TLE = realised ₹ during the live run + recurring ₹ per year × years.$t$,
    $t$Open to all employees. Crews must include people from at least 2 departments. Tech team members may join crews or act as Tech Buddies (mentors), not both.$t$,
    $t$Crews of 3–10. Every Heist role (Mastermind, Insider, Bot Whisperer, Systems Hacker, Deal Maker, Numbers Keeper, Crowd Puller, Shield) must be covered by at least one member; one person can play several roles.$t$,
    $t$Stage 1: Problem Canvas + Idea Pitch (jury decides Go / Go-with-changes / Out). Stage 2: validated baseline + blueprint. Stage 3: build/demo. Stage 4: live run + validated actuals. Stage 5: The Reveal with validated before/after. Only numbers validated by an Auditor count.$t$,
    $j$[{"key": "expectedValue", "name": "Expected Value to TLE", "phases": [1], "weight": 0.3, "description": "Size of the prize: one-time value plus recurring yearly value if it works."}, {"key": "problemSignificance", "name": "Problem Significance", "phases": [1], "weight": 0.2, "description": "How painful, frequent and widespread the problem is today."}, {"key": "solutionFit", "name": "Solution Idea & Path Fit", "phases": [1], "weight": 0.2, "description": "Does the idea attack the root cause? Are the chosen paths the right ones?"}, {"key": "measurability", "name": "Measurability", "phases": [1], "weight": 0.1, "description": "Can the before and after be proven with system data?"}, {"key": "feasibility", "name": "Feasibility in 5 Weeks", "phases": [1], "weight": 0.1, "description": "Can this crew get it live and measured within the contest?"}, {"key": "techAiAngle", "name": "Tech & AI Agents Angle", "phases": [1], "weight": 0.1, "description": "Smart use of our systems, automation or AI agents (not required, but rewarded)."}, {"key": "valueToTle", "name": "Value to TLE (validated)", "phases": [2, 3, 4, 5], "weight": 0.35, "description": "Validated absolute value realised plus future recurring value per year."}, {"key": "adoptionSustainability", "name": "Adoption & Sustainability", "phases": [2, 3, 4, 5], "weight": 0.25, "description": "Real users on the new way, an owner in place, and it keeps running after the contest."}, {"key": "aiTechSolution", "name": "AI & Tech Solution", "phases": [2, 3, 4, 5], "weight": 0.2, "description": "Quality of the solution: process design, smart use of existing systems, AI/agent depth where used."}, {"key": "safetyGovernance", "name": "Safety & Governance", "phases": [2, 3, 4, 5], "weight": 0.1, "description": "Data protection (DPDP), controls, human checkpoints, rollback."}, {"key": "reuseScale", "name": "Reuse & Scale", "phases": [2, 3, 4, 5], "weight": 0.1, "description": "Can other departments, universities or teams use it too?"}]$j$::jsonb,
    jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set($j$[{"gate": true, "name": "Mission Briefing → Idea Pitch", "phase": 1, "details": ["Bootcamp on the Sandbox Kit", "Form a cross-functional crew", "Claim a bank problem or propose your own", "Friday: Idea Pitch"], "endDate": "", "maxPoints": 10, "startDate": "", "description": "Launch, AI & tools bootcamp, crew formation and problem pick. Ends with a 5-minute Idea Pitch: the jury says Go, Go-with-changes or Out.", "deliverables": ["Problem Canvas", "Solution idea & paths", "Expected value", "5-slide pitch deck"]}, {"name": "Blueprint", "phase": 2, "details": ["Baseline metrics validated by Data/BI", "Before → after process map", "System change spec / Agent Charter / tool business case"], "endDate": "", "requires": ["baseline"], "maxPoints": 15, "startDate": "", "description": "Lock the baseline with an Auditor and design the solution for every path you chose.", "deliverables": ["Validated baseline", "Solution Blueprint", "Response to pitch conditions"]}, {"name": "The Build", "phase": 3, "details": ["Tech Buddy office hours twice a week", "Sandbox access to systems and AI tools"], "endDate": "", "maxPoints": 15, "startDate": "", "description": "Re-engineer, configure, build or trial. Demo it working.", "deliverables": ["Build summary", "Demo link or video"]}, {"name": "The Job (Live Run)", "phase": 4, "details": ["Run in production or a controlled pilot", "Track usage and adoption", "Submit actual numbers + evidence"], "endDate": "", "maxPoints": 20, "startDate": "", "description": "Two weeks live with real users. Submit actuals for validation; Finance values the result.", "deliverables": ["Adoption evidence", "Actuals submitted for validation"]}, {"name": "The Reveal (Grand Finale)", "phase": 5, "details": ["7-minute pitch + 3-minute jury Q&A", "Validated numbers only"], "endDate": "", "requires": ["actual"], "maxPoints": 40, "startDate": "", "description": "Present the validated before/after and the value to TLE. Final ranking and awards.", "deliverables": ["Final deck", "Sustainability plan"]}]$j$::jsonb, '{0,startDate}', to_jsonb(to_char(:'launch_date'::date + 0, 'YYYY-MM-DD'))), '{0,endDate}', to_jsonb(to_char(:'launch_date'::date + 4, 'YYYY-MM-DD'))), '{1,startDate}', to_jsonb(to_char(:'launch_date'::date + 7, 'YYYY-MM-DD'))), '{1,endDate}', to_jsonb(to_char(:'launch_date'::date + 11, 'YYYY-MM-DD'))), '{2,startDate}', to_jsonb(to_char(:'launch_date'::date + 14, 'YYYY-MM-DD'))), '{2,endDate}', to_jsonb(to_char(:'launch_date'::date + 18, 'YYYY-MM-DD'))), '{3,startDate}', to_jsonb(to_char(:'launch_date'::date + 21, 'YYYY-MM-DD'))), '{3,endDate}', to_jsonb(to_char(:'launch_date'::date + 32, 'YYYY-MM-DD'))), '{4,startDate}', to_jsonb(to_char(:'launch_date'::date + 35, 'YYYY-MM-DD'))), '{4,endDate}', to_jsonb(to_char(:'launch_date'::date + 39, 'YYYY-MM-DD'))),
    $j$[{"rank": 1, "color": "gold", "label": "Winner", "amount": 100000}, {"rank": 2, "color": "silver", "label": "1st Runner-up", "amount": 60000}, {"rank": 3, "color": "bronze", "label": "2nd Runner-up", "amount": 40000}]$j$::jsonb,
    $j$[{"role": "The Mastermind", "maxPerTeam": 1, "minPerTeam": 1, "description": "Problem owner and crew captain; leads the pitch."}, {"role": "The Insider", "maxPerTeam": 5, "minPerTeam": 1, "description": "Knows today's process inside out; redesigns it and the human checkpoints."}, {"role": "The Bot Whisperer", "maxPerTeam": 5, "minPerTeam": 1, "description": "Tech/AI builder: configures tools, builds agents or automations."}, {"role": "The Systems Hacker", "maxPerTeam": 5, "minPerTeam": 1, "description": "Knows our systems; makes changes or finds features nobody uses."}, {"role": "The Deal Maker", "maxPerTeam": 5, "minPerTeam": 1, "description": "Business case, vendor or cost analysis, value sizing."}, {"role": "The Numbers Keeper", "maxPerTeam": 5, "minPerTeam": 1, "description": "Pulls baseline and after data; builds the proof."}, {"role": "The Crowd Puller", "maxPerTeam": 5, "minPerTeam": 1, "description": "Gets real users onto the new way during the live run."}, {"role": "The Shield", "maxPerTeam": 5, "minPerTeam": 1, "description": "Risk, DPDP, guardrails and controls."}]$j$::jsonb,
    'ideathon',
    $j$[{"key": "problemCanvas", "type": "textarea", "label": "Problem Canvas", "phases": [1], "required": true, "placeholder": "Who is hurting, how often and how much? What does today's process look like? What is the number today (X) and what should it be (Y)?"}, {"key": "solutionIdea", "type": "textarea", "label": "Solution Idea", "phases": [1], "required": true, "placeholder": "What will you change? Which people, process, systems, agents or tools are involved?"}, {"key": "solutionPaths", "type": "multiselect", "label": "Solution Paths", "phases": [1, 2], "options": ["Process Re-engineering", "System Change", "Agent Build", "Tool Purchase"], "helpText": "Pick every path your solution uses. A non-tech solution (Process Re-engineering) is perfectly valid.", "required": true}, {"key": "expectedValue", "type": "textarea", "label": "Expected Value to TLE", "phases": [1], "required": true, "placeholder": "One-time value (₹, hours, risk avoided) and the recurring value per year if this becomes the new normal. Show your maths."}, {"key": "pitchDeck", "type": "file", "label": "Pitch Deck", "accept": ".pdf,.ppt,.pptx", "phases": [1, 5], "helpText": "Idea Pitch: 5 slides, 5 minutes. Reveal: final deck with validated before/after.", "required": true, "maxSizeMb": 25}, {"key": "conditionsResponse", "type": "textarea", "label": "How you met the Idea Pitch conditions", "phases": [2], "helpText": "Only if the jury said Go-with-changes.", "required": false}, {"key": "solutionDesign", "type": "textarea", "label": "Solution Blueprint", "phases": [2], "required": true, "placeholder": "New process (steps, owners, hand-offs), what changes in which system, where AI/agents fit, what stays human."}, {"key": "processMap", "type": "file", "label": "Process Map (before → after)", "accept": ".pdf,.png,.jpg,.jpeg,.pptx", "phases": [2], "required": false, "maxSizeMb": 15}, {"key": "systemChangeSpec", "type": "textarea", "label": "System Change Spec", "phases": [2], "required": false, "placeholder": "Which system (CRM/UMS/LMS/Empower/…), which configuration or feature, who approves, rollback plan.", "requiredForPaths": ["System Change"]}, {"key": "agentCharter", "type": "agentCharter", "label": "Agent Charter", "phases": [2, 3, 4, 5], "helpText": "One row per agent: what it does, how autonomous it is, where a human checks it, and what it costs.", "required": false, "requiredForPaths": ["Agent Build"]}, {"key": "toolBusinessCase", "type": "file", "label": "Tool Business Case", "accept": ".pdf,.xlsx,.pptx,.docx", "phases": [2], "helpText": "Vendor comparison, commercials, payback period, security/DPDP check.", "required": false, "maxSizeMb": 25, "requiredForPaths": ["Tool Purchase"]}, {"key": "buildSummary", "type": "textarea", "label": "What did you build or change?", "phases": [3, 4], "required": true}, {"key": "demoUrl", "type": "url", "label": "Demo link", "phases": [3, 4, 5], "required": false, "placeholder": "https://…"}, {"key": "demoVideoUrl", "type": "url", "label": "Demo video", "phases": [3, 5], "required": false, "placeholder": "Drive / YouTube link"}, {"key": "adoptionEvidence", "type": "textarea", "label": "Adoption Evidence", "phases": [4, 5], "required": true, "placeholder": "How many real users/cases ran through the new way? Usage numbers, feedback, what broke and what you fixed."}, {"key": "runLog", "type": "file", "label": "Live-run log / data extract", "accept": ".pdf,.xlsx,.csv", "phases": [4], "required": false, "maxSizeMb": 25}, {"key": "sustainabilityPlan", "type": "textarea", "label": "Sustainability Plan", "phases": [5], "required": true, "placeholder": "Who owns it from Monday? What keeps it running? What does it cost to run per month?"}]$j$::jsonb,
    $j${"max": 10, "min": 1, "step": 1, "labels": [{"max": 10, "min": 9, "label": "Exceptional"}, {"max": 8, "min": 7, "label": "Strong"}, {"max": 6, "min": 5, "label": "Average"}, {"max": 4, "min": 3, "label": "Weak"}, {"max": 2, "min": 1, "label": "Poor"}]}$j$::jsonb,
    $j${"team": "Crew", "judge": "Jury", "phase": "Stage", "track": "Value Lens", "validator": "Auditor", "submission": "Entry"}$j$::jsonb,
    $j${"theme": "Technology as a business lever: revenue, cost, process, safeguard", "colorMode": "dark", "departments": ["Admissions & Counselling", "Marketing", "University Operations", "Academics & Content", "Examinations", "Student Success", "Finance", "HR & People", "Technology", "Product", "Enterprise & B2B", "Impact & CSR", "Legal & Compliance"], "solutionPaths": ["Process Re-engineering", "System Change", "Agent Build", "Tool Purchase"], "minTeamMembers": 3, "exclusiveTracks": false, "showcaseEnabled": true, "assistantEnabled": true, "resultsPublished": false, "feedbackVisibility": "after_results", "problemBankEnabled": true, "impactMetricsEnabled": true, "minDepartmentsPerTeam": 2}$j$::jsonb,
    $j$[{"key": "bigScore", "label": "The Big Score", "amount": 15000, "description": "Highest validated value to TLE", "winnerTeamId": null}, {"key": "bestBot", "label": "Best Bot", "amount": 15000, "description": "Best AI agent", "winnerTeamId": null}, {"key": "insideJob", "label": "The Inside Job", "amount": 15000, "description": "Best process re-engineering or re-use of existing tools", "winnerTeamId": null}, {"key": "smartestDeal", "label": "Smartest Deal", "amount": 15000, "description": "Best tool business case", "winnerTeamId": null}, {"key": "theShield", "label": "The Shield", "amount": 15000, "description": "Best safeguard / risk solution", "winnerTeamId": null}, {"key": "bestCrew", "label": "Best Crew", "amount": 15000, "description": "Best cross-functional teamwork and adoption", "winnerTeamId": null}]$j$::jsonb,
    80, 40, 10,
    :'launch_date'::date,
    :'launch_date'::date + 39,
    :'launch_date'::date + 2
  )
  RETURNING id, created_by
)
SELECT id, created_by FROM ins;

-- Value lenses (tracks)
INSERT INTO tracks (contest_id, name, description, icon, sort_order)
SELECT n.id, v.name, v.description, v.icon, v.sort_order
FROM _new_contest n, (VALUES
    ($t$Revenue Growth$t$, $t$More admissions, conversions, renewals and upsell.$t$, $t$📈$t$, 0),
    ($t$Cost Reduction$t$, $t$Spend less per lead, per student, per process.$t$, $t$💰$t$, 1),
    ($t$Process Excellence$t$, $t$Cut turnaround time and manual effort.$t$, $t$⚙️$t$, 2),
    ($t$Safeguard$t$, $t$Risk, compliance, DPDP, security and leakage.$t$, $t$🛡️$t$, 3),
    ($t$Adoption Unlock$t$, $t$Get value from features and tools we already own.$t$, $t$🔓$t$, 4),
    ($t$Student & Customer Experience$t$, $t$Faster answers, fewer drop-offs, happier students.$t$, $t$🎓$t$, 5),
    ($t$Decision Intelligence$t$, $t$Right numbers, to the right person, without Excel.$t$, $t$🧭$t$, 6)
) AS v(name, description, icon, sort_order);

-- Problem Bank (crews can claim these, or propose their own in the app)
INSERT INTO problem_statements (contest_id, track_id, title, description, owner_department, metric_template, max_teams, status, sort_order, created_by)
SELECT n.id, tr.id, v.title, v.description, v.owner_department, v.metric_template, v.max_teams, 'open', v.sort_order, n.created_by
FROM _new_contest n
CROSS JOIN (VALUES
    ($t$Process Excellence$t$, $t$Cut student admission TAT$t$, $t$Time from application submitted to admission confirmed is X days. Bring it to Y days.$t$, $t$University Operations$t$, $j${"unit": "days", "metric": "Admission TAT", "direction": "decrease"}$j$::jsonb, 2, 0),
    ($t$Revenue Growth$t$, $t$Reduce RNR (ring-no-response) at a university$t$, $t$X% of counselling calls to leads of University Z go unanswered. Bring it to Y%.$t$, $t$Admissions & Counselling$t$, $j${"unit": "%", "metric": "RNR rate", "direction": "decrease"}$j$::jsonb, 2, 1),
    ($t$Revenue Growth$t$, $t$Lift lead-to-enrolment conversion$t$, $t$Conversion for University Z / programme P is X%. Lift it to Y%.$t$, $t$Admissions & Counselling$t$, $j${"unit": "%", "metric": "Lead-to-enrolment conversion", "direction": "increase"}$j$::jsonb, 2, 2),
    ($t$Revenue Growth$t$, $t$Cut payment drop-off at fee payment$t$, $t$X% of students who reach the payment step do not pay. Bring it to Y%.$t$, $t$Finance$t$, $j${"unit": "%", "metric": "Payment drop-off", "direction": "decrease"}$j$::jsonb, 2, 3),
    ($t$Process Excellence$t$, $t$Cut pre-exam setup time$t$, $t$Setting up one exam takes ~12 hours of manual work. Bring it to Y hours or less.$t$, $t$Examinations$t$, $j${"unit": "hours", "metric": "Setup time per exam", "direction": "decrease"}$j$::jsonb, 2, 4),
    ($t$Adoption Unlock$t$, $t$More counselor calls through CRM$t$, $t$Only X% of counselor calls are made through CRM. Lift it to Y%.$t$, $t$Admissions & Counselling$t$, $j${"unit": "%", "metric": "Calls via CRM", "direction": "increase"}$j$::jsonb, 2, 5),
    ($t$Adoption Unlock$t$, $t$Adopt the CRM features we already have$t$, $t$Smart views, auto-dialer and the counselor app are used by X% of users. Lift it to Y%.$t$, $t$Admissions & Counselling$t$, $j${"unit": "%", "metric": "Active feature users", "direction": "increase"}$j$::jsonb, 2, 6),
    ($t$Student & Customer Experience$t$, $t$Reduce LMS student drop-off$t$, $t$X% of students at University Z stop engaging with the LMS. Bring it to Y%.$t$, $t$Student Success$t$, $j${"unit": "%", "metric": "LMS drop-off", "direction": "decrease"}$j$::jsonb, 2, 7),
    ($t$Decision Intelligence$t$, $t$Faster monthly MIS close$t$, $t$Monthly MIS takes X days after month-end. Bring it to Y days.$t$, $t$Finance$t$, $j${"unit": "days", "metric": "MIS close time", "direction": "decrease"}$j$::jsonb, 2, 8),
    ($t$Process Excellence$t$, $t$Cut document verification TAT$t$, $t$Verifying one student's documents takes X. Bring it to Y.$t$, $t$University Operations$t$, $j${"unit": "hours", "metric": "Verification TAT", "direction": "decrease"}$j$::jsonb, 2, 9),
    ($t$Revenue Growth$t$, $t$Lift year-2 fee renewal$t$, $t$X% of year-1 students at University Z renew. Lift it to Y%.$t$, $t$Student Success$t$, $j${"unit": "%", "metric": "Renewal rate", "direction": "increase"}$j$::jsonb, 2, 10),
    ($t$Cost Reduction$t$, $t$Cut cost per enrolment$t$, $t$Telephony, cloud and messaging cost ₹X per enrolment. Cut it by Y%.$t$, $t$Technology$t$, $j${"unit": "₹", "metric": "Cost per enrolment", "direction": "decrease"}$j$::jsonb, 2, 11),
    ($t$Safeguard$t$, $t$DPDP consent coverage$t$, $t$X% of student-facing systems capture and log consent. Bring it to 100%.$t$, $t$Legal & Compliance$t$, $j${"unit": "%", "metric": "Systems with consent logging", "direction": "increase"}$j$::jsonb, 2, 12)
) AS v(track, title, description, owner_department, metric_template, max_teams, sort_order)
LEFT JOIN tracks tr ON tr.contest_id = n.id AND tr.name = v.track;

-- Summary
SELECT c.name, c.slug, c.status, c.start_date::date AS launch, c.end_date::date AS finale_ends,
       (SELECT count(*) FROM tracks t WHERE t.contest_id = c.id) AS value_lenses,
       (SELECT count(*) FROM problem_statements p WHERE p.contest_id = c.id) AS problems,
       jsonb_array_length(c.awards) AS awards
FROM contests c JOIN _new_contest n ON n.id = c.id;

COMMIT;
