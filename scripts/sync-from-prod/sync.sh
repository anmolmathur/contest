#!/usr/bin/env bash
#
# sync-from-prod/sync.sh
# ----------------------
# Pull production contest data into the local dev DB so you can test against
# real-ish state. Data only — never schema. The script:
#
#   1. Dumps selected tables from $PROD_DATABASE_URL to a timestamped file
#      under scripts/sync-from-prod/backups/.
#   2. Shows you the dump size and per-table row counts.
#   3. Asks for confirmation (unless --yes).
#   4. Wraps the import in a single transaction against $LOCAL_DATABASE_URL:
#        TRUNCATE local tables (in reverse FK order)
#        → apply the dump
#        → run post-process.sql (mentor-role compat, default contest, etc.)
#        → optional anonymization
#        → optional password reset
#   5. Prints final row counts.
#
# Data flow:
#   prod DB (READ-ONLY)  →  ./backups/prod-YYYYMMDD-HHMMSS.sql  →  local DB
#
# Requirements:
#   - psql + pg_dump (matching your PG major version) on PATH
#   - Reachable connection strings for both prod and local
#
# Usage:
#   PROD_DATABASE_URL="postgres://ro_user:pw@prod-host:5432/dbname" \
#   LOCAL_DATABASE_URL="postgres://n8nuser:pw@localhost:5432/hackathon_db" \
#     scripts/sync-from-prod/sync.sh
#
# Flags:
#   --yes                    skip the confirmation prompt
#   --dump-only              just produce the .sql dump and exit (no import)
#   --apply-only FILE        skip the dump step; apply an existing dump file
#   --anonymize              scramble names/emails after import (see post-process.sql)
#   --reset-passwords PW     set every user's password to PW (bcrypt-hashed)
#   --keep-local-contests    don't truncate — merge (may hit PK conflicts)
#   --tables T1,T2,...       override the table set (dangerous)
#
# Exit codes: 0 ok, 1 usage, 2 prod dump failed, 3 local apply failed.

set -euo pipefail

# --------------------------------------------------------------------
# Config
# --------------------------------------------------------------------

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${HERE}/backups"
mkdir -p "$BACKUP_DIR"

# Tables to sync, in INSERT-safe (parent→child) order.
# Auth.js tables deliberately omitted — syncing sessions would break your
# logged-in state locally.
DEFAULT_TABLES=(
  users
  contests
  tracks
  contest_users
  teams
  submissions
  scores
  certificate_templates
  announcements
  media_assets
  team_pitches
  team_invitations
  notifications
)

# Tables we'll TRUNCATE locally before import. Reverse FK order so
# cascades aren't needed.
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

# --------------------------------------------------------------------
# Parse flags
# --------------------------------------------------------------------

CONFIRM=1
DUMP_ONLY=0
APPLY_FILE=""
ANONYMIZE=0
RESET_PW=""
KEEP_LOCAL=0
TABLES=("${DEFAULT_TABLES[@]}")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) CONFIRM=0; shift ;;
    --dump-only) DUMP_ONLY=1; shift ;;
    --apply-only) APPLY_FILE="${2:-}"; shift 2 ;;
    --anonymize) ANONYMIZE=1; shift ;;
    --reset-passwords) RESET_PW="${2:-}"; shift 2 ;;
    --keep-local-contests) KEEP_LOCAL=1; shift ;;
    --tables) IFS=',' read -r -a TABLES <<< "${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,45p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# --------------------------------------------------------------------
# Preflight
# --------------------------------------------------------------------

require_env() {
  if [[ -z "${!1:-}" ]]; then
    echo "Required env var $1 is not set." >&2
    exit 1
  fi
}

if [[ $DUMP_ONLY -eq 0 ]]; then
  require_env LOCAL_DATABASE_URL
fi
if [[ -z "$APPLY_FILE" ]]; then
  require_env PROD_DATABASE_URL
fi

for bin in psql pg_dump; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Required tool '$bin' not found on PATH." >&2
    exit 1
  fi
done

echo "===================================================="
echo "  Contest Platform :: prod → local sync"
echo "===================================================="
echo "  Backup dir:    $BACKUP_DIR"
echo "  Tables:        ${TABLES[*]}"
echo "  Dump only:     $([[ $DUMP_ONLY -eq 1 ]] && echo yes || echo no)"
echo "  Apply file:    ${APPLY_FILE:-<dump fresh>}"
echo "  Anonymize:     $([[ $ANONYMIZE -eq 1 ]] && echo yes || echo no)"
echo "  Reset pw:      $([[ -n "$RESET_PW" ]] && echo yes || echo no)"
echo "  Keep local:    $([[ $KEEP_LOCAL -eq 1 ]] && echo yes || echo no)"
echo "----------------------------------------------------"

# --------------------------------------------------------------------
# Step 1: dump from prod (unless --apply-only)
# --------------------------------------------------------------------

DUMP_FILE=""
if [[ -n "$APPLY_FILE" ]]; then
  DUMP_FILE="$APPLY_FILE"
  if [[ ! -f "$DUMP_FILE" ]]; then
    echo "Apply file does not exist: $DUMP_FILE" >&2
    exit 1
  fi
  echo "Using existing dump: $DUMP_FILE"
