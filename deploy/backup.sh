#!/usr/bin/env bash
# Daily Postgres dump (+ optional uploads tarball). Example cron:
#   15 3 * * * /opt/aegis-chat/deploy/backup.sh >> /var/log/aegis-backup.log 2>&1
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

"${COMPOSE[@]}" exec -T db pg_dump -U "${POSTGRES_USER:-aegis}" "${POSTGRES_DB:-aegis}" \
  | gzip -c > "$FILE"

# Keep last 14 dumps
ls -1t "$OUT_DIR"/aegis-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "backup written: $FILE"
