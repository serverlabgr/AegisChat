#!/usr/bin/env bash
# Daily Postgres dump + encrypted uploads tarball.
#   15 3 * * * /opt/aegis-chat/deploy/backup.sh >> /home/craccchat/aegis-backup.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
set -a
source .env
set +a

COMPOSE=(docker compose)
if [[ -f docker-compose.lan.yml ]] && docker compose -f docker-compose.lan.yml ps -q db >/dev/null 2>&1; then
  COMPOSE=(docker compose -f docker-compose.lan.yml)
elif [[ -f docker-compose.yml ]] && docker compose -f docker-compose.yml ps -q db >/dev/null 2>&1; then
  COMPOSE=(docker compose -f docker-compose.yml)
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/aegis-${STAMP}.sql.gz"
UPLOADS="$OUT_DIR/aegis-uploads-${STAMP}.tar.gz"

"${COMPOSE[@]}" exec -T db pg_dump -U "${POSTGRES_USER:-aegis}" "${POSTGRES_DB:-aegis}" \
  | gzip -c > "$FILE"

# Encrypted media volume (ciphertext only — still back it up)
API_CTR="$("${COMPOSE[@]}" ps -q api | head -n1)"
if [[ -n "$API_CTR" ]]; then
  docker run --rm --volumes-from "$API_CTR" -v "$OUT_DIR:/backup" alpine:3.20 \
    tar -czf "/backup/aegis-uploads-${STAMP}.tar.gz" -C /data uploads 2>/dev/null \
    || echo "uploads tar skipped (empty or missing)"
fi

# Keep last 14 dumps of each kind
ls -1t "$OUT_DIR"/aegis-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$OUT_DIR"/aegis-uploads-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "backup written: $FILE"
[[ -f "$UPLOADS" ]] && echo "uploads backup: $UPLOADS"
echo "Tip: copy $OUT_DIR to another PC occasionally (off-box)."
