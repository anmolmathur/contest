# Prod → Local sync

Pull data from production into your local dev DB so you can test against
something that looks like what your users actually have.

**Read-only on prod.** The script opens a `pg_dump` over your prod
connection string and never writes to it. Local DB is cleared and
replaced in a single transaction.

**Schema is not copied.** Your local DB should already be on the v2
schema (drizzle migrations applied). Any new columns that prod doesn't
yet have are left at their defaults after import.

---

## Prerequisites

- `psql` and `pg_dump` of the **same major version as your prod Postgres**
  on your PATH. On macOS: `brew install libpq && brew link --force libpq`.
- Read access to prod. That usually means one of:
  - A read-only DB user on the prod cluster
  - SSH tunnel through a bastion: `ssh -L 5433:prod-db.internal:5432 bastion`
  - AWS Session Manager port-forwarding
- Your `$LOCAL_DATABASE_URL` already points at a DB where the v2 drizzle
  migrations have been applied.

---

## One-liner (common case)

```bash
PROD_DATABASE_URL="postgres://ro_user:PASS@127.0.0.1:5433/hackathon_prod" \
LOCAL_DATABASE_URL="postgres://n8nuser:gdr3ZpGB*KLCCmxgnVRg2ZcH@localhost:5432/hackathon_db" \
  bash scripts/sync-from-prod/sync.sh
```

Confirmation prompt before anything destructive runs against local.

---

## Flags

| Flag | Effect |
|---|---|
| `--yes` | Skip the confirmation prompt (for scripted use). |
| `--dump-only` | Pull prod → file, don't touch local. Useful for sharing a dump with a colleague. |
| `--apply-only <file>` | Skip prod fetch; apply an existing dump. Pair with a dump you already trust. |
| `--anonymize` | Scrub PII post-import (see `anonymize.sql` — deterministic aliases). |
| `--reset-passwords <pw>` | Set every `users.password` to bcrypt(`<pw>`). Useful for impersonating users in dev. |
| `--keep-local-contests` | Don't TRUNCATE local tables — expects no PK clashes. Rare. |
| `--tables T1,T2,…` | Override the table set. Defaults to everything but Auth.js tables. |

Examples:

```bash
# safe, anonymized + shared dev password
PROD_DATABASE_URL=… LOCAL_DATABASE_URL=… bash scripts/sync-from-prod/sync.sh \
  --anonymize --reset-passwords "dev12345" --yes

# export-only: hand the dump file to a teammate
PROD_DATABASE_URL=… bash scripts/sync-from-prod/sync.sh --dump-only

# import an existing dump (skip prod)
LOCAL_DATABASE_URL=… bash scripts/sync-from-prod/sync.sh \
  --apply-only scripts/sync-from-prod/backups/prod-20260424-114500.sql --yes

# selectively copy just contests + tracks
PROD_DATABASE_URL=… LOCAL_DATABASE_URL=… bash scripts/sync-from-prod/sync.sh \
  --tables contests,tracks --yes
```

---

## What gets copied

Parent → child (FK-safe) order:

1. `users`
2. `contests`
3. `tracks`
4. `contest_users`
5. `teams`
6. `submissions`
7. `scores`
8. `certificate_templates`
9. `announcements`
10. `media_assets`
11. `team_pitches`
12. `team_invitations`
13. `notifications`

### What is NOT copied (and why)

- `accounts`, `sessions`, `verification_tokens` — Auth.js state. Copying
  sessions would give your local env prod login cookies, which is both
  useless (signed by a different secret) and a leak. Log in fresh after
  sync.
- **Schema.** If you've added columns locally that prod doesn't have, they
  remain at their column defaults after import. `post-process.sql`
  normalizes the most important ones (e.g. `is_default`, `visibility`).

---

## Post-process (always runs)

`post-process.sql` fires inside the same transaction as the import and
fixes up the three things most likely to break after a prod→local sync:

1. Elect a `contests.is_default = true` row so legacy routes
   (`/dashboard`, `/admin`, `/judging`) resolve a tenant.
2. Seed the legacy `JUDGE_EMAILS` users as `contest_users` rows with
   `role='judge'` on the default contest.
3. Force `visibility = 'public'` on completed/archived contests so the
   results showcase actually renders.
4. Backfill reasonable defaults on `max_teams`, `max_approved_teams`,
   `max_team_members`, `global_role` if prod had them NULL.

---

## Typical outputs

```
====================================================
  Contest Platform :: prod → local sync
====================================================
  Backup dir:    .../scripts/sync-from-prod/backups
  Tables:        users contests tracks contest_users ...
  Anonymize:     no
  ...
Dumping from prod → .../backups/prod-20260424-114500.sql
  size:  2340112 bytes
  rows:  3187 inserts

About to apply the dump to:
    postgres://n8nuser:***@localhost:5432/hackathon_db
This will TRUNCATE the following tables first (in FK order):
    notifications
    team_invitations
    ...

Proceed? [y/N] y

====================================================
  Import complete. Final local row counts:
====================================================
  users                     482
  contests                    3
  tracks                      7
  contest_users             489
  teams                      42
  submissions                84
  scores                    312
  ...
```

---

## Safety notes

- **Prod password**: `PROD_DATABASE_URL` embeds the password in an env
  var. Use a read-only prod user and drop the history: `unset
  HISTFILE=` or prefix the command with a leading space so zsh skips
  it.
- **`TRUNCATE RESTART IDENTITY CASCADE`** runs locally, never on prod.
  The script hard-codes the destination as `$LOCAL_DATABASE_URL`.
- **bcrypt passwords still reach local.** If that's a concern, use
  `--reset-passwords`. This replaces them before you start running the
  local app.
- **dump files** land in `./backups/`. They contain real prod data;
  don't commit them. The directory has a `.gitignore` to help.

---

## Troubleshooting

- `pg_dump: server version: 16; pg_dump version: 14` → install a
  matching `pg_dump`. On macOS: `brew install postgresql@16`.
- `FATAL: no pg_hba.conf entry` → your prod network ACL blocks your IP.
  Use a tunnel.
- `ERROR: insert or update on table "..." violates foreign key
  constraint` → some tables weren't truncated cleanly. Re-run with
  `--yes` after manually dropping local constraints, or use a fresh DB.
- Rows missing a new column (e.g. `is_default`) stay at the column's
  default. That's fine; `post-process.sql` handles the critical cases.
- Log in fails after sync → you probably have an old session cookie
  signed with a different `AUTH_SECRET`. Clear cookies and sign in
  again.
