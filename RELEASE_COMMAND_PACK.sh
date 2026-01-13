#!/bin/bash
# Release Command Pack - Single Copy/Paste Block
# Comprehensive pre-deployment validation
# 
# Usage: Copy this entire script and run it
#        OR: npm run release-gate
#
# Exit Code: 0 = PASS, 1 = FAIL

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=true
FAILED_CHECKS=()

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; PASS=false; FAILED_CHECKS+=("$*"); }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Release Gate - Pre-Deployment Validation        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"

# 1. Detect Package Manager
say "1. Detecting Package Manager"
PM=""
INSTALL_CMD=""
RUN_CMD=""
if [[ -f pnpm-lock.yaml ]]; then
  PM="pnpm"
  INSTALL_CMD="pnpm install --frozen-lockfile"
  RUN_CMD="pnpm"
elif [[ -f yarn.lock ]]; then
  PM="yarn"
  INSTALL_CMD="yarn install --immutable || yarn install --frozen-lockfile"
  RUN_CMD="yarn"
elif [[ -f package-lock.json ]]; then
  PM="npm"
  INSTALL_CMD="npm ci"
  RUN_CMD="npm"
else
  fail "No lockfile found"
  exit 2
fi
ok "Package manager: ${PM}"

# 2. Clean Install
say "2. Clean Install"
if [[ -d "node_modules" ]]; then rm -rf node_modules; fi
if eval "${INSTALL_CMD}" > /tmp/install.log 2>&1; then
  ok "Dependencies installed"
else
  fail "Installation failed"
  cat /tmp/install.log | tail -20
  exit 2
fi

# 3. TypeScript Check
say "3. TypeScript Check"
if ${RUN_CMD} run type-check > /tmp/typecheck.log 2>&1; then
  ok "TypeScript: PASSED"
else
  fail "TypeScript: FAILED"
  cat /tmp/typecheck.log | grep -i "error" | head -20
  exit 2
fi

# 4. ESLint Check
say "4. ESLint Check"
if ${RUN_CMD} run lint > /tmp/lint.log 2>&1; then
  ok "ESLint: PASSED"
elif grep -q "error" /tmp/lint.log; then
  fail "ESLint: FAILED"
  cat /tmp/lint.log | grep -i "error" | head -20
  exit 2
else
  ok "ESLint: PASSED (warnings only)"
fi

# 5. Security: Client Key Leakage
say "5. Security: Client Key Leakage Check"
CLIENT_IMPORTS=$(grep -r "from.*checkpoint-te\|import.*checkpoint-te" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" 2>/dev/null | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled" || true)
if [[ -n "$CLIENT_IMPORTS" ]]; then
  fail "SECURITY: checkpoint-te imported in client"
  echo "$CLIENT_IMPORTS"
  exit 2
fi
ok "No checkpoint-te imports in client"

API_KEY_IMPORTS=$(grep -r "from.*api-keys-storage\|import.*api-keys-storage" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" 2>/dev/null || true)
if [[ -n "$API_KEY_IMPORTS" ]]; then
  fail "SECURITY: api-keys-storage imported in client"
  echo "$API_KEY_IMPORTS"
  exit 2
fi
ok "No api-keys-storage imports in client"

# 6. Build
say "6. Production Build"
if ${RUN_CMD} run build > /tmp/build.log 2>&1; then
  ok "Build: PASSED"
else
  fail "Build: FAILED"
  cat /tmp/build.log | grep -i "error" | head -30
  exit 2
fi

# 7. Security: Build Output Scan
say "7. Security: Build Output Scan"
if [[ -d ".next/static" ]]; then
  BUILD_KEY_CHECK=$(grep -r "sk-[a-zA-Z0-9]\{48\}" .next/static 2>/dev/null || true)
  if [[ -n "$BUILD_KEY_CHECK" ]]; then
    fail "SECURITY: API keys in build output"
    echo "$BUILD_KEY_CHECK" | head -5
    exit 2
  fi
  ok "No API keys in build output"
fi

# 8. Secret Leakage Scan
say "8. Secret Leakage Scan (Git)"
GIT_KEY_CHECK=$(git grep -i "sk-[a-zA-Z0-9]\{48\}" -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.json" 2>/dev/null | grep -v ".next\|node_modules" || true)
if [[ -n "$GIT_KEY_CHECK" ]]; then
  fail "SECURITY: API keys in tracked files"
  echo "$GIT_KEY_CHECK" | head -5
  exit 2
fi
ok "No API keys in tracked files"

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [[ "$PASS" == "true" ]]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                    ✅ RELEASE GATE: PASS                      ║${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}║  All checks passed. Ready for deployment.                    ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                    ❌ RELEASE GATE: FAIL                      ║${NC}"
  echo -e "${RED}║                                                               ║${NC}"
  echo -e "${RED}║  One or more checks failed. Do NOT deploy.                   ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "Failed checks:"
  for check in "${FAILED_CHECKS[@]}"; do
    echo "  ❌ $check"
  done
  exit 1
fi
