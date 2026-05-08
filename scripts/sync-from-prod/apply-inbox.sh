#!/usr/bin/env bash
#
# apply-inbox.sh
# --------------
# Pick up a prod dump from scripts/sync-from-prod/inbox/, verify its
# checksum if one was provided, and apply it to the local DB via
# sync.sh --apply-only.
#
# Common usage:
#
#   # Auto-pick the newest file in inbox/, ask before applying:
#   bash scripts/sync-from-prod/apply-inbox.sh
#
#   # Explicit file + anonymize + reset passwords:
#   bash scripts/sync-from-prod/apply-inbox.sh \
#        --file inbox/contest-prod-dump-20260424-1430.sql.gz \
#        --anonymize \
#        --reset-passwords "dev123456"
#
# Requires: $LOCAL_DATABASE_URL.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INBOX="${HERE}/inbox"

FILE=""
SHASUM_EXPECTED=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --sha256) SHASUM_EXPECTED="$2"; shift 2 ;;
    --yes|--anonymize|--keep-local-contests) EXTRA_ARGS+=("$1"); shift ;;
    --reset-passwords) EXTRA_ARGS+=("$1" "$2"); shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# Pick the newest dump in inbox/ if none specified.
if [[ -z "$FILE" ]]; then
  # -1: one per line. Sort by mtime desc.
  FILE=$(ls -t "$INBOX"/contest-prod-dump-*.sql "$INBOX"/contest-prod-dump-*.sql.gz 2>/dev/null | head -n1 || true)
  if [[ -z "$FILE" ]]; then
    echo "No dump found in $INBOX/"
    echo "Expected filenames like contest-prod-dump-YYYYMMDD-HHMM.sql[.gz]"
    exit 1
  fi
  echo "Auto-selected newest: $FILE"
fi

if [[ ! -f "$FILE" ]]; then
  echo "File does not exist: $FILE" >&2
  exit 1
fi

# Checksum verification (optional but recommended).
if [[ -n "$SHASUM_EXPECTED" ]]; then
  ACTUAL=$(shasum -a 256 "$FILE" | awk '{print $1}')
  if [[ "$ACTUAL" != "$SHASUM_EXPECTED" ]]; then
    echo "SHA-256 mismatch!"
    echo "  expected: $SHASUM_EXPECTED"
    echo "  actual:   $ACTUAL"
    echo "Refusing to apply — file may be corrupt or tampered with."
    exit 2
  fi
  echo "SHA-256 verified: $ACTUAL"
fi

# Decompress into a temp file if needed.
APPLY_FILE="$FILE"
CLEANUP=""
case "$FILE" in
  *.gz)
    TMP=$(mktemp -t contest-prod-dump.XXXXXX.sql)
    echo "Decompressing → $TMP"
    gunzip -c "$FILE" > "$TMP"
    APPLY_FILE="$TMP"
    CLEANUP="$TMP"
    ;;
esac
trap '[[ -n "$CLEANUP" ]] && rm -f "$CLEANUP"' EXIT

# Sanity-check the dump contains INSERTs.
INSERT_COUNT=$(grep -c '^INSERT INTO' "$APPLY_FILE" || true)
echo "Dump contains $INSERT_COUNT INSERT statements."
if [[ "$INSERT_COUNT" -lt 1 ]]; then
  echo "No INSERTs found — looks like this file isn't a data dump. Stopping." >&2
  exit 1
fi

# Hand off to sync.sh for the actual apply.
bash "$HERE/sync.sh" --apply-only "$APPLY_FILE" "${EXTRA_ARGS[@]}"
