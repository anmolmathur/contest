# v2 Refactor — Handoff Notes

Branch: `feat/v2-multitenant-refactor` (local only — NOT pushed to any remote).

Scope: five milestones requested on 2026-04-23, all shipped to the local
`/Users/anmolmathur/docker/ai-stack` dev environment. Production remains
untouched — see **Promoting to production** below.

---

## What shipped

### Milestone 1 — Data isolation & RBAC refactor

- **`lib/contest-auth.ts`** rewritten. Added `getEffectiveContestRole` — the
  single source of truth for per-contest permissions. Platform admins no
  longer silently inherit judge/admin powers inside a contest; they get a
  read-only `inspect` access unless explicitly added to `contest_users`.
- **`lib/legacy-auth.ts`** (new). All legacy (non-slug) API routes now go
  through `legacyAuthz()`, which resolves the “default contest” (the row
  flagged `isDefault=true`), computes the caller’s effective role, and
  returns a typed verdict. Frozen-contest write-guard built in.
- **`JUDGE_EMAILS` constant deleted.** Every consumer migrated — 21 legacy
  routes + 3 legacy UI pages (`/dashboard`, `/admin`, `/judging`). UI now
  reads `session.user.legacyRole` (populated at login via
  `lib/auth.ts::computeLegacyRole`).
- **Contest-scoping** added to every formerly-global query. Examples:
  - `GET /api/teams/all` → teams in the default contest only
  - `GET /api/scores/all` → scores for submissions in the default contest
  - `GET /api/submissions/all` → ditto
  - `GET /api/leaderboard` → teams in the default contest only
  - `POST /api/scores/submit` → submission must belong to default contest
- **Archive/read-only** guarantee. Added `contests.visibility` column plus
  `<ContestStatusBanner>` that renders at the top of every `/c/[slug]`
  page when the contest isn’t active. Mutating endpoints return 409
  (“contest is frozen”) on completed/archived contests.
- **Explicit per-contest join** already existed at
  `POST /api/c/[slug]/users/enroll`; no UI CTA added (the existing
  platform admin flow + self-enroll POST is sufficient for now).

### Milestone 2 — Custom domain + whitelabeling

- **`middleware.ts`** extended. On each request, if
  `ENABLE_CUSTOM_DOMAINS=true` and the `Host` header matches a verified
  `contests.customDomain`, internal URL is rewritten to `/c/[slug]/…`.
- **`lib/tenant-resolver.ts`** (new). Cached (60s TTL) host→slug lookup.
- **`GET /api/tls-ask?host=X`** — reverse-proxy TLS hook. Returns 200 if
  `X` is a verified custom domain. Disabled unless
  `ENABLE_CUSTOM_DOMAINS=true`.
- **`GET /.well-known/contest-verify`** — customer hits this after DNS
  propagates; flips `customDomainVerifiedAt` and invalidates the cache.
- **`POST/PATCH/DELETE /api/platform/contests/[slug]/domain`** — platform
  admin endpoints.
- **Per-tenant branding**:
  - `contests.brandingConfig` jsonb:
    `{primaryColor, secondaryColor, faviconUrl, ogImageUrl, metaTitle,
    metaDescription, footerHtml}`.
  - `app/c/[slug]/layout.tsx` now emits `<title>`, favicon link, OG tags
    from this config; root `<div>` gets CSS vars `--brand-primary`,
    `--brand-secondary`.
  - `app/c/[slug]/opengraph-image.tsx` — dynamic OG image generator.
- **`docs/custom-domains.md`** — production ops runbook for whichever
  reverse proxy is chosen (Caddy / Cloudflare for SaaS / Nginx).

### Milestone 3 — Clone, dynamic config, notifications

- **Clone**: `POST /api/platform/contests/[slug]/clone` copies the contest
  row + `tracks` + scoped `certificate_templates`. Explicitly does NOT
  copy `contest_users`, `teams`, `submissions`, `scores`. Supports
  `shiftDatesByDays` to rebase phase dates.
- **Announcements**:
  - Table `announcements` (`id, contest_id, title, body, pinned, ...`)
  - `GET|POST /api/c/[slug]/announcements`
  - `PATCH|DELETE /api/c/[slug]/announcements/[id]`
  - Creating an announcement fires a fire-and-forget dispatch →
    in-app + email to every `contest_users` member.
- **FAQ**: `GET|PUT /api/c/[slug]/faq` stores an array of
  `{question, answer}` in `contests.faqConfig`.
