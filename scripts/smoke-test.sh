#!/usr/bin/env bash
# Smoke Test - Production Endpoint Validation
# Tests key endpoints and verifies no secrets leak in responses/logs

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-10}"

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

# Redact secrets from output
redact() {
  sed -E 's/(sk-[a-zA-Z0-9]{20,})/sk-***REDACTED***/g' | \
  sed -E 's/(TE_API_KEY_[a-zA-Z0-9]+)/TE_API_KEY_***REDACTED***/g' | \
  sed -E 's/(CHECKPOINT.*API.*KEY[=:][^[:space:]]+)/CHECKPOINT_API_KEY=***REDACTED***/g' | \
  sed -E 's/(Authorization:[[:space:]]*Bearer[[:space:]]+)[^[:space:]]+/\1***REDACTED***/g'
}

# Test endpoint
test_endpoint() {
  local method="$1"
  local path="$2"
  local expected_status="${3:-200}"
  local description="${4:-$path}"
  
  say "Testing: $description"
  
  local response
  local status_code
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}${path}" 2>&1 | redact)
  else
    response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" -X "$method" "${BASE_URL}${path}" 2>&1 | redact)
  fi
  
  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')
  
  # Check for secrets in response
  if echo "$body" | grep -qiE "(sk-[a-zA-Z0-9]{20,}|TE_API_KEY_|CHECKPOINT.*API.*KEY|Authorization.*Bearer)"; then
    fail "SECURITY: Secrets detected in response from $path"
    echo "$body" | redact | head -5
    return 1
  fi
  
  if [ "$status_code" = "$expected_status" ]; then
    ok "$description returned HTTP $status_code"
    return 0
  else
    fail "$description returned HTTP $status_code (expected $expected_status)"
    echo "Response: $(echo "$body" | head -3 | redact)"
    return 1
  fi
}

# Main execution
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Smoke Test - Production Validation               ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Testing endpoints at: $BASE_URL"
say "Timeout: ${TIMEOUT}s per request"
echo ""

FAILED=0

# Core health endpoints
say "1. Core Health Endpoints"

if test_endpoint "GET" "/api/health" "200" "Health check"; then
  : # OK
else
  FAILED=$((FAILED + 1))
fi

if test_endpoint "GET" "/api/version" "200" "Version endpoint"; then
  : # OK
else
  FAILED=$((FAILED + 1))
fi

# Status endpoints (should not expose secrets)
say "2. Status Endpoints (No Secrets)"

if test_endpoint "GET" "/api/keys/retrieve" "200" "Keys status (no values)"; then
  : # OK
else
  FAILED=$((FAILED + 1))
fi

if test_endpoint "GET" "/api/te/config" "200" "Check Point TE config status"; then
  : # OK
else
  FAILED=$((FAILED + 1))
fi

# List endpoints
say "3. List Endpoints"

if test_endpoint "GET" "/api/files/list" "200" "Files list"; then
  : # OK
else
  FAILED=$((FAILED + 1))
fi

if test_endpoint "GET" "/api/models" "200" "Models list"; then
  : # OK
else
  FAILED=$((FAILED + 1))
fi

# WAF endpoints (if available)
say "4. WAF Endpoints (Optional)"

if test_endpoint "GET" "/api/waf/health" "200" "WAF health"; then
  : # OK
else
  warn "WAF health endpoint not available (optional)"
fi

# Check for secrets in any log output (if server logs are accessible)
say "5. Secret Leakage Check"

# Check if we can access server logs (systemd journal)
if command -v journalctl >/dev/null 2>&1 && systemctl is-active secure-ai-chat >/dev/null 2>&1; then
  say "Checking systemd logs for secrets..."
  if sudo journalctl -u secure-ai-chat -n 50 --no-pager 2>/dev/null | redact | grep -qiE "(sk-[a-zA-Z0-9]{20,}|TE_API_KEY_|CHECKPOINT.*API.*KEY)"; then
    fail "SECURITY: Secrets detected in systemd logs"
    FAILED=$((FAILED + 1))
  else
    ok "No secrets in systemd logs"
  fi
else
  warn "Cannot check systemd logs (service not running or journalctl not available)"
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Smoke Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                    ✅ SMOKE TEST: PASS                       ║${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}║  All endpoints responding correctly.                         ║${NC}"
  echo -e "${GREEN}║  No secrets detected in responses or logs.                   ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                    ❌ SMOKE TEST: FAIL                        ║${NC}"
  echo -e "${RED}║                                                               ║${NC}"
  echo -e "${RED}║  $FAILED check(s) failed. Do NOT deploy.                      ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi
