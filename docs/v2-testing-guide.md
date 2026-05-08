# v2 Refactor — Testing Guide

A runbook for manually verifying everything shipped in
`feat/v2-multitenant-refactor`. The app is live at **http://localhost:3000**
via the Docker stack in `/Users/anmolmathur/docker/ai-stack`.

> **Data note**: the local dev DB is the same `hackathon_db` used by the
> live contest container. The `feat/v2-multitenant-refactor` branch is
> NOT pushed anywhere — only the container at `localhost:3000` sees the
> new code. The live ngrok/production container is still running old code.

---

## 0 · Prep (do this once before testing)

### 0.1 — Re-login as a platform admin

The JWT was extended with a new `legacyRole` field in M1. **Existing
sessions predate this and will have `legacyRole=null`**, which hides
the judge/admin buttons on `/dashboard`, `/admin`, `/judging`.

1. Open http://localhost:3000 in an incognito window.
2. Click **Sign in**.
3. Log in as one of:
   - `anmol.mathur@teamlease.com`
   - `shantanu@teamlease.com`
   - `jaideep.k@teamlease.com`

   (Use your existing prod password — it's the same DB.)

All three have `globalRole='platform_admin'` and are also seeded as
`role='admin'` on `innovation-challenge`, so `legacyRole` will be
populated to `admin` after login.

### 0.2 — (Optional) flip the default contest back to `active`

The only contest (`innovation-challenge`) is `status='completed'`. In
that state:
- `/c/innovation-challenge/*` pages show the read-only banner
- All mutating endpoints return **409 "contest is frozen"**
- Assistant widget still works (read-only query only)

To exercise **active-contest** behaviors (team create, score submit,
etc.) without corrupting prod state, spin up a throwaway second
contest instead (see §3.3 — clone). **Do not** flip the existing
contest to active just for testing.

### 0.3 — Understand the two "surfaces"

| Surface | Where | What it's for |
|---|---|---|
| **Legacy single-contest UI** | `/dashboard`, `/admin`, `/judging`, `/rules` | Original hackathon UX. Automatically scoped to the `is_default=true` contest via `lib/legacy-auth.ts`. |
| **Multi-contest UI** | `/c/<slug>/dashboard`, `/c/<slug>/admin`, etc. | New per-contest UX. Each slug is its own tenant. |
| **Platform admin** | `/platform/admin` | Create/manage contests globally. |

Every API has matching legacy and per-contest versions; they share DB
tables but enforce contest isolation at the query layer.

---

## 1 · Milestone 1 — Data isolation & RBAC

### 1.1 — Verify `JUDGE_EMAILS` is gone from runtime

```bash
cd /Users/anmolmathur/Documents/GitHub/contest
grep -r "JUDGE_EMAILS" app lib --include='*.ts' --include='*.tsx' | grep -v 'node_modules'
```

Expected: **no results in runtime code** (only one comment in
`lib/legacy-auth.ts`). If any hit references a call, that's a bug.

### 1.2 — Verify platform-admin inspect semantics

Log in as a **non-admin user** (create one via `/platform/admin` → Users
tab → Create user, or pick any existing participant). Then:

1. Visit `/c/innovation-challenge/admin` — should **404/403**, not
   render. Platform admin is the only auto-inspector.
2. Visit `/c/innovation-challenge/dashboard` — should show the dashboard
   scoped to this user's contest_users row (or an empty state).

Then log back in as a platform admin and verify:

3. `/c/innovation-challenge/admin` — accessible (you're explicitly in
   `contest_users` with `role='admin'`, not just implicit inspect).

### 1.3 — Verify the archive banner

1. `http://localhost:3000/c/innovation-challenge` — top of page should
   show an emerald banner: *"This contest has concluded. Results below
   are final and viewable for reference."*
2. Try to submit a score or approve a team via API:

   ```bash
   curl -X POST http://localhost:3000/api/teams/approve \
     -H 'content-type: application/json' \
     -b "next-auth.session-token=<your cookie>" \
     -d '{"teamId":"<any>","approved":true}'
   ```

   Expected: **409** with `"Contest is completed or archived; approvals are frozen"`.

### 1.4 — Verify cross-contest leak is closed

If you create a second contest (via §3.3 clone), then:

1. Log in as a judge who is in contest A, not contest B.
2. Call `GET /api/c/<contest-B-slug>/teams/all` — should return **403**.
3. Call the legacy `GET /api/teams/all` — should return teams **only
   from the default contest** (the one flagged `is_default=true`),
   never from contest B.

---

## 2 · Milestone 2 — Custom domain & whitelabeling

### 2.1 — TLS-ask hook behavior with the flag off (default)

```bash
curl -s http://localhost:3000/api/tls-ask?host=anything.com
# → {"ok":false,"reason":"disabled"}
```

### 2.2 — End-to-end custom domain (requires enabling the flag)

1. **Enable the flag** in `.env`:

   ```
   ENABLE_CUSTOM_DOMAINS=true
   PLATFORM_DOMAINS=localhost
   PLATFORM_CANONICAL_HOST=hackathon.teamleaseedtech.com
   ```

2. Add to `/etc/hosts`:

   ```
   127.0.0.1  innovation.test.local
   ```

3. Rebuild the container:

   ```bash
   cd /Users/anmolmathur/docker/ai-stack
   docker compose build contest && docker compose up -d contest
   ```

4. Register the domain (as platform admin, using your session cookie or
   the login flow):

   ```bash
   curl -X POST http://localhost:3000/api/platform/contests/innovation-challenge/domain \
     -H 'content-type: application/json' \
     -H 'cookie: <your session cookie>' \
     -d '{"domain":"innovation.test.local"}'
   ```

5. Verify ownership:

   ```bash
   curl http://innovation.test.local:3000/.well-known/contest-verify
   # → {"ok":true,"contest":"innovation-challenge","verified":true}
   ```

6. Visit `http://innovation.test.local:3000/` — middleware rewrites
   internally to `/c/innovation-challenge/` and the contest landing page
   renders at the naked root. `/dashboard`, `/rules`, `/results` work at
   the branded root too.

7. Verify TLS-ask now answers yes:

   ```bash
   curl "http://localhost:3000/api/tls-ask?host=innovation.test.local"
   # → {"ok":true,"slug":"innovation-challenge"}
   ```

### 2.3 — Per-tenant branding

1. Set `brandingConfig` on the contest (direct SQL works; a UI is a TODO):

   ```sql
   UPDATE contests SET branding_config = '{
     "primaryColor": "#10b981",
     "secondaryColor": "#0ea5e9",
     "metaTitle": "Innovation Challenge 2026",
     "metaDescription": "Build something great with AI",
     "faviconUrl": "/favicon.ico",
     "ogImageUrl": null
   }'::jsonb WHERE slug = 'innovation-challenge';
   ```

2. Reload `/c/innovation-challenge` — the `<title>`, meta description
   and brand-primary CSS var on the results page change accordingly.

3. Visit `http://localhost:3000/c/innovation-challenge/opengraph-image`
   — dynamic OG image renders with the new gradient.

---

## 3 · Milestone 3 — Clone, dynamic config, notifications

### 3.1 — Announcements (requires admin role)

1. As a platform admin (also seeded as contest admin), POST an
   announcement:

   ```bash
   curl -X POST http://localhost:3000/api/c/innovation-challenge/announcements \
     -H 'content-type: application/json' \
     -H 'cookie: <session>' \
     -d '{"title":"Phase 4 starts tomorrow","body":"Final demo day is at 10 AM","pinned":true}'
   ```

2. Read them back (public-readable):

   ```bash
   curl http://localhost:3000/api/c/innovation-challenge/announcements | jq
   ```

3. **Verify fan-out to in-app notifications**:

   ```bash
   curl http://localhost:3000/api/notifications -H 'cookie: <session>' | jq
   ```

   You should see one entry per contest member, including yourself, with
   `title="Phase 4 starts tomorrow"`.

4. **Verify mock email fan-out**:

   ```bash
   docker exec contest tail -n 5 /tmp/contest-outbox.log | jq
   ```

   One JSON line per recipient, `driver="mock"`.

### 3.2 — FAQ

```bash
# Set
curl -X PUT http://localhost:3000/api/c/innovation-challenge/faq \
  -H 'content-type: application/json' -H 'cookie: <session>' \
  -d '{"faq":[{"question":"How many teams can I join?","answer":"One per contest."}]}'

# Read (public)
curl http://localhost:3000/api/c/innovation-challenge/faq
```

The AI assistant automatically pulls this into its system prompt on the
next query.

### 3.3 — Clone a contest (the safest way to get a test contest)

```bash
curl -X POST http://localhost:3000/api/platform/contests/innovation-challenge/clone \
  -H 'content-type: application/json' -H 'cookie: <session>' \
  -d '{"newSlug":"test-clone-2026","newName":"Test Clone 2026","shiftDatesByDays":120}'
```

Then:

1. Visit `/c/test-clone-2026` — draft banner shown (yellow).
2. Visit `/platform/admin` — the new contest appears in the list.
3. Verify no execution state leaked:

   ```sql
   SELECT COUNT(*) FROM teams WHERE contest_id =
     (SELECT id FROM contests WHERE slug = 'test-clone-2026');  -- → 0
   ```

4. Activate it by editing `status='active'` in the platform admin UI
   (or SQL) if you want to test active-contest flows without risking
   the real contest.

### 3.4 — Notification bell (component built, not yet in header)

The bell is ready at `/components/NotificationBell.tsx`. To try it,
drop `<NotificationBell />` into your layout header manually and
reload — the unread badge should appear after step 3.1.

---

## 4 · Milestone 4 — Uploads, pitches, AI assistant

### 4.1 — AI assistant (mock driver, zero config)

1. Visit `/c/innovation-challenge` — purple "Ask about this contest"
   bubble bottom-right.
2. Click → type "What are the judging criteria?" → send.
3. Streaming mock response says *"(mock assistant) Based on the
   contest rules I have in context..."*

### 4.2 — AI assistant (real OpenAI) — **requires key**

1. Add to `.env`:

   ```
   OPENAI_API_KEY=sk-…
   ```

2. Rebuild:

   ```bash
   cd /Users/anmolmathur/docker/ai-stack && docker compose build contest && docker compose up -d contest
   ```

3. Retry step 4.1 — response now actually cites your rules content,
   FAQ entries, and phase config.

### 4.3 — Team finder & pitches

1. Visit `/c/innovation-challenge/team-finder`.
2. Click **Publish / Edit my pitch**. Fill the form, add an image
   (uploads go to `public/uploads/` via the mock driver — verify with
   `docker exec contest ls public/uploads`).
3. Save. Your card appears in the grid.
4. Filter by a skill — grid filters client-side.

### 4.4 — Team invitations flow

```bash
# As team leader, invite a participant
curl -X POST http://localhost:3000/api/c/innovation-challenge/team-invitations \
  -H 'content-type: application/json' -H 'cookie: <leader cookie>' \
  -d '{"teamId":"<team-id>","inviteeUserId":"<participant-id>","direction":"invite"}'

# As invitee, accept
curl -X PATCH http://localhost:3000/api/c/innovation-challenge/team-invitations/<inv-id> \
  -H 'content-type: application/json' -H 'cookie: <invitee cookie>' \
  -d '{"action":"accept"}'

# Verify the invitee is now on the team
docker exec postgres psql -U n8nuser -d hackathon_db -c \
  "SELECT user_id, team_id FROM contest_users WHERE contest_id = (SELECT id FROM contests WHERE is_default) AND user_id = '<invitee-id>';"
```

An email (mock) and in-app notification should have been dispatched on
invite.

### 4.5 — Real S3 uploads (instead of local mock) — **requires keys**

1. Create an S3 bucket + IAM user with `s3:PutObject`, `s3:GetObject`.
2. Add to `.env`:

   ```
   AWS_S3_BUCKET=contest-platform-uploads-dev
   AWS_S3_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=AKIA…
   AWS_SECRET_ACCESS_KEY=…
   AWS_S3_PUBLIC_URL=https://cdn.example.com         # optional CloudFront
   ```

3. Rebuild. Re-run step 4.3. Uploads now go direct to S3; the `url`
   stored in `media_assets` points at S3/CloudFront.

### 4.6 — Real SMTP (instead of mock) — **requires creds**

Add to `.env`:

```
SMTP_HOST=smtp.teamlease.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@teamlease.com
SMTP_PASS=…
SMTP_FROM="Innovation Challenge <noreply@teamlease.com>"
```

Rebuild. Run §3.1 again — emails now actually deliver instead of
logging to `/tmp/contest-outbox.log`.

---

## 5 · Milestone 5 — Public results showcase

### 5.1 — The results page is public (no login)

Open `http://localhost:3000/c/innovation-challenge/results` in a fresh
incognito window — no login prompt, full podium + standings render.

### 5.2 — Verify it works for archived contests

The current contest is `completed`; the results page renders fine. If
you set `status='archived'` via SQL, the page still renders (historical
data is preserved).

### 5.3 — Apex "past contests" shelf

`http://localhost:3000/` already lists every non-draft contest. After
you clone (§3.3), both show up — click through to either.

---

## 6 · Regression sanity — legacy UI still works

The live hackathon flow for `innovation-challenge` uses
`/dashboard`, `/admin`, `/judging`. Verify none broke:

| Page | Login as | Expect |
|---|---|---|
| `/dashboard` | any participant | team info, leaderboard section. "Go to Judging" button shown for judges/admins. |
| `/judging` | admin/judge | team list scoped to default contest. Score submit works (if contest is active). |
| `/admin` | admin | team/user/submission management. Delete button disabled for platform admins (guard against self-lockout). |
| `/rules` | anyone | rules render. |
| `/platform/admin` | platform admin | contest CRUD, user CRUD. |

Any 500 or `JUDGE_EMAILS` reference error → bug. Please flag with the
route path.

---

## 7 · Quick health checklist

Run this one-liner to sanity-check routing end-to-end:

```bash
for p in / \
  /api/contests \
  /c/innovation-challenge \
  /c/innovation-challenge/results \
  /c/innovation-challenge/team-finder \
  /c/innovation-challenge/rules \
  /api/c/innovation-challenge/leaderboard \
  /api/c/innovation-challenge/announcements \
  /api/c/innovation-challenge/faq \
  /api/tls-ask; do
  printf "%-50s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$p)"
done
```

All 200 except `/api/tls-ask` → 503 (disabled) and anything that
requires auth → 401 if you're not logged in. A 500 from any of these is
a bug.

---

## 8 · Summary of changes you need to make to enable each feature

Nothing below is strictly required — the app runs with all features in
**mock mode** today. These are the switches to flip to graduate each
feature from mock → real.

| Feature | Current state | To go live |
|---|---|---|
| **RBAC / data isolation** | ✅ working | nothing |
| **Archive banner & frozen writes** | ✅ working | nothing |
| **Custom domain routing** | off | set `ENABLE_CUSTOM_DOMAINS=true`, `PLATFORM_DOMAINS`, `PLATFORM_CANONICAL_HOST` + add reverse proxy (see `docs/custom-domains.md`) |
| **Per-tenant branding** | ✅ working | set `brandingConfig` on each contest (SQL or a future UI) |
| **Contest clone** | ✅ working | nothing (use the API; UI button is a polish task) |
| **Announcements & FAQ** | ✅ working | nothing (admin UI buttons are a polish task) |
| **In-app notifications** | ✅ working (bell component ready, not in header) | drop `<NotificationBell />` into the global header layout |
| **Email notifications** | mock (logs to `/tmp/contest-outbox.log`) | set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` |
| **Media uploads** | mock (`public/uploads/`) | set `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (optionally `AWS_S3_PUBLIC_URL`) |
| **Team pitches & finder** | ✅ working | nothing (optional: wire into main nav) |
| **AI assistant** | mock (canned response) | set `OPENAI_API_KEY` |
| **Public results page** | ✅ working | nothing |
| **Past-contests shelf on apex** | ✅ working (uses existing `/api/contests`) | nothing |

To switch on **all real integrations** in one pass, append this to
`.env`, then `docker compose build contest && docker compose up -d
contest`:

```
OPENAI_API_KEY=sk-...
AWS_S3_BUCKET=contest-platform-uploads
AWS_S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SMTP_HOST=smtp.teamlease.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Innovation Challenge <noreply@teamlease.com>"
# Custom domains — only turn on once a reverse proxy is ready:
# ENABLE_CUSTOM_DOMAINS=true
# PLATFORM_DOMAINS=hackathon.teamleaseedtech.com
# PLATFORM_CANONICAL_HOST=hackathon.teamleaseedtech.com
```

Each var is consumed by a dynamic import in the respective driver —
setting one switches that feature from mock to live without touching
code.
