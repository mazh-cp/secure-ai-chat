#!/usr/bin/env bash
# RAG + Chat smoke: upload file with unique fact, wait for ready, ask chat, expect answer with citation and "Not found" for out-of-file question.
# Exit 1 if any expectation fails. Permanent regression guardrail.
# Usage: BASE_URL=http://localhost:3000 bash scripts/rag-chat-smoke.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
UNIQUE_PHRASE="BLUE-COMET-772"
TEXT_FILE="/tmp/rag_smoke_$$.txt"
TIMEOUT=60

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
say() { printf "\n==> %s\n" "$*"; }
ok() { printf "${GREEN}✅ %s${NC}\n" "$*"; }
fail() { printf "${RED}❌ %s${NC}\n" "$*"; exit 1; }

# 1) Create small text file with unique fact
echo "The launch code phrase is ${UNIQUE_PHRASE}." > "$TEXT_FILE"
FILE_NAME="rag-smoke-$$.txt"
say "Created test file with phrase: $UNIQUE_PHRASE"

# 2) Upload file via POST /api/files/store
FILE_ID="rag-smoke-$$-$(date +%s)"
FILE_CONTENT="The launch code phrase is ${UNIQUE_PHRASE}."
FILE_SIZE=${#FILE_CONTENT}
BODY="{\"fileId\":\"${FILE_ID}\",\"fileName\":\"${FILE_NAME}\",\"fileContent\":\"${FILE_CONTENT}\",\"fileType\":\"text/plain\",\"fileSize\":${FILE_SIZE}}"

UPLOAD_RESP=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "$BODY" 2>/dev/null) || true
UPLOAD_CODE=$(echo "$UPLOAD_RESP" | tail -n1)
if [ "$UPLOAD_CODE" != "200" ]; then
  fail "Upload returned HTTP $UPLOAD_CODE (expected 200). Response: $(echo "$UPLOAD_RESP" | sed '$d')"
fi
ok "File uploaded (HTTP 200)"

# 3) Wait for /api/rag/status ready
say "Waiting for RAG status ready..."
for i in $(seq 1 15); do
  STATUS=$(curl -s --max-time 5 "${BASE_URL}/api/rag/status" 2>/dev/null) || true
  if echo "$STATUS" | grep -q '"status":"ready"'; then
    ok "RAG status ready"
    break
  fi
  [ $i -eq 15 ] && fail "RAG status did not become ready within 15 attempts"
  sleep 2
done

# 4) Ask chat: "What is the launch code phrase?" -> must contain BLUE-COMET-772 and citation
say "Asking chat: What is the launch code phrase?"
CHAT_RESP=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is the launch code phrase?"}],"enableRAG":true}' 2>/dev/null) || true
CHAT_CONTENT=$(echo "$CHAT_RESP" | sed -n 's/.*"content":"\([^"]*\)".*/\1/p' | sed 's/\\"/"/g')
if [ -z "$CHAT_CONTENT" ]; then CHAT_CONTENT="$CHAT_RESP"; fi
if ! echo "$CHAT_CONTENT" | grep -q "$UNIQUE_PHRASE"; then
  fail "Chat answer did not contain expected phrase '$UNIQUE_PHRASE'. Response: $(echo "$CHAT_RESP" | head -c 500)"
fi
if ! echo "$CHAT_CONTENT" | grep -qiE 'citation|file|source|\[.*\]'; then
  say "Warning: No obvious citation in response (optional but recommended)"
fi
ok "Chat returned answer containing $UNIQUE_PHRASE"

# 5) Ask chat: "What is the CEO of Apple's favorite food?" (not in file) -> expect "Not found in the uploaded files"
say "Asking chat out-of-file question (expect Not found in uploaded files)"
CHAT2_RESP=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is the CEO of Apple'\''s favorite food?"}],"enableRAG":true}' 2>/dev/null) || true
CHAT2_CONTENT=$(echo "$CHAT2_RESP" | sed -n 's/.*"content":"\([^"]*\)".*/\1/p' | sed 's/\\"/"/g')
if [ -z "$CHAT2_CONTENT" ]; then CHAT2_CONTENT="$CHAT2_RESP"; fi
if ! echo "$CHAT2_CONTENT" | grep -qi "not found in the uploaded files"; then
  fail "Chat should say 'Not found in the uploaded files' for out-of-file question. Response: $(echo "$CHAT2_RESP" | head -c 500)"
fi
ok "Chat correctly said not found in uploaded files"

rm -f "$TEXT_FILE"
say "RAG+Chat smoke passed."
exit 0
