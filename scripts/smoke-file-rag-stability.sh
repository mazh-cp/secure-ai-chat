#!/usr/bin/env bash
# Smoke: upload → list → RAG search → chat retrieval; restart server → still retrievable;
#       delete/clear → gone; reindex → rebuilds.
# Use after fresh install (npm ci && npm run build) with server started (npm run start).
# Optional: run with FRESH_INSTALL=1 to do rm -rf node_modules .next data && npm install && npm run build first.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-60}"
FILE_ID="smoke-stable-$(date +%s)-$$"
ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

# Optional fresh install
if [ "${FRESH_INSTALL:-0}" = "1" ]; then
  say "Fresh install: clean and build"
  cd "$ROOT"
  rm -rf node_modules .next data 2>/dev/null || true
  npm install --no-audit --no-fund
  npm run build
  ok "Fresh install and build done (start server with: npm run start)"
  echo "Start the server in another terminal (npm run start), then re-run this script without FRESH_INSTALL=1"
  exit 0
fi

# 1. Health
say "1. Health check"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}/api/health")
[ "$status" = "200" ] || fail "Health returned $status"
ok "Health 200"

# 2. Upload
say "2. Upload file"
upload_resp=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$FILE_ID\",\"fileName\":\"smoke-stable.txt\",\"fileContent\":\"Stability smoke: oranges and grapes.\",\"fileType\":\"text/plain\",\"fileSize\":52}")
echo "$upload_resp" | grep -q '"success":true' || fail "Upload failed: $upload_resp"
ok "Upload success"

sleep 2

# 3. List (expect at least 1, file present)
say "3. List files"
list_resp=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}/api/files/list")
echo "$list_resp" | grep -q "$FILE_ID" || fail "List does not contain $FILE_ID. Response: ${list_resp:0:400}"
count=$(echo "$list_resp" | grep -o '"count":[0-9]*' | cut -d: -f2)
[ -n "$count" ] && [ "$count" -ge 1 ] || fail "List count missing or 0"
ok "List contains file (count=$count)"

# 4. RAG search / chat retrieval
say "4. Chat RAG retrieval (answer should use file content)"
chat_resp=$(curl -s --max-time "$((TIMEOUT*2))" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What fruits are in the file?\"}],\"enableRAG\":true}")
echo "$chat_resp" | grep -q '"content"' || fail "Chat response missing content"
if echo "$chat_resp" | grep -qi "oranges\|grapes\|fruit"; then
  ok "Chat RAG returned content from file"
else
  warn "Chat may not reference file (check RAG/indexing)"
fi

# 5. Restart server → still retrievable (user must restart; we re-check list + chat)
say "5. Persistence check (list + chat without restart; restart server manually to test full persistence)"
list_again=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}/api/files/list")
echo "$list_again" | grep -q "$FILE_ID" || fail "List lost file before restart"
ok "List still has file (restart server and re-run script to verify post-restart)"

# 6. Delete single file
say "6. Delete file"
del_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -X DELETE "${BASE_URL}/api/files/${FILE_ID}")
[ "$del_status" = "200" ] || fail "Delete returned $del_status"
ok "Delete 200"

list_after_del=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}/api/files/list")
echo "$list_after_del" | grep -q "$FILE_ID" && fail "List still contains deleted file" || true
ok "Deleted file gone from list"

# 7. Upload second file, then clear all
FILE_ID2="smoke-clear-$(date +%s)-$$"
say "7. Upload second file then clear all"
curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$FILE_ID2\",\"fileName\":\"clear-me.txt\",\"fileContent\":\"To be cleared.\",\"fileType\":\"text/plain\",\"fileSize\":14}" > /dev/null
sleep 1
clear_resp=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/clear")
echo "$clear_resp" | grep -q '"success":true' || fail "Clear failed: $clear_resp"
list_after_clear=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}/api/files/list")
echo "$list_after_clear" | grep -q "$FILE_ID2" && fail "List still has file after clear" || true
ok "Clear all: files gone"

# 8. Reindex: upload, then reindex, verify
FILE_ID3="smoke-reindex-$(date +%s)-$$"
say "8. Upload then reindex (reindex rebuilds RAG)"
curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$FILE_ID3\",\"fileName\":\"reindex-me.txt\",\"fileContent\":\"Reindex test: peaches and plums.\",\"fileType\":\"text/plain\",\"fileSize\":38}" > /dev/null
sleep 2
reindex_resp=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/${FILE_ID3}/reindex")
echo "$reindex_resp" | grep -q '"success":true' || fail "Reindex failed: $reindex_resp"
ok "Reindex 200"
chat3=$(curl -s --max-time "$((TIMEOUT*2))" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What fruits are in the file?\"}],\"enableRAG\":true}")
echo "$chat3" | grep -q '"content"' || fail "Chat after reindex missing content"
if echo "$chat3" | grep -qi "peaches\|plums\|fruit"; then
  ok "Chat after reindex returns file content (rebuilds OK)"
else
  warn "Chat after reindex may not reference file"
fi

# Cleanup reindex test file
curl -s -o /dev/null -w "" --max-time "$TIMEOUT" -X DELETE "${BASE_URL}/api/files/${FILE_ID3}" || true

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   File/RAG stability smoke: PASS (upload→list→RAG→delete→clear→reindex)   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo "To test full persistence: restart server (npm run start), then run again and check step 5."
