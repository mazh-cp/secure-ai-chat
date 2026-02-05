#!/usr/bin/env bash
# Persistence regression: upload file, list, rag/status, chat, list again, rag/status again.
# Fails if file count or totalFiles drops after "navigating" (chat request).
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TIMEOUT=15

say() { echo "==> $*"; }
fail() { echo "FAIL: $*"; exit 1; }

# 1) Get owner cookie (so list/store/status/chat use same scope)
COOKIE_FILE=$(mktemp)
trap "rm -f $COOKIE_FILE" EXIT
curl -fsS -c "$COOKIE_FILE" -b "$COOKIE_FILE" "${BASE_URL}/api/owner" -o /dev/null
OWNER_JSON=$(curl -fsS -b "$COOKIE_FILE" "${BASE_URL}/api/owner")
OWNER_ID=$(echo "$OWNER_JSON" | sed -n 's/.*"owner_id":"\([^"]*\)".*/\1/p')
[[ -z "$OWNER_ID" ]] && fail "Could not get owner_id from /api/owner"

# 2) Upload a file
FILE_ID="persist-nav-smoke-$(date +%s)"
FILE_NAME="persist_smoke.txt"
FILE_CONTENT="Persistence smoke test. Row 1 Alice. Row 2 Bob."
FILE_SIZE=${#FILE_CONTENT}
say "Uploading $FILE_NAME..."
UPLOAD_RESP=$(curl -fsS -b "$COOKIE_FILE" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $OWNER_ID" \
  -d "{\"fileId\":\"$FILE_ID\",\"fileName\":\"$FILE_NAME\",\"fileContent\":\"$FILE_CONTENT\",\"fileType\":\"text/plain\",\"fileSize\":$FILE_SIZE}")
echo "$UPLOAD_RESP" | grep -q '"success":true' || fail "Upload failed: $UPLOAD_RESP"

# 3) List -> count == 1
LIST1=$(curl -fsS -b "$COOKIE_FILE" -H "X-Client-ID: $OWNER_ID" "${BASE_URL}/api/files/list")
COUNT1=$(echo "$LIST1" | sed -n 's/.*"count":\([0-9]*\).*/\1/p')
[[ "$COUNT1" -ge 1 ]] || fail "After upload: files/list count=$COUNT1 (expected >= 1)"

# 4) RAG status -> totalFiles >= 1
STATUS1=$(curl -fsS -b "$COOKIE_FILE" -H "X-Client-ID: $OWNER_ID" "${BASE_URL}/api/rag/status")
TOTAL1=$(echo "$STATUS1" | sed -n 's/.*"totalFiles":\([0-9]*\).*/\1/p')
[[ -n "$TOTAL1" ]] && [[ "$TOTAL1" -ge 1 ]] || fail "After upload: rag/status totalFiles=$TOTAL1 (expected >= 1)"

# 5) Chat request (simulates navigation to Chat)
say "Sending chat request (simulate navigation)..."
CHAT_RESP=$(curl -fsS -b "$COOKIE_FILE" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $OWNER_ID" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"enableRAG":true}' \
  --max-time $TIMEOUT) || true
# Chat may return 400/500 if no API key; we only care that list/status still see the file

# 6) List again -> count still >= 1
LIST2=$(curl -fsS -b "$COOKIE_FILE" -H "X-Client-ID: $OWNER_ID" "${BASE_URL}/api/files/list")
COUNT2=$(echo "$LIST2" | sed -n 's/.*"count":\([0-9]*\).*/\1/p')
[[ "$COUNT2" -ge 1 ]] || fail "After chat: files/list count=$COUNT2 (expected >= 1, persistence regression)"

# 7) RAG status again -> totalFiles still >= 1
STATUS2=$(curl -fsS -b "$COOKIE_FILE" -H "X-Client-ID: $OWNER_ID" "${BASE_URL}/api/rag/status")
TOTAL2=$(echo "$STATUS2" | sed -n 's/.*"totalFiles":\([0-9]*\).*/\1/p')
[[ -n "$TOTAL2" ]] && [[ "$TOTAL2" -ge 1 ]] || fail "After chat: rag/status totalFiles=$TOTAL2 (expected >= 1)"

say "Persistence smoke passed (list count=$COUNT2, totalFiles=$TOTAL2)"
exit 0
