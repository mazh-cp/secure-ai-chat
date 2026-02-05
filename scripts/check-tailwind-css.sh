#!/usr/bin/env bash
# Dev: verify served CSS contains Tailwind (--tw- or preflight) and is substantial.
# Assumes dev server is already running (e.g. npm run dev). Use BASE_URL to override.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
MIN_CSS_BYTES=40000

echo "==> check-tailwind-css (dev): fetch homepage from ${BASE_URL}..."
HTML=$(curl -fsS "${BASE_URL}/" || { echo "FAIL: homepage fetch failed"; exit 1; })

# Dev uses /_next/static/chunks/*.css, prod uses /_next/static/css/*.css
CSS_HREF=$(echo "$HTML" | grep -oE '/_next/static/(css|chunks)/[^"]+\.css' | head -1)
[[ -z "$CSS_HREF" ]] && { echo "FAIL: no CSS link on homepage"; exit 1; }

echo "==> check-tailwind-css: fetch CSS ${CSS_HREF}..."
curl -fsS "${BASE_URL}${CSS_HREF}" -o /tmp/check-tailwind-dev.css

SIZE=$(wc -c < /tmp/check-tailwind-dev.css)
if [[ $SIZE -lt $MIN_CSS_BYTES ]]; then
  echo "FAIL: CSS size $SIZE < $MIN_CSS_BYTES bytes (Tailwind likely empty or minimal)"
  exit 1
fi

if grep -q -- '--tw-\|preflight' /tmp/check-tailwind-dev.css; then
  echo "==> check-tailwind-css: OK (${SIZE} bytes, Tailwind markers present)"
  exit 0
fi

echo "FAIL: CSS does not contain --tw- or preflight (Tailwind not present?)"
exit 1
