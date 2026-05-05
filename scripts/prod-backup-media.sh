#!/usr/bin/env bash
# Phase 8 — daily media + labels backup → R2
set -euo pipefail

DATE=$(date -u +%F)
BACKUP_DIR="/var/backups/ynot/media"
TAR_FILE="${BACKUP_DIR}/${DATE}.tar.gz"

mkdir -p "$BACKUP_DIR"

# Tar product images + label PDFs together (small total volume early on)
tar -czf "$TAR_FILE" \
  -C /var/lib/ynot media labels 2>/dev/null || true

aws s3 cp "$TAR_FILE" "s3://${R2_BUCKET}/media/${DATE}.tar.gz" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

find "$BACKUP_DIR" -name '*.tar.gz' -mtime +14 -delete

echo "[backup-media] OK ${DATE}"