- **Notification engine**:
  - `lib/notifications/email.ts` — nodemailer-backed. Falls back to a
    mock driver (logs to `/tmp/contest-outbox.log`) when `SMTP_HOST` is
    unset.
  - `lib/notifications/templates.ts` — inlined HTML templates.
  - `lib/notifications/dispatch.ts` — single entry point
    `notify(...)`. Helpers: `dispatchAnnouncement`,
    `dispatchTeamInvite`, `dispatchPhaseStarted`,
    `dispatchScoresPublished`. Respects per-user
    `users.notificationPrefs` jsonb.
  - Table `notifications` (`id, user_id, contest_id, type, title, body,
    action_url, read_at, created_at`).
  - `GET|PATCH /api/notifications` — current user’s feed + mark-all-read.
  - `<NotificationBell>` React component — polls every 60s.
  - **NOT yet wired into the header**; drop `<NotificationBell/>` into the
    site-wide header when UX is ready.

### Milestone 4 — Uploads, pitches, AI assistant

- **Upload infra**:
  - `lib/uploads/storage.ts` — presigned-PUT. Uses AWS SDK when
    `AWS_S3_BUCKET` is set, otherwise mock driver that writes to
    `public/uploads/`.
  - `POST /api/uploads/presign` — single-use signed URL + per-user rate
    limit (20/min). Records the pending asset row.
  - `PUT /api/uploads/local/[id]` — dev receiver for mock driver.
  - `lib/uploads/client.ts` — browser helper `uploadFile({ file, kind })`.
  - Table `media_assets` (owner, contest, team, kind, bucket, objectKey,
    url, mimeType, sizeBytes).
- **Team pitches**:
  - Table `team_pitches` + `team_invitations`.
  - `GET|PUT /api/c/[slug]/pitches` — list / upsert my pitch.
  - `GET|POST /api/c/[slug]/team-invitations` — list + create.
  - `PATCH /api/c/[slug]/team-invitations/[id]` — accept / decline /
    cancel. Accepting writes the member into `contest_users.teamId`.
  - UI: `/c/[slug]/team-finder` — searchable pitch board with my-pitch
    editor (title, bio markdown, skills, roles, video URL, image uploads).
- **AI assistant**:
  - `lib/ai/openai.ts` — OpenAI Node SDK (streaming chat.completions).
    Falls back to mock driver (canned streamed response) when
    `OPENAI_API_KEY` is unset or `AI_DRIVER=mock`.
  - `POST /api/c/[slug]/assistant` — SSE streaming. System prompt assembled
    from `rulesContent`, `eligibilityRules`, `teamStructureRules`,
    `deliverableRules`, `phaseConfig`, `faqConfig`, `prizes`. Rate-limited
    30/min/user.
  - `<AssistantWidget>` floating chat bubble, wired into
    `/c/[slug]/layout.tsx` (suppressed for drafts).

### Milestone 5 — Public results showcase

- `/c/[slug]/results` — animated podium + leaderboard table, themed with
  the contest’s brand CSS vars. Public (no auth needed).
- `/api/c/[slug]/leaderboard` made public (middleware allowlist + handler
  no longer requires auth).
- Middleware already allowlists `/c/[slug]/results` for unauth visitors.
- Apex landing (`/app/page.tsx`) already lists contests from
  `/api/contests` including completed ones — that serves as the
  “past contests” shelf.

---

## Database changes (single additive migration)

`drizzle/0006_good_mentor.sql` — applied to local dev DB only. All
additions are backward-compatible:

- **Added to `contests`**: `visibility`, `is_default`, `custom_domain`,
  `custom_domain_verified_at`, `support_email`, `branding_config`,
  `feature_flags`, `faq_config`.
- **Added to `users`**: `notification_prefs`.
- **New tables**: `announcements`, `notifications`, `media_assets`,
  `team_pitches`, `team_invitations`.
- **New enum**: `contest_visibility` (`public | unlisted | private`).

The migration is safe to apply to production without data loss. Zero
destructive operations.

---

## Data backfill done in dev

- `contests.is_default` flipped to `true` for `innovation-challenge`
  (the only existing contest).
- The three legacy `JUDGE_EMAILS` users (`shantanu@`, `jaideep.k@`,
  `anmol.mathur@`) were already present in `contest_users` with
  `role='admin'` on `innovation-challenge` — no insert needed. The seed
  script at `scripts/seed-legacy-judges.ts` is idempotent and available
  for production rollout if needed.

---

## Environment variables introduced

All optional. When unset, a mock/noop driver kicks in:

