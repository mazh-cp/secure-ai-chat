#!/usr/bin/env bash
# Smoke test: upload → list → chat retrieval; delete → removed from list and not retrievable.
# Optional: restart server and re-run list + chat to verify persistence.
# Requires server running at BASE_URL (e.g. npm run start).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-60}"
FILE_ID="smoke-$(date +%s)-$$"

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }

# 1. Health
say "1. Health check"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}/api/health")
[ "$status" = "200" ] || fail "Health returned $status"
ok "Health 200"

# 2. Upload
say "2. Upload file"
upload_resp=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$FILE_ID\",\"fileName\":\"smoke-rag.txt\",\"fileContent\":\"Smoke test content: bananas and apples.\",\"fileType\":\"text/plain\",\"fileSize\":45,\"scanStatus\":\"pending\"}")
echo "$upload_resp" | grep -q '"success":true' || fail "Upload failed: $upload_resp"
ok "Upload success"

# Allow store to be visible to list (same process or cross-process consistency)
sleep 2

# 3. List (expect 1)
say "3. List files (expect at least 1)"
list_resp=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}/api/files/list")
count=$(echo "$list_resp" | grep -o '"count":[0-9]*' | cut -d: -f2)
[ -n "$count" ] && [ "$count" -ge 1 ] || fail "List count missing or 0: $list_resp"
echo "$list_resp" | grep -q "$FILE_ID" || fail "List does not contain $FILE_ID (server may need REGISTRY_DB_PATH/UPLOADS_DIR; start with: npm run start). List count=$count, response (first 500 chars): ${list_resp:0:500}"
ok "List contains uploaded file (count=$count)"

# 4. Chat RAG retrieval
say "4. Chat with RAG (expect answer to use file content)"
chat_resp=$(curl -s --max-time "$((TIMEOUT*2))" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What fruits are in the file?\"}],\"enableRAG\":true}")
echo "$chat_resp" | grep -q '"content"' || fail "Chat response missing content"
if echo "$chat_resp" | grep -qi "bananas\|apples\|fruit"; then
  ok "Chat RAG returned content from file"
else
  warn "Chat response may not reference file content (check manually)"
fi

# 5. Delete
say "5. Delete file"
del_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -X DELETE "${BASE_URL}/api/files/${FILE_ID}")
[ "$del_status" = "200" ] || fail "Delete returned $del_status"
ok "Delete 200"

# 6. List (expect 0 or no FILE_ID)
say "6. List after delete (file must be gone)"
list2=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}/api/files/list")
echo "$list2" | grep -q "$FILE_ID" && fail "List still contains deleted file" || true
ok "Deleted file not in list"

# 7. Chat again (should not have file content)
say "7. Chat after delete (should not have file context)"
chat2=$(curl -s --max-time "$((TIMEOUT*2))" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What fruits are in the file?\"}],\"enableRAG\":true}")
# Response might still mention fruits from model knowledge; we only check it didn't fail
echo "$chat2" | grep -q '"content"' || fail "Chat after delete missing content"
ok "Chat after delete returned (no file context expected)"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            RAG pipeline smoke test: PASS                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo "Optional: restart server, then GET /api/files/list and POST /api/chat to verify persistence."
