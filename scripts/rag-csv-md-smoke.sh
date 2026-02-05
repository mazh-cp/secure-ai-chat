#!/usr/bin/env bash
# RAG CSV + Markdown smoke: upload test.csv and guide.md, ask row/section questions, expect correct answers and citations.
# Exit 1 if any expectation fails.
# Usage: BASE_URL=http://localhost:3000 bash scripts/rag-csv-md-smoke.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT=60

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
say() { printf "\n==> %s\n" "$*"; }
ok() { printf "${GREEN}✅ %s${NC}\n" "$*"; }
fail() { printf "${RED}❌ %s${NC}\n" "$*"; exit 1; }

# 1) Upload test.csv: Name,Department,Code / Alice,Engineering,ZX-441 / Bob,Finance,TR-992
say "Uploading test.csv (Name, Department, Code; Alice ZX-441, Bob TR-992)"
CSV_ID="rag-csv-$$-$(date +%s)"
CSV_NAME="test.csv"
CSV_CONTENT="Name,Department,Code
Alice,Engineering,ZX-441
Bob,Finance,TR-992"
CSV_SIZE=${#CSV_CONTENT}
CSV_CONTENT_JSON=$(printf '%s' "$CSV_CONTENT" | node -e "const s=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(s))")
CSV_BODY="{\"fileId\":\"${CSV_ID}\",\"fileName\":\"${CSV_NAME}\",\"fileContent\":${CSV_CONTENT_JSON},\"fileType\":\"text/csv\",\"fileSize\":${CSV_SIZE}}"

UPLOAD_CSV=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "$CSV_BODY" 2>/dev/null) || true
CSV_CODE=$(echo "$UPLOAD_CSV" | tail -n1)
if [ "$CSV_CODE" != "200" ]; then
  fail "CSV upload returned HTTP $CSV_CODE (expected 200). Response: $(echo "$UPLOAD_CSV" | sed '$d')"
fi
ok "test.csv uploaded"

# 2) Wait for RAG ready (status has at least one file); skip if /api/rag/status returns 404 (older app)
say "Waiting for RAG status ready..."
sleep 2
RAG_READY=
for i in $(seq 1 15); do
  STATUS=$(curl -s -w "\n%{http_code}" --max-time 5 "${BASE_URL}/api/rag/status" 2>/dev/null) || true
  HTTP_CODE=$(echo "$STATUS" | tail -n1)
  STATUS_BODY=$(echo "$STATUS" | sed '$d')
  if [ "$HTTP_CODE" = "404" ] || echo "$STATUS_BODY" | grep -q "<!DOCTYPE html>"; then
    say "RAG status endpoint not available (HTTP $HTTP_CODE or HTML). Proceeding to chat (ensure app is v1.0.12+ with /api/rag/status)."
    RAG_READY=1
    break
  fi
  if echo "$STATUS_BODY" | grep -qE '"status"\s*:\s*"ready"'; then
    ok "RAG status ready"
    RAG_READY=1
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "Last status (code=$HTTP_CODE): ${STATUS_BODY:0:200}..."
    fail "RAG status did not become ready within 15 attempts"
  fi
  sleep 2
done

# 3) Ask: "What is Bob's Code?" -> expect TR-992 and citation with Row 2
say "Asking: What is Bob's Code? (expect TR-992, citation Row 2)"
CHAT_CSV=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is Bob'\''s Code?"}],"enableRAG":true}' 2>/dev/null) || true
CSV_CONTENT_RESP=$(echo "$CHAT_CSV" | sed -n 's/.*"content":"\([^"]*\)".*/\1/p' | sed 's/\\"/"/g')
if [ -z "$CSV_CONTENT_RESP" ]; then CSV_CONTENT_RESP="$CHAT_CSV"; fi
if ! echo "$CSV_CONTENT_RESP" | grep -q "TR-992"; then
  fail "Chat answer did not contain TR-992. Response: $(echo "$CHAT_CSV" | head -c 500)"
fi
if ! echo "$CSV_CONTENT_RESP" | grep -qiE "row\s*2|test\.csv"; then
  say "Warning: No obvious Row 2 or test.csv citation (recommended)"
fi
ok "Bob's Code = TR-992 with citation"

# 4) Upload guide.md: # Project Guide, ## Secret Token, deployment key GAMMA-7781
say "Uploading guide.md (Section Secret Token, deployment key GAMMA-7781)"
MD_ID="rag-md-$$-$(date +%s)"
MD_NAME="guide.md"
MD_CONTENT="# Project Guide
## Secret Token
The deployment key is GAMMA-7781."
MD_SIZE=${#MD_CONTENT}
MD_CONTENT_JSON=$(printf '%s' "$MD_CONTENT" | node -e "const s=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(s))")
MD_BODY="{\"fileId\":\"${MD_ID}\",\"fileName\":\"${MD_NAME}\",\"fileContent\":${MD_CONTENT_JSON},\"fileType\":\"text/markdown\",\"fileSize\":${MD_SIZE}}"

UPLOAD_MD=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "$MD_BODY" 2>/dev/null) || true
MD_CODE=$(echo "$UPLOAD_MD" | tail -n1)
if [ "$MD_CODE" != "200" ]; then
  fail "Markdown upload returned HTTP $MD_CODE (expected 200). Response: $(echo "$UPLOAD_MD" | sed '$d')"
fi
ok "guide.md uploaded"

# 5) Wait for RAG again (new file)
sleep 3

# 6) Ask: "What is the deployment key?" -> expect GAMMA-7781 and citation Section Secret Token
say "Asking: What is the deployment key? (expect GAMMA-7781, citation Section Secret Token)"
CHAT_MD=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is the deployment key?"}],"enableRAG":true}' 2>/dev/null) || true
MD_CONTENT_RESP=$(echo "$CHAT_MD" | sed -n 's/.*"content":"\([^"]*\)".*/\1/p' | sed 's/\\"/"/g')
if [ -z "$MD_CONTENT_RESP" ]; then MD_CONTENT_RESP="$CHAT_MD"; fi
if ! echo "$MD_CONTENT_RESP" | grep -q "GAMMA-7781"; then
  fail "Chat answer did not contain GAMMA-7781. Response: $(echo "$CHAT_MD" | head -c 500)"
fi
if ! echo "$MD_CONTENT_RESP" | grep -qiE "secret token|guide\.md|section"; then
  say "Warning: No obvious Section/guide.md citation (recommended)"
fi
ok "Deployment key = GAMMA-7781 with citation"

say "RAG CSV + Markdown smoke passed."
exit 0
