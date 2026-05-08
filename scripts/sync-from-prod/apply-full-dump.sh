#!/usr/bin/env bash
#
# apply-full-dump.sh
# ------------------
# Like apply-inbox.sh, but for **full dumps** (schema + data, COPY format).
#
# Default pg_dump (without --data-only --column-inserts) produces a file
# with CREATE TABLE / ALTER TABLE statements followed by `COPY ... FROM
# stdin` data blocks. Local already has the v2 schema with extra columns,
# so we can't apply the full dump as-is — we'd hit "table already exists"
# errors and the schema would diverge.
#
# This script:
#   1. Reads the dump.
#   2. Extracts ONLY the COPY blocks for tables we actually want
#      (Auth.js + drizzle_migrations skipped).
#   3. TRUNCATEs the corresponding local tables in reverse-FK order.
#   4. Streams the COPY blocks into psql inside a single transaction,
#      with FK checks suspended (session_replication_role = replica).
#   5. Runs post-process.sql to fix up v2-specific columns
#      (is_default, visibility, legacy judge seed, etc.).
#   6. Optionally anonymizes / resets passwords.
#
# Usage:
#   bash scripts/sync-from-prod/apply-full-dump.sh \
#        --file 'path/to/full-dump.sql' \
#        [--anonymize] [--reset-passwords PW] [--yes]
#
# Requires: $LOCAL_DATABASE_URL and `psql` on PATH.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Tables to extract from the dump, parent → child order. Auth.js tables
# (accounts, sessions, verification_tokens) and drizzle_migrations are
# deliberately omitted — they shouldn't propagate prod → local.
WANTED_TABLES=(
  users
  contests
  tracks
  contest_users
  teams
  submissions
  scores
  certificate_templates
)

# Reverse FK order for TRUNCATE (covers both copied and v2-only tables, so
# we start from a clean local state).
TRUNCATE_ORDER=(
  notifications
  team_invitations
  team_pitches
  media_assets
  announcements
  scores
  submissions
  certificate_templates
  contest_users
  teams
  tracks
  contests
  users
)

FILE=""
CONFIRM=1
ANONYMIZE=0
RESET_PW=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --yes) CONFIRM=0; shift ;;
    --anonymize) ANONYMIZE=1; shift ;;
    --reset-passwords) RESET_PW="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${LOCAL_DATABASE_URL:-}" ]]; then
  echo "LOCAL_DATABASE_URL is not set." >&2
  exit 1
fi

if [[ -z "$FILE" ]]; then
  echo "--file is required." >&2
  exit 1
fi
if [[ ! -f "$FILE" ]]; then
  echo "File does not exist: $FILE" >&2
  exit 1
fi

echo "Source dump:    $FILE"
echo "Destination:    $LOCAL_DATABASE_URL"

# --------------------------------------------------------------------
# 1. Extract COPY blocks into a temp file
# --------------------------------------------------------------------
EXTRACTED=$(mktemp -t contest-extract.XXXXXX.sql)
trap 'rm -f "$EXTRACTED"' EXIT

WANTED_REGEX=$(printf '|%s' "${WANTED_TABLES[@]}")
WANTED_REGEX="(${WANTED_REGEX:1})"   # users|contests|...

awk -v want="$WANTED_REGEX" '
  BEGIN { in_block = 0; matched = 0 }

  # Preamble SETs at the very top — keep, they normalize encoding etc.
  /^SET / && !seen_data { print; next }
  # SKIP the search_path reset: pg_dump sets it to "" so all references in
  # the dump are fully-qualified (public.foo). That break unqualified names
  # in our post-process.sql. We re-assert a sane search_path in the wrapper.
  /^SELECT pg_catalog\.set_config\(.search_path./ && !seen_data { next }
  /^SELECT pg_catalog\.set_config/ && !seen_data { print; next }

  # Start of a COPY block. Decide whether to keep based on table name.
  /^COPY public\./ {
    seen_data = 1
    # Match e.g. "COPY public.users (id, ...)"
    if (match($0, "^COPY public\\." want " ")) {
      print
      in_block = 1
      matched++
    } else {
      in_block = 0
    }
    next
  }

  # End-of-COPY marker: a single backslash-dot on its own line.
  in_block && /^\\\.$/ { print; in_block = 0; next }

  # Inside a kept COPY block — pass through every byte verbatim.
  in_block { print; next }

  # Everything else (CREATE TABLE, ALTER TABLE, comments, etc.) is dropped.
' "$FILE" > "$EXTRACTED"

EXTRACTED_BYTES=$(wc -c < "$EXTRACTED" | tr -d ' ')
EXTRACTED_TABLES=$(grep -c '^COPY public\.' "$EXTRACTED" || true)
echo "Extracted:      $EXTRACTED_BYTES bytes, $EXTRACTED_TABLES table(s)."

if [[ "$EXTRACTED_TABLES" -eq 0 ]]; then
  echo "No matching COPY blocks found — nothing to import." >&2
  exit 1
fi

# --------------------------------------------------------------------
# 2. Build the wrapper transaction
# --------------------------------------------------------------------
APPLY=$(mktemp -t contest-apply.XXXXXX.sql)
trap 'rm -f "$EXTRACTED" "$APPLY"' EXIT

{
  echo "BEGIN;"
  echo "SET session_replication_role = 'replica';"
  echo "SET search_path = public, pg_catalog;"
  echo "-- Clear local data (reverse FK order):"
  for t in "${TRUNCATE_ORDER[@]}"; do
    echo "TRUNCATE TABLE \"$t\" RESTART IDENTITY CASCADE;"
  done
  echo "-- Prod data (extracted COPY blocks):"
  cat "$EXTRACTED"
  echo ""
  echo "-- Reassert search_path; the dump may have reset it.";
  echo "SET search_path = public, pg_catalog;"
  echo "-- Post-process:"
  cat "$HERE/post-process.sql"
  if [[ $ANONYMIZE -eq 1 ]]; then
    echo "-- Anonymize:"
    cat "$HERE/anonymize.sql"
  fi
  echo "SET session_replication_role = 'origin';"
  echo "COMMIT;"
} > "$APPLY"

# --------------------------------------------------------------------
# 3. Confirm
# --------------------------------------------------------------------
if [[ $CONFIRM -eq 1 ]]; then
  echo ""
  echo "About to TRUNCATE & replace the following local tables:"
  for t in "${TRUNCATE_ORDER[@]}"; do echo "  $t"; done
  printf "Proceed? [y/N] "
  read -r ANS
  if [[ "$ANS" != "y" && "$ANS" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# --------------------------------------------------------------------
# 4. Apply
# --------------------------------------------------------------------
if ! psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$APPLY" > /dev/null; then
  echo "psql apply failed. Transaction rolled back; local DB unchanged." >&2
  exit 3
fi

if [[ -n "$RESET_PW" ]]; then
  echo "Resetting passwords…"
  node "$HERE/reset-passwords.mjs" "$LOCAL_DATABASE_URL" "$RESET_PW"
fi

# --------------------------------------------------------------------
# 5. Report
# --------------------------------------------------------------------
echo ""
echo "===================================================="
echo "  Import complete. Final local row counts:"
echo "===================================================="
for t in users contests tracks contest_users teams submissions scores certificate_templates announcements notifications media_assets team_pitches team_invitations; do
  count=$(psql "$LOCAL_DATABASE_URL" -tA -c "SELECT COUNT(*) FROM \"$t\"" 2>/dev/null || echo "n/a")
  printf "  %-25s %s\n" "$t" "$count"
done
echo "===================================================="
