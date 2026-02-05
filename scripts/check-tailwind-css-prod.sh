#!/usr/bin/env bash
# Prod: clean build, start server, verify served CSS contains Tailwind and is substantial.
# Fails if: no CSS link, CSS not 200, size < 50000, or missing --tw- / preflight.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${TAILWIND_CHECK_PORT:-3101}"
BASE_URL="http://127.0.0.1:${PORT}"
MIN_CSS_BYTES=40000

echo "==> check-tailwind-css-prod: clean build..."
rm -rf .next
npm run build

echo "==> check-tailwind-css-prod: start server on ${PORT}..."
(PORT="$PORT" npm run start > /tmp/check-tailwind-prod-server.log 2>&1) &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT

for i in $(seq 1 30); do
  if curl -s --max-time 2 "${BASE_URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  [[ $i -eq 30 ]] && { echo "FAIL: server did not become ready"; exit 1; }
  sleep 1
done

echo "==> check-tailwind-css-prod: fetch homepage and extract CSS href..."
HTML=$(curl -fsS "${BASE_URL}/" || { echo "FAIL: homepage fetch failed"; exit 1; })
CSS_HREF=$(echo "$HTML" | grep -oE '/_next/static/css/[^"]+\.css' | head -1)
[[ -z "$CSS_HREF" ]] && { echo "FAIL: no /_next/static/css link on homepage"; exit 1; }

echo "==> check-tailwind-css-prod: fetch CSS asset..."
HTTP_CODE=$(curl -s -o /tmp/check-tailwind-prod.css -w "%{http_code}" "${BASE_URL}${CSS_HREF}")
[[ "$HTTP_CODE" != "200" ]] && { echo "FAIL: CSS request returned HTTP $HTTP_CODE"; exit 1; }

SIZE=$(wc -c < /tmp/check-tailwind-prod.css)
[[ $SIZE -lt $MIN_CSS_BYTES ]] && { echo "FAIL: CSS size $SIZE < $MIN_CSS_BYTES bytes"; exit 1; }

if ! grep -q -- '--tw-\|preflight' /tmp/check-tailwind-prod.css; then
  echo "FAIL: CSS does not contain --tw- or preflight (Tailwind not present)"
  exit 1
fi

echo "==> check-tailwind-css-prod: OK (CSS ${SIZE} bytes, 200, Tailwind markers present)"
kill $PID 2>/dev/null || true
trap - EXIT
exit 0
