#!/usr/bin/env bash
# Phase 8 — daily Postgres backup → /var/backups + Cloudflare R2
# Runs inside ynot-worker container at 03:00 UTC via node-cron.
set -euo pipefail

DATE=$(date -u +%F)
BACKUP_DIR="/var/backups/ynot/postgres"
DUMP_FILE="${BACKUP_DIR}/${DATE}.dump"

mkdir -p "$BACKUP_DIR"

# Use DATABASE_URL (already in env) so we don't duplicate creds
export PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
PGUSER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
PGHOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
PGDB=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+)(\?.*)?|\1|')

pg_dump -h "$PGHOST" -U "$PGUSER" -F custom -f "$DUMP_FILE" "$PGDB"
gzip -9 "$DUMP_FILE"
DUMP_FILE_GZ="${DUMP_FILE}.gz"

# Upload to R2 (S3-compatible)
aws s3 cp "$DUMP_FILE_GZ" "s3://${R2_BUCKET}/postgres/${DATE}.dump.gz" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

# Local retention: keep last 30 days
find "$BACKUP_DIR" -name '*.dump.gz' -mtime +30 -delete

echo "[backup-postgres] OK ${DATE}"
