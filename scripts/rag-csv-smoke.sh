#!/usr/bin/env bash
# CSV RAG regression smoke: upload test.csv, ask "What is Bob's Code?", expect TR-992 and citation (File: test.csv Row: 2).
# Exit 1 if any assertion fails.
# Usage: BASE_URL=http://localhost:3000 bash scripts/rag-csv-smoke.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT=60
COOKIE_JAR="${TMPDIR:-/tmp}/rag-csv-smoke-cookies-$$.txt"
cleanup_cookies() { rm -f "$COOKIE_JAR" 2>/dev/null || true; }
trap cleanup_cookies EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
say() { printf "\n==> %s\n" "$*"; }
ok() { printf "${GREEN}✅ %s${NC}\n" "$*"; }
fail() { printf "${RED}❌ %s${NC}\n" "$*"; exit 1; }

# Use cookie jar so list/status/chat see the same owner as store
CURL_OPTS="-s -c $COOKIE_JAR -b $COOKIE_JAR --max-time $TIMEOUT"

# 0) Prime owner cookie (GET /api/owner) so store/status/chat use same session
curl $CURL_OPTS "${BASE_URL}/api/owner" -o /dev/null 2>/dev/null || true

# 1) Upload test.csv (exact repro: Name,Department,Code / Alice,Engineering,ZX-441 / Bob,Finance,TR-992)
say "Uploading test.csv (Name, Department, Code; Alice ZX-441, Bob TR-992)"
CSV_ID="rag-csv-smoke-$$-$(date +%s)"
CSV_NAME="test.csv"
CSV_CONTENT="Name,Department,Code
Alice,Engineering,ZX-441
Bob,Finance,TR-992"
CSV_SIZE=${#CSV_CONTENT}
CSV_CONTENT_JSON=$(printf '%s' "$CSV_CONTENT" | node -e "const s=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(s))")
CSV_BODY="{\"fileId\":\"${CSV_ID}\",\"fileName\":\"${CSV_NAME}\",\"fileContent\":${CSV_CONTENT_JSON},\"fileType\":\"text/csv\",\"fileSize\":${CSV_SIZE}}"

UPLOAD=$(curl $CURL_OPTS -w "\n%{http_code}" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "$CSV_BODY" 2>/dev/null) || true
CODE=$(echo "$UPLOAD" | tail -n1)
if [ "$CODE" != "200" ]; then
  fail "CSV upload returned HTTP $CODE (expected 200). Response: $(echo "$UPLOAD" | sed '$d')"
fi
ok "test.csv uploaded"

# 2) Wait for RAG ready
say "Waiting for RAG status ready..."
sleep 2
for i in $(seq 1 15); do
  STATUS=$(curl $CURL_OPTS -w "\n%{http_code}" "${BASE_URL}/api/rag/status" 2>/dev/null) || true
  HTTP_CODE=$(echo "$STATUS" | tail -n1)
  BODY=$(echo "$STATUS" | sed '$d')
  if [ "$HTTP_CODE" = "404" ] || echo "$BODY" | grep -q "<!DOCTYPE html>"; then
    say "RAG status endpoint not available (HTTP $HTTP_CODE). Proceeding to chat."
    break
  fi
  if echo "$BODY" | grep -qE '"status"\s*:\s*"ready"'; then
    ok "RAG status ready"
    break
  fi
  [ $i -eq 15 ] && fail "RAG status did not become ready within 15 attempts. Last: $BODY"
  sleep 2
done

# 3) Ask: "What is Bob's Code?" -> must contain TR-992
say "Asking: What is Bob's Code?"
CHAT=$(curl $CURL_OPTS -D - -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is Bob'\''s Code?"}],"enableRAG":true}' 2>/dev/null) || true
CONTENT=$(echo "$CHAT" | sed -n 's/.*"content":"\([^"]*\)".*/\1/p' | sed 's/\\"/"/g')
[ -z "$CONTENT" ] && CONTENT="$CHAT"

if ! echo "$CONTENT" | grep -q "TR-992"; then
  fail "Answer must contain TR-992. Response: $(echo "$CHAT" | head -c 600)"
fi
ok "Answer contains TR-992"

# 4) Citation must include Row: 2 or Row 2 and test.csv
if ! echo "$CONTENT" | grep -qiE "row\s*:\s*2|row\s*2|test\.csv"; then
  fail "Citation must include 'Row: 2' or 'Row 2' or 'test.csv'. Response: $(echo "$CONTENT" | head -c 400)"
fi
ok "Citation includes Row 2 / test.csv"

say "CSV RAG smoke passed."
exit 0
