#!/usr/bin/env bash
# Smoke: upload (store) returns JSON (never HTML), file persists, list returns file.
# Regression test for v1.0.13 blank screen: API must return JSON so frontend never calls .json() on HTML.
# Requires server at BASE_URL (e.g. npm run start). Uses X-Client-ID from /api/owner.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-30}"
FILE_ID="smoke-upload-$(date +%s)-$$"

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }

# 1. Health
say "1. Health check"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}/api/health")
[ "$status" = "200" ] || fail "Health returned $status"
ok "Health 200"

# 2. Owner id (for store/list)
say "2. Get owner_id"
OWNER_RESP=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}/api/owner")
OWNER_ID=$(echo "$OWNER_RESP" | grep -o '"owner_id":"[^"]*"' | cut -d'"' -f4)
[ -n "$OWNER_ID" ] || fail "Could not get owner_id from /api/owner: $OWNER_RESP"
ok "Owner: $OWNER_ID"

# 3. Store — must return JSON (no HTML); must have ok:true or success:true
say "3. POST /api/files/store (must return JSON, never HTML)"
store_resp=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $OWNER_ID" \
  -d "{\"fileId\":\"$FILE_ID\",\"fileName\":\"smoke-upload.txt\",\"fileContent\":\"Smoke upload regression test.\",\"fileType\":\"text/plain\",\"fileSize\":32,\"scanStatus\":\"pending\"}")

# Guard: response must not be HTML (would cause blank screen if frontend called response.json())
if echo "$store_resp" | grep -q '<!DOCTYPE\|<html'; then
  fail "Store returned HTML instead of JSON (would cause blank screen). Response: ${store_resp:0:200}"
fi
# Must be valid JSON with success
echo "$store_resp" | grep -qE '"ok":\s*true|"success":\s*true' || fail "Store did not return ok:true or success:true. Response: $store_resp"
ok "Store returned JSON with ok/success"

# 4. List — must return JSON; file must appear
say "4. GET /api/files/list (file must appear)"
list_resp=$(curl -s --max-time "$TIMEOUT" -H "X-Client-ID: $OWNER_ID" "${BASE_URL}/api/files/list")
if echo "$list_resp" | grep -q '<!DOCTYPE\|<html'; then
  fail "List returned HTML instead of JSON. Response: ${list_resp:0:200}"
fi
echo "$list_resp" | grep -q "$FILE_ID" || fail "List does not contain $FILE_ID. Response: ${list_resp:0:400}"
ok "List returned JSON and contains uploaded file"

say "Smoke upload regression: all checks passed."
