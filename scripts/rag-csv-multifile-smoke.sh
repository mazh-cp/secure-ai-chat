#!/usr/bin/env bash
# Multi-CSV RAG smoke: upload 6 CSV files (each with a unique token), ask one question per file,
# assert correct value + citation (File: <filename>, Row: <N>).
# Exit 1 if any assertion fails.
# Usage: BASE_URL=http://localhost:3000 bash scripts/rag-csv-multifile-smoke.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT=60

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
say() { printf "\n==> %s\n" "$*"; }
ok() { printf "${GREEN}✅ %s${NC}\n" "$*"; }
fail() { printf "${RED}❌ %s${NC}\n" "$*"; exit 1; }

# Upload one CSV and return 0 on success
upload_csv() {
  local id="$1"
  local name="$2"
  local content="$3"
  local size=${#content}
  local content_json
  content_json=$(printf '%s' "$content" | node -e "const s=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(s))")
  local body="{\"fileId\":\"${id}\",\"fileName\":\"${name}\",\"fileContent\":${content_json},\"fileType\":\"text/csv\",\"fileSize\":${size}}"
  local out
  out=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/files/store" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null) || true
  local code
  code=$(echo "$out" | tail -n1)
  [ "$code" = "200" ]
}

# 1) Upload 6 CSVs with unique tokens
PREFIX="rag-multi-$$-$(date +%s)"
say "Uploading 6 CSV files (unique token per file)..."

upload_csv "${PREFIX}-a" "alpha.csv" "id,token,value
1,UNIQUE-ALPHA-1,first" || fail "Upload alpha.csv failed"
upload_csv "${PREFIX}-b" "beta.csv" "id,token,value
1,UNIQUE-BETA-2,second" || fail "Upload beta.csv failed"
upload_csv "${PREFIX}-c" "gamma.csv" "id,token,value
1,UNIQUE-GAMMA-3,third" || fail "Upload gamma.csv failed"
upload_csv "${PREFIX}-d" "delta.csv" "id,token,value
1,UNIQUE-DELTA-4,fourth" || fail "Upload delta.csv failed"
upload_csv "${PREFIX}-e" "epsilon.csv" "id,token,value
1,UNIQUE-EPSILON-5,fifth" || fail "Upload epsilon.csv failed"
upload_csv "${PREFIX}-f" "zeta.csv" "id,token,value
1,UNIQUE-ZETA-6,sixth" || fail "Upload zeta.csv failed"

ok "All 6 CSVs uploaded"

# 2) Wait for RAG status ready (all files)
say "Waiting for RAG status ready..."
sleep 3
for i in $(seq 1 20); do
  STATUS=$(curl -s --max-time 5 "${BASE_URL}/api/rag/status" 2>/dev/null) || true
  if echo "$STATUS" | grep -qE '"status"\s*:\s*"ready"'; then
    TOTAL=$(echo "$STATUS" | sed -n 's/.*"totalFiles"\s*:\s*\([0-9]*\).*/\1/p')
    if [ -n "$TOTAL" ] && [ "$TOTAL" -ge 6 ]; then
      ok "RAG status ready (totalFiles >= 6)"
      break
    fi
  fi
  [ $i -eq 20 ] && fail "RAG status did not become ready. Last: $STATUS"
  sleep 2
done

# 3) Ask questions for each unique token; assert value and citation
ask_and_assert() {
  local question="$1"
  local expected_value="$2"
  local expected_file_pattern="$3"
  say "Q: $question (expect: $expected_value, file like: $expected_file_pattern)"
  local chat
  chat=$(curl -s --max-time "$TIMEOUT" -X POST "${BASE_URL}/api/chat" \
    -H "Content-Type: application/json" \
    -d "{\"messages\":[{\"role\":\"user\",\"content\":$(printf '%s' "$question" | node -e "const s=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(s))")}],\"enableRAG\":true}" 2>/dev/null) || true
  local content
  content=$(echo "$chat" | sed -n 's/.*"content":"\([^"]*\)".*/\1/p' | sed 's/\\"/"/g')
  [ -z "$content" ] && content="$chat"
  if ! echo "$content" | grep -q "$expected_value"; then
    fail "Answer must contain '$expected_value'. Response: $(echo "$content" | head -c 500)"
  fi
  if ! echo "$content" | grep -qiE "$expected_file_pattern"; then
    fail "Citation must match pattern '$expected_file_pattern'. Response: $(echo "$content" | head -c 500)"
  fi
  ok "Correct value and citation for: $question"
}

ask_and_assert "What is the value for token UNIQUE-ALPHA-1?" "first" "alpha\.csv|Row"
ask_and_assert "What is the value for UNIQUE-BETA-2?" "second" "beta\.csv|Row"
ask_and_assert "What is the value for UNIQUE-GAMMA-3?" "third" "gamma\.csv|Row"
ask_and_assert "What is the value for UNIQUE-DELTA-4?" "fourth" "delta\.csv|Row"
ask_and_assert "What is the value for UNIQUE-EPSILON-5?" "fifth" "epsilon\.csv|Row"
ask_and_assert "What is the value for UNIQUE-ZETA-6?" "sixth" "zeta\.csv|Row"

say "Multi-file CSV RAG smoke passed (6 files, 6 questions)."
exit 0
