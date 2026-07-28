#!/usr/bin/env bash
set -euo pipefail

for i in $(seq 1 15); do
  st=$(docker inspect --format='{{.State.Health.Status}}' deploy-api-1 2>/dev/null || echo starting)
  echo "health=$st"
  [[ "$st" == "healthy" ]] && break
  sleep 4
done

curl -sS -m 5 http://127.0.0.1:3001/health
echo

cd /opt/aegis-chat/deploy
docker compose -f docker-compose.lan.yml exec -T api printenv MAX_UPLOAD_BYTES

docker compose -f docker-compose.lan.yml exec -T db psql -U aegis -d aegis <<'SQL'
UPDATE invites
SET max_uses = 1000,
    expires_at = now() + interval '365 days'
WHERE code = 'parea-x9f2';
SELECT code, max_uses, uses, expires_at FROM invites;
SQL

(crontab -l 2>/dev/null | grep -v backup.sh || true
 echo '15 3 * * * /opt/aegis-chat/deploy/backup.sh >> /home/craccchat/aegis-backup.log 2>&1'
) | crontab -
echo '--- crontab ---'
crontab -l

/opt/aegis-chat/deploy/backup.sh
ls -lh backups | tail -5

docker compose -f docker-compose.lan.yml ps
df -h /
