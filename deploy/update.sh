#!/usr/bin/env bash
# Pull latest code and rebuild the API on the VM.
# Run from repo root or from deploy/:
#   bash deploy/update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull --ff-only

echo "==> rebuild & restart"
cd "$ROOT/deploy"
docker compose up -d --build --remove-orphans

echo "==> health"
sleep 3
curl -fsS "https://${DOMAIN:-localhost}/health" || curl -fsS "http://127.0.0.1:3001/health" || true
echo
echo "Done. Windows clients pick up app updates from GitHub Releases separately."
