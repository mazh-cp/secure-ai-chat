#!/usr/bin/env bash
# Production CSS guardrail: ensure build emits CSS and prod server serves it.
# Fails if: no CSS link on homepage, CSS fetch not 200, or CSS body < 1000 bytes.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${CSS_CHECK_PORT:-3100}"
BASE_URL="http://127.0.0.1:${PORT}"
MIN_CSS_BYTES=1000

echo "==> check-css-prod: clean build..."
rm -rf .next
npm run build

echo "==> check-css-prod: start server on ${PORT}..."
(PORT="$PORT" npm run start > /tmp/check-css-server.log 2>&1) &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT

for i in $(seq 1 30); do
  if curl -s --max-time 2 "${BASE_URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  [[ $i -eq 30 ]] && { echo "FAIL: server did not become ready"; exit 1; }
  sleep 1
done

echo "==> check-css-prod: fetch homepage and extract CSS href..."
HTML=$(curl -fsS "${BASE_URL}/" || { echo "FAIL: homepage fetch failed"; exit 1; })
CSS_HREF=$(echo "$HTML" | grep -oE '/_next/static/css/[^"]+\.css' | head -1)
[[ -z "$CSS_HREF" ]] && { echo "FAIL: no /_next/static/css link on homepage"; exit 1; }

echo "==> check-css-prod: fetch CSS asset..."
CSS_URL="${BASE_URL}${CSS_HREF}"
HTTP_CODE=$(curl -s -o /tmp/check-css-asset.css -w "%{http_code}" "$CSS_URL")
[[ "$HTTP_CODE" != "200" ]] && { echo "FAIL: CSS request returned HTTP $HTTP_CODE"; exit 1; }

SIZE=$(wc -c < /tmp/check-css-asset.css)
[[ $SIZE -lt $MIN_CSS_BYTES ]] && { echo "FAIL: CSS size $SIZE < $MIN_CSS_BYTES bytes (empty or broken Tailwind?)"; exit 1; }

echo "==> check-css-prod: OK (CSS ${SIZE} bytes, 200)"
kill $PID 2>/dev/null || true
trap - EXIT
exit 0