else
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  DUMP_FILE="${BACKUP_DIR}/prod-${TIMESTAMP}.sql"
  echo "Dumping from prod → $DUMP_FILE"
  echo "  (read-only; no writes to prod)"

  # Build pg_dump table args
  TABLE_ARGS=()
  for t in "${TABLES[@]}"; do
    TABLE_ARGS+=(--table="public.$t")
  done

  # --column-inserts makes the dump portable across minor schema differences.
  # If prod doesn't have a column you added locally, psql just omits it.
  # --no-owner / --no-privileges so the load doesn't try to GRANT anything.
  # --data-only because schema is already in local (via drizzle migrations).
  # --disable-triggers to quiet cascades while we load.
  if ! pg_dump \
    --dbname="$PROD_DATABASE_URL" \
    --data-only \
    --column-inserts \
    --no-owner \
    --no-privileges \
    --disable-triggers \
    "${TABLE_ARGS[@]}" \
    > "$DUMP_FILE" 2>"${DUMP_FILE}.err"
  then
    echo "pg_dump failed. See ${DUMP_FILE}.err" >&2
    exit 2
  fi
  # pg_dump writes stderr warnings even on success; show them but don't fail.
  if [[ -s "${DUMP_FILE}.err" ]]; then
    echo "  pg_dump notes:"
    sed 's/^/    /' "${DUMP_FILE}.err"
  fi
  rm -f "${DUMP_FILE}.err"

  DUMP_BYTES=$(wc -c < "$DUMP_FILE" | tr -d ' ')
  DUMP_ROWS=$(grep -c '^INSERT INTO' "$DUMP_FILE" || true)
  echo "  size:  $DUMP_BYTES bytes"
  echo "  rows:  $DUMP_ROWS inserts"
fi

if [[ $DUMP_ONLY -eq 1 ]]; then
  echo "--dump-only: stopping after dump."
  echo "Dump is at: $DUMP_FILE"
  exit 0
fi

# --------------------------------------------------------------------
# Step 2: confirm
# --------------------------------------------------------------------

echo ""
echo "About to apply the dump to:"
echo "    $LOCAL_DATABASE_URL"
if [[ $KEEP_LOCAL -eq 0 ]]; then
  echo "This will TRUNCATE the following tables first (in FK order):"
  for t in "${TRUNCATE_ORDER[@]}"; do echo "    $t"; done
else
  echo "--keep-local-contests: no TRUNCATE; expect PK conflicts if rows clash."
fi
echo ""

if [[ $CONFIRM -eq 1 ]]; then
  printf "Proceed? [y/N] "
  read -r ANS
  if [[ "$ANS" != "y" && "$ANS" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# --------------------------------------------------------------------
# Step 3: apply in a transaction
# --------------------------------------------------------------------

TEMP_APPLY=$(mktemp -t contest-sync-apply.XXXXXX.sql)
trap 'rm -f "$TEMP_APPLY"' EXIT

{
  echo "BEGIN;"
  echo "SET session_replication_role = 'replica';"  # suspend FK checks during bulk load

  if [[ $KEEP_LOCAL -eq 0 ]]; then
    echo "-- Clear local data (reverse FK order):"
    for t in "${TRUNCATE_ORDER[@]}"; do
      echo "TRUNCATE TABLE \"$t\" RESTART IDENTITY CASCADE;"
    done
  fi

  echo "-- Dumped data:"
  cat "$DUMP_FILE"

  echo ""
  echo "-- Post-process:"
  cat "$HERE/post-process.sql"

  if [[ $ANONYMIZE -eq 1 ]]; then
    echo ""
    echo "-- Anonymize:"
    cat "$HERE/anonymize.sql"
  fi

  echo ""
  echo "SET session_replication_role = 'origin';"
  echo "COMMIT;"
} > "$TEMP_APPLY"

# Password reset happens AFTER the transaction commits so we can use a Node
# helper to bcrypt the supplied plaintext (Postgres alone can't).
if ! psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$TEMP_APPLY" > /dev/null; then
  echo "psql apply failed. Transaction was rolled back; local DB unchanged." >&2
  exit 3
fi

if [[ -n "$RESET_PW" ]]; then
  echo ""
  echo "Resetting every user's password to the supplied value (bcrypt hashing via Node)…"
  node "$HERE/reset-passwords.mjs" "$LOCAL_DATABASE_URL" "$RESET_PW"
fi

# --------------------------------------------------------------------
# Step 4: report
# --------------------------------------------------------------------

echo ""
echo "===================================================="
echo "  Import complete. Final local row counts:"
echo "===================================================="
for t in "${TABLES[@]}"; do
  count=$(psql "$LOCAL_DATABASE_URL" -tA -c "SELECT COUNT(*) FROM \"$t\"")
  printf "  %-25s %s\n" "$t" "$count"
done
echo "===================================================="
echo ""
echo "Dump preserved at: $DUMP_FILE"
if [[ $ANONYMIZE -eq 1 ]]; then
  echo "NOTE: user names/emails have been anonymized in the local copy."
fi
if [[ -n "$RESET_PW" ]]; then
  echo "NOTE: every user's password has been reset — log in with the value you supplied."
fi
