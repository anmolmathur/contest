# Request: Read-only prod dump for local dev

Hi team — I need a **data-only** dump of a specific set of tables from the
production contest DB so a developer can test a v2 refactor against
production-shaped state locally. Nothing you do here writes to prod; the
output file is what I need back.

This should take under 5 minutes of your time and produces ~a few MB of
data.

---

## What I need

One file, produced by `pg_dump`, containing **data only** (no schema, no
auth tables) for 13 tables listed below. You can send it as plain `.sql`
or gzipped `.sql.gz` — either works.

**File name convention** (helps me track what I received):

```
contest-prod-dump-YYYYMMDD-HHMM.sql      # or .sql.gz
```

## Prod connection

Please use a read-only DB role if one exists. If not, any role with
`SELECT` on the target tables is fine — `pg_dump --data-only` doesn't
need write access.

Baseline info I have from the codebase:

- **Host**: `10.0.3.146` (internal VPC)
- **Port**: `5432`
- **Database**: `tle_hackathon`
- **User we've been using**: `hackathon` (please use a read-only one if available)

Adjust as needed on your side.

## When to run it

Ideally during a **low-traffic window**. `pg_dump` takes a brief
`ACCESS SHARE` lock on each table (blocks nothing except `DROP`/`ALTER`)
and adds a small CPU/IO load for a few seconds. If a contest is
actively being judged or teams are submitting *right now*, please wait
until that settles. Otherwise, any time is fine.

If you have a **read replica**, prefer that — zero impact on live
traffic.

---

## Exact command

Run this from any host that can reach the prod DB (bastion / admin EC2 /
jump box / wherever you normally run pg tooling):

```bash
pg_dump \
  --host=10.0.3.146 \
  --port=5432 \
  --username=<read-only-user> \
  --dbname=tle_hackathon \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --table=public.users \
  --table=public.contests \
  --table=public.tracks \
  --table=public.contest_users \
  --table=public.teams \
  --table=public.submissions \
  --table=public.scores \
  --table=public.certificate_templates \
  --table=public.announcements \
  --table=public.media_assets \
  --table=public.team_pitches \
  --table=public.team_invitations \
  --table=public.notifications \
  > contest-prod-dump-$(date +%Y%m%d-%H%M).sql
```

### What each flag does (for your records)

| Flag | Why |
|---|---|
| `--data-only` | Don't export CREATE TABLE / indexes — our local DB already has the schema. |
| `--column-inserts` | Emit explicit `INSERT INTO tbl (col1, col2, ...) VALUES (...)` rows. Makes the dump resilient if our local schema has *extra* columns (it does — we've added v2 columns that prod doesn't yet have). |
| `--no-owner`, `--no-privileges` | Don't emit `ALTER OWNER` / `GRANT` statements for your prod roles. We don't have those roles locally. |
| `--disable-triggers` | Wraps the import in `session_replication_role = 'replica'` so loading doesn't fire any triggers you may have added. |
| `--table=public.X` | Explicit allow-list. We deliberately **skip** `accounts`, `sessions`, `verification_tokens` — those are Auth.js session state that would break our local logins. |

### Any of these tables might not exist on prod yet

Five of the 13 tables were added in the v2 refactor and may not exist on
prod: `announcements`, `media_assets`, `team_pitches`, `team_invitations`,
`notifications`.

If `pg_dump` errors out on a missing table, **just remove those `--table`
args and re-run**. We'll pick up those tables after the next prod deploy.

## Optional: compress it

For a big DB or slow transfer, gzip it:

```bash
... > contest-prod-dump-YYYYMMDD-HHMM.sql.gz
# or compress after the fact:
gzip contest-prod-dump-YYYYMMDD-HHMM.sql
```

My import script handles `.sql` and `.sql.gz` transparently.

---

## Please include in your reply

1. **The file** (attached, or link to encrypted share — see below).
2. **Row counts** so I can sanity-check the import:
   ```bash
   grep -c '^INSERT INTO public.' contest-prod-dump-*.sql
   # or for gz:
   zcat contest-prod-dump-*.sql.gz | grep -c '^INSERT INTO public.'
   ```
3. **SHA-256 checksum** so I know the file hasn't been corrupted in
   transit:
   ```bash
   shasum -a 256 contest-prod-dump-*.sql*
   ```

## Delivery

Please **do NOT email unencrypted**. The file contains user emails,
names, bcrypt-hashed passwords, team data, etc.

Pick one:

- **Internal S3 bucket with short-lived presigned URL** (preferred)
- **Encrypted archive**: `7z a -p<passphrase> dump.7z dump.sql` — send
  me the passphrase through a different channel (Slack DM, SMS).
- **Internal file share** I can read (GDrive with ACL, Box, etc.).

## How I'll use it

I'll place the file under a gitignored `scripts/sync-from-prod/inbox/`
folder on my laptop, then run a local-only script that:

1. Reads the file **read-only** — no writes back to your prod.
2. TRUNCATEs my local dev DB tables and replaces them with your data
   inside a single transaction.
3. Anonymizes user names & emails deterministically (opt-in).
4. Resets every local user's password to a known dev value so I can
   log in as any synced user during testing (opt-in).

If anything fails, my local DB rolls back cleanly. None of this touches
prod.

## If you'd rather just give me a tunnel

If it's easier on your side, grant me temporary tunneled read access
and I'll do the dump myself:

```bash
# SSH tunnel:
ssh -L 5433:10.0.3.146:5432 <bastion-host>
# or SSM:
aws ssm start-session --target <instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["10.0.3.146"],"portNumber":["5432"],"localPortNumber":["5433"]}'
```

Either works. Tunneled pg_dump is identical to what's above — just
`--host=127.0.0.1 --port=5433`.

## Security note for when you're done

The existing `Dockerfile` in the contest repo has a plain-text prod
password on line 34. That's unrelated to this request but worth
flagging — whenever it's convenient, it should be moved to an env var
injected at runtime, and the prod DB password ideally rotated.

---

Thanks for the help — ping me when the file's ready.
