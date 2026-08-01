#!/usr/bin/env bash
# Rebuild API on the LAN VM (docker-compose.lan.yml).
# Prefer syncing code from your PC (no .git required on the VM):
#   scp -r server deploy/docker-compose.lan.yml craccchat@VM:/opt/aegis-chat/...
#   ssh … 'bash /opt/aegis-chat/deploy/update.sh'
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/deploy"

COMPOSE=(docker compose -f docker-compose.lan.yml)
if [[ ! -f docker-compose.lan.yml ]]; then
  COMPOSE=(docker compose)
fi

if [[ -d "$ROOT/.git" ]]; then
  echo "==> git pull"
  git -C "$ROOT" pull --ff-only || echo "(git pull skipped)"
else
  echo "==> no .git — using files already on disk"
fi

echo "==> rebuild & restart (LAN compose)"
"${COMPOSE[@]}" up -d --build --remove-orphans

echo "==> health"
sleep 3
curl -fsS "http://127.0.0.1:3001/health" || true
echo
echo "Done. Windows clients update from GitHub Releases separately."
