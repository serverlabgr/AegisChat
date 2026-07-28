#!/usr/bin/env bash
set -euo pipefail

LOGIN=$(curl -sS -m 15 -X POST http://127.0.0.1:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"changeme123"}')
echo "LOGIN=$LOGIN"

AT=$(printf '%s' "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [[ -z "$AT" ]]; then
  echo "NO_TOKEN"
  exit 1
fi

dd if=/dev/urandom of=/tmp/blob.bin bs=1024 count=64 status=none
UP=$(curl -sS -m 30 -X POST http://127.0.0.1:3001/media \
  -H "Authorization: Bearer $AT" \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @/tmp/blob.bin)
echo "UPLOAD=$UP"

ID=$(printf '%s' "$UP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
curl -sS -m 30 -o /tmp/blob.out -w "DOWNLOAD_HTTP=%{http_code} SIZE=%{size_download}\n" \
  -H "Authorization: Bearer $AT" \
  "http://127.0.0.1:3001/media/$ID"
