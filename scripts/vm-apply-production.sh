#!/usr/bin/env bash
set -euo pipefail
cd /opt/aegis-chat/deploy
if grep -q '^MAX_UPLOAD_BYTES=' .env; then
  sed -i 's/^MAX_UPLOAD_BYTES=.*/MAX_UPLOAD_BYTES=2147483648/' .env
else
  echo 'MAX_UPLOAD_BYTES=2147483648' >> .env
fi
grep MAX_UPLOAD_BYTES .env
chmod +x backup.sh update.sh
docker compose -f docker-compose.lan.yml up -d --build api
for i in $(seq 1 20); do
  st=$(docker inspect --format='{{.State.Health.Status}}' deploy-api-1 2>/dev/null || echo starting)
  echo "health=$st"
  [[ "$st" == "healthy" ]] && break
  sleep 3
done
curl -sS http://127.0.0.1:3001/health; echo
docker compose -f docker-compose.lan.yml exec -T api printenv MAX_UPLOAD_BYTES
./backup.sh
ls -lah backups | tail -8
