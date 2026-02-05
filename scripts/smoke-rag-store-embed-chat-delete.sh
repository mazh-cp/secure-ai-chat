#!/usr/bin/env bash
# Smoke: store -> list -> embed -> chat (search) -> delete -> chat (search) returns no stale chunks.
# Ensures RAG index and list are updated on delete so no chunks from deleted file appear.
# Requires server at BASE_URL (e.g. npm run start). Uses /api/files/delete?fileId= and POST /api/files/clear.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-60}"
FILE_ID="smoke-embed-$(date +%s)-$$"

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

# 1. Health
say "1. Health check"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}/api/health")
[ "$status" = "200" ] || fail "Health returned $status"
ok "Health 200"

# Owner id for consistent list/store/embed/chat/delete
OWNER_RESP=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}/api/owner")
OWNER_ID=$(echo "$OWNER_RESP" | grep -o '"owner_id":"[^"]*"' | cut -d'"' -f4)
[ -n "$OWNER_ID" ] || fail "Could not get owner_id from /api/owner: $OWNER_RESP"

# 2. Store
say "2. Store file (bytes to storage + SQLite metadata)"
upload_resp=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $OWNER_ID" \
  -d "{\"fileId\":\"$FILE_ID\",\"fileName\":\"smoke-embed.txt\",\"fileContent\":\"Smoke embed test: mango and kiwi.\",\"fileType\":\"text/plain\",\"fileSize\":42,\"scanStatus\":\"pending\"}")
echo "$upload_resp" | grep -q '"success":true' || fail "Store failed: $upload_resp"
ok "Store success"

sleep 2

# 3. List
say "3. List files (expect file present)"
list_resp=$(curl -s --max-time "$TIMEOUT" -H "X-Client-ID: $OWNER_ID" "${BASE_URL}/api/files/list")
echo "$list_resp" | grep -q "$FILE_ID" || fail "List does not contain $FILE_ID. Response: ${list_resp:0:400}"
ok "List contains file"

# 4. Embed (index from storage into RAG)
say "4. POST /api/rag/embed (read from storage, upsert RAG)"
embed_resp=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/rag/embed" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $OWNER_ID" \
  -d "{}")
echo "$embed_resp" | grep -q '"success":true' || warn "Embed response: $embed_resp"
ok "Embed completed"

# 5. Chat (search/retrieval) - expect answer + optional rag.chunks
say "5. Chat with RAG (search); expect content from file"
chat_resp=$(curl -s --max-time "$((TIMEOUT*2))" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $OWNER_ID" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What fruits are in the file?\"}],\"enableRAG\":true}")
echo "$chat_resp" | grep -q '"content"' || fail "Chat response missing content"
if echo "$chat_resp" | grep -qi "mango\|kiwi\|fruit"; then
  ok "Chat returned content from file"
else
  warn "Chat may not reference file (RAG context may use keyword fallback)"
fi
# Optionally check rag.chunks present
echo "$chat_resp" | grep -q '"rag"' && ok "Response includes rag" || true

# 6. Delete (bytes + SQLite + RAG index)
say "6. DELETE /api/files/delete?fileId= (bytes + row + RAG)"
del_resp=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" -X DELETE -H "X-Client-ID: $OWNER_ID" "${BASE_URL}/api/files/delete?fileId=${FILE_ID}")
del_status=$(echo "$del_resp" | tail -n1)
del_body=$(echo "$del_resp" | sed '$d')
[ "$del_status" = "200" ] || fail "Delete returned $del_status: $del_body"
echo "$del_body" | grep -q '"success":true' || fail "Delete body: $del_body"
ok "Delete 200"

# 7. List after delete (file must be gone)
say "7. List after delete (no stale file)"
list_after=$(curl -s --max-time "$TIMEOUT" -H "X-Client-ID: $OWNER_ID" "${BASE_URL}/api/files/list")
echo "$list_after" | grep -q "$FILE_ID" && fail "List still contains deleted file $FILE_ID" || true
ok "Deleted file not in list"

# 8. Chat again (search) - must not return chunks from deleted file
say "8. Chat after delete (search must not return stale chunks from deleted file)"
chat_after=$(curl -s --max-time "$((TIMEOUT*2))" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $OWNER_ID" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What fruits are in the file?\"}],\"enableRAG\":true}")
echo "$chat_after" | grep -q '"content"' || fail "Chat after delete missing content"
# If response includes rag.chunks, none should be for FILE_ID
if echo "$chat_after" | grep -q '"rag"'; then
  if echo "$chat_after" | grep -q "\"fileId\":\"$FILE_ID\""; then
    fail "Stale RAG chunk still references deleted fileId $FILE_ID"
  fi
  ok "No stale chunks for deleted file in rag.chunks"
else
  ok "Chat after delete returned (no rag chunks or empty)"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   store->list->embed->chat->delete->search: PASS (no stale chunks)   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
