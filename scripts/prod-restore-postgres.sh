#!/usr/bin/env bash
# Phase 8 — restore Postgres from a R2 dump.
# Usage: ./scripts/prod-restore-postgres.sh 2026-05-04
set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 YYYY-MM-DD" >&2
  exit 1
fi

DATE="$1"
TMP="/tmp/ynot-restore-${DATE}"
mkdir -p "$TMP"
DUMP_GZ="${TMP}/${DATE}.dump.gz"

aws s3 cp "s3://${R2_BUCKET}/postgres/${DATE}.dump.gz" "$DUMP_GZ" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

gunzip -f "$DUMP_GZ"
DUMP="${TMP}/${DATE}.dump"

export PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
PGUSER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
PGHOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
PGDB=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+)(\?.*)?|\1|')

echo "[restore] About to restore ${DATE} into ${PGDB}@${PGHOST}. Existing data will be dropped."
read -p "Type 'yes' to proceed: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "[restore] Aborted."
  exit 1
fi

pg_restore -h "$PGHOST" -U "$PGUSER" -d "$PGDB" --clean --if-exists "$DUMP"

rm -rf "$TMP"
echo "[restore] OK ${DATE}"
