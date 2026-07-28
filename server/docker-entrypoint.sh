#!/bin/sh
set -e

echo "Aegis: waiting for database…"
# migrate.ts opens the pool; retry a few times if Postgres is still booting
i=0
until npx tsx src/migrate.ts; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Aegis: migrate failed after retries" >&2
    exit 1
  fi
  echo "Aegis: DB not ready, retry $i/30…"
  sleep 2
done

if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "Aegis: seeding…"
  npx tsx src/seed.ts || true
fi

echo "Aegis: starting API"
exec npx tsx src/index.ts