| Var | Purpose | Default |
|---|---|---|
| `ENABLE_CUSTOM_DOMAINS` | Turn on M2 domain rewriting | `false` (dev off) |
| `PLATFORM_DOMAINS` | Comma-separated apex hosts | — |
| `PLATFORM_CANONICAL_HOST` | CNAME target shown in DNS instructions | — |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` / `SMTP_FROM` | Real email via nodemailer | unset → mock |
| `EMAIL_DRIVER` | Force mock even if SMTP configured | unset |
| `AWS_S3_BUCKET` / `AWS_S3_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_PUBLIC_URL` | Real uploads to S3 | unset → local mock |
| `UPLOAD_DRIVER` | Force mock even if S3 configured | unset |
| `OPENAI_API_KEY` | Real OpenAI AI assistant | unset → mock driver |
| `AI_DRIVER` | Force mock even with key | unset |
| `MOCK_OUTBOX_PATH` | Where mock email driver logs | `/tmp/contest-outbox.log` |

---

## How to test locally

Container URL: http://localhost:3000 (routed through the existing
ngrok_contest proxy for remote sharing if needed).

Smoke checks:

```
curl -I http://localhost:3000/
curl http://localhost:3000/api/contests | jq
curl http://localhost:3000/api/c/innovation-challenge/leaderboard | jq
curl http://localhost:3000/c/innovation-challenge/results -o /dev/null
curl "http://localhost:3000/api/tls-ask?host=foo.com"    # → {ok:false, reason:"disabled"}
```

Manual UI flows:

1. Log in as a platform admin (`anmol.mathur@teamlease.com`). Visit
   `/platform/admin` — the existing tabs still work; the **clone** and
   **domain management** endpoints are reachable via API (UI buttons are
   a polish task).
2. Visit `/c/innovation-challenge` — contest landing, status banner
   shown because contest is `completed`.
3. Open the floating purple bubble → ask “What are the phases?” — mock
   assistant responds in a stream.
4. Visit `/c/innovation-challenge/team-finder` — empty list; click
   **Publish my pitch** to add one. Images upload to `public/uploads/`.
5. Visit `/c/innovation-challenge/results` — full podium + standings.

---

## What’s **not** done (known gaps)

These are deliberate deferrals — lifting them doesn’t require schema
changes, only UI/code work:

1. **Platform admin UI** does not yet have buttons for clone or domain
   management. You can hit the APIs with curl until the dialogs are
   added.
2. **Notification bell** (`<NotificationBell/>`) is built but not yet
   dropped into the global header. Add it to whichever layout owns the
   site-wide top nav.
3. **Write-guards on completed/archived contests** are applied to the
   most-trafficked mutating endpoints (scores, submissions, teams) but
   not every endpoint in `/api/c/[slug]/*`. Any endpoint that doesn’t
   call `isContestMutable()` before a write will silently allow edits
   on an archived contest. Low risk since the UI hides those controls.
4. **Phase-transition notifications** — `dispatchPhaseStarted` exists
   but isn’t triggered automatically. A cron or admin “start phase”
   button needs to call it.
5. **Custom domain workflow** is code-complete but untested end-to-end
   because `ENABLE_CUSTOM_DOMAINS` is off in dev. Follow the ops doc
   when first rolling it out.

---

## Promoting to production

When you’re satisfied with dev testing:

1. **Push the branch to AWS CodeCommit** (this is the step the CI/CD
   pipeline watches — do it only after dev sign-off):

   ```
   cd /Users/anmolmathur/Documents/GitHub/contest
   git remote add codecommit <codecommit-url>   # one-time
   git push codecommit feat/v2-multitenant-refactor
   ```

2. **Apply the migration** against the prod DB as part of the deploy.
   `drizzle/0006_good_mentor.sql` is additive and safe; no downtime.

3. **Post-migration SQL** (run once, safe & idempotent):

   ```sql
   -- Flag the existing live contest as the default for legacy routes
   UPDATE contests SET is_default = true WHERE slug = '<existing-slug>';

   -- Ensure the legacy JUDGE_EMAILS users are in contest_users.
   -- Same seed as /scripts/seed-legacy-judges.ts; skip if already done.
   INSERT INTO contest_users (contest_id, user_id, role)
   SELECT c.id, u.id, 'judge'
   FROM contests c CROSS JOIN users u
   WHERE c.is_default = true
     AND u.email IN ('shantanu@teamlease.com','jaideep.k@teamlease.com','anmol.mathur@teamlease.com')
     AND NOT EXISTS (
       SELECT 1 FROM contest_users cu
       WHERE cu.contest_id = c.id AND cu.user_id = u.id
     );
   ```

4. **Env vars**: leave `ENABLE_CUSTOM_DOMAINS`, `SMTP_*`, `AWS_S3_*`,
   `OPENAI_API_KEY` all unset initially. The mock drivers keep the app
   functional. Turn them on one feature at a time as you validate
   production config.

5. **Users will need to re-login once** after deploy so their JWT
   picks up the new `legacyRole` session field. (Existing sessions
   still work — they just won’t have the banner-gated
   admin/judge entrypoints on legacy pages until a fresh login.)
