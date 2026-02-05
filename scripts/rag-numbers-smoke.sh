#!/usr/bin/env bash
# Numbers RAG smoke: requires LibreOffice (soffice). Upload a .numbers file, wait for status ready,
# ask for "line item 22", assert response includes "Row: 22" and citation with filename/sheet.
# Usage:
#   BASE_URL=http://localhost:3000 bash scripts/rag-numbers-smoke.sh
#   NUMBERS_FILE=/path/to/healthcare_synthetic_dataset_10000_hipaa_credit_billing_5y_enhanced_fields.numbers BASE_URL=http://localhost:3000 bash scripts/rag-numbers-smoke.sh
# If soffice is not found or NUMBERS_FILE is not set, exits 0 with skip message.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT=90
NUMBERS_FILE="${NUMBERS_FILE:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
say() { printf "\n==> %s\n" "$*"; }
ok() { printf "${GREEN}✅ %s${NC}\n" "$*"; }
fail() { printf "${RED}❌ %s${NC}\n" "$*"; exit 1; }
skip() { printf "${YELLOW}⏭ %s${NC}\n" "$*"; exit 0; }

# Check soffice
if ! command -v soffice >/dev/null 2>&1 && ! command -v libreoffice >/dev/null 2>&1; then
  skip "soffice not found; Numbers conversion requires LibreOffice. Install: sudo apt-get install -y libreoffice"
fi

if [ -z "$NUMBERS_FILE" ] || [ ! -f "$NUMBERS_FILE" ]; then
  skip "NUMBERS_FILE not set or not a file. Set NUMBERS_FILE=/path/to/file.numbers to run Numbers RAG smoke."
fi

# Upload .numbers (base64)
say "Uploading $(basename "$NUMBERS_FILE")..."
FILE_ID="rag-numbers-smoke-$$-$(date +%s)"
FILE_NAME=$(basename "$NUMBERS_FILE")
FILE_SIZE=$(stat -f%z "$NUMBERS_FILE" 2>/dev/null || stat -c%s "$NUMBERS_FILE" 2>/dev/null || echo 0)
BASE64_CONTENT=$(base64 -w 0 < "$NUMBERS_FILE" 2>/dev/null || base64 < "$NUMBERS_FILE" 2>/dev/null)
if [ -z "$BASE64_CONTENT" ]; then
  fail "Failed to read or base64 encode $NUMBERS_FILE"
fi

# Build JSON body (fileContent as base64 string)
BODY=$(node -e "
const id = process.env.FILE_ID;
const name = process.env.FILE_NAME;
const size = parseInt(process.env.FILE_SIZE || '0', 10);
const b64 = process.env.BASE64_CONTENT;
console.log(JSON.stringify({
  fileId: id,
  fileName: name,
  fileContent: b64,
  fileType: 'application/vnd.apple.numbers',
  fileSize: size
}));
" FILE_ID="$FILE_ID" FILE_NAME="$FILE_NAME" FILE_SIZE="$FILE_SIZE" BASE64_CONTENT="$BASE64_CONTENT")

UPLOAD=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
  -H "Content-Type: application/json" \
  -d "$BODY" 2>/dev/null) || true
CODE=$(echo "$UPLOAD" | tail -n1)
BODY_RESP=$(echo "$UPLOAD" | sed '$d')
if [ "$CODE" != "200" ]; then
  fail "Numbers upload returned HTTP $CODE. Response: $BODY_RESP"
fi
ok "Uploaded $FILE_NAME"

# Wait for RAG status ready (embeddings_count > 0 for our file or any file)
say "Waiting for RAG status ready..."
sleep 3
for i in $(seq 1 25); do
  STATUS=$(curl -s --max-time 10 "${BASE_URL}/api/rag/status" 2>/dev/null) || true
  if echo "$STATUS" | grep -qE '"status"\s*:\s*"ready"'; then
    if echo "$STATUS" | grep -qE '"embeddings_count"\s*:\s*[1-9][0-9]*'; then
      ok "RAG status ready (embeddings_count > 0)"
      break
    fi
  fi
  [ $i -eq 25 ] && fail "RAG status did not become ready. Last: $STATUS"
  sleep 2
done

# Ask for line item 22
say "Asking: Find user details from line item 22"
CHAT=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Find user details from line item 22"}],"enableRAG":true}' 2>/dev/null) || true
CONTENT=$(echo "$CHAT" | sed -n 's/.*"content":"\([^"]*\)".*/\1/p' | sed 's/\\"/"/g')
[ -z "$CONTENT" ] && CONTENT="$CHAT"

if ! echo "$CONTENT" | grep -qiE "row\s*:\s*22|row\s*22"; then
  fail "Response must include 'Row: 22' or 'Row 22'. Content: $(echo "$CONTENT" | head -c 600)"
fi
ok "Response includes Row 22"

# Citation should include filename or sheet
if ! echo "$CONTENT" | grep -qiE "\.numbers|sheet|file:"; then
  fail "Citation should include file name or sheet. Content: $(echo "$CONTENT" | head -c 500)"
fi
ok "Citation includes file/sheet"

say "Numbers RAG smoke passed."
exit 0
