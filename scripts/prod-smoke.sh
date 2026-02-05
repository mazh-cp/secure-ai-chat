#!/usr/bin/env bash
# prod-smoke.sh — Validates a running production server (curl-based).
# Requires only bash + curl. Set BASE_URL to the server root (default http://localhost:3000).
# Usage: BASE_URL=http://localhost:3000 bash scripts/prod-smoke.sh
#        (after starting server with scripts/run-local-prod.sh, use same port in BASE_URL)

set -euo pipefail

# Default port 3000 if BASE_URL not set
BASE_URL="${BASE_URL:-http://localhost:3000}"
# Strip trailing slash
BASE_URL="${BASE_URL%/}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

FAILED=0

check() {
  local method="$1"
  local path="$2"
  local expect_code="${3:-200}"
  local expect_body="${4:-}"
  local url="${BASE_URL}${path}"
  local code body
  code=$(curl -s -o /tmp/prod_smoke_body.txt -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  body=""
  [ -f /tmp/prod_smoke_body.txt ] && body=$(cat /tmp/prod_smoke_body.txt)

  if [ "$code" = "$expect_code" ]; then
    if [ -n "$expect_body" ]; then
      if echo "$body" | grep -q "$expect_body"; then
        printf "${GREEN}PASS${NC} %s %s -> %s (body contains '%s')\n" "$method" "$path" "$code" "$expect_body"
        return 0
      else
        printf "${RED}FAIL${NC} %s %s -> %s (expected body to contain '%s')\n" "$method" "$path" "$code" "$expect_body"
        FAILED=1
        return 1
      fi
    else
      printf "${GREEN}PASS${NC} %s %s -> %s\n" "$method" "$path" "$code"
      return 0
    fi
  else
    printf "${RED}FAIL${NC} %s %s -> %s (expected %s)\n" "$method" "$path" "$code" "$expect_code"
    FAILED=1
    return 1
  fi
}

echo "Prod smoke: BASE_URL=$BASE_URL"
echo ""

# GET / -> 200 and contains <html
code=$(curl -s -o /tmp/prod_smoke_home.txt -w "%{http_code}" --max-time 10 "$BASE_URL/" 2>/dev/null || echo "000")
body=""
[ -f /tmp/prod_smoke_home.txt ] && body=$(cat /tmp/prod_smoke_home.txt)
if [ "$code" = "200" ] && echo "$body" | grep -qi "<html"; then
  printf "${GREEN}PASS${NC} GET / -> 200 (body contains <html)\n"
else
  printf "${RED}FAIL${NC} GET / -> %s or body missing <html\n" "$code"
  FAILED=1
fi

# GET /api/health -> 200 and JSON contains "ok" or "status"
code=$(curl -s -o /tmp/prod_smoke_health.txt -w "%{http_code}" --max-time 10 "$BASE_URL/api/health" 2>/dev/null || echo "000")
body=""
[ -f /tmp/prod_smoke_health.txt ] && body=$(cat /tmp/prod_smoke_health.txt)
if [ "$code" = "200" ] && (echo "$body" | grep -q '"ok"' || echo "$body" | grep -q '"status"'); then
  printf "${GREEN}PASS${NC} GET /api/health -> 200 (JSON has ok/status)\n"
else
  printf "${RED}FAIL${NC} GET /api/health -> %s or body missing ok/status\n" "$code"
  FAILED=1
fi

# GET /files -> 200 (page exists in this app)
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/files" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  printf "${GREEN}PASS${NC} GET /files -> 200\n"
else
  printf "${RED}FAIL${NC} GET /files -> %s (expected 200)\n" "$code"
  FAILED=1
fi

# GET /settings -> 200
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/settings" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  printf "${GREEN}PASS${NC} GET /settings -> 200\n"
else
  printf "${RED}FAIL${NC} GET /settings -> %s (expected 200)\n" "$code"
  FAILED=1
fi

# Chat is on / in this app (no separate /chat route); / already validated above.

rm -f /tmp/prod_smoke_body.txt /tmp/prod_smoke_home.txt /tmp/prod_smoke_health.txt

echo ""
if [ $FAILED -eq 0 ]; then
  echo "Prod smoke: all checks PASSED."
  exit 0
else
  echo "Prod smoke: one or more checks FAILED."
  exit 1
fi
