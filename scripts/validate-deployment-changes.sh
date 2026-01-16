#!/usr/bin/env bash
# Validate all deployment changes locally
# Tests: release gate, build, smoke tests, deployment scripts

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Local Deployment Changes Validation                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

FAILED=0

# Step 1: Verify new files exist
say "Step 1: Verifying New Files"

FILES=(
  "scripts/smoke-test.sh"
  "scripts/deploy/common.sh"
  "scripts/deploy/upgrade.sh"
  "scripts/deploy/clean-install.sh"
  "scripts/deploy/secure-ai-chat.service"
  "docs/DEPLOYMENT.md"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    ok "$file exists"
  else
    fail "$file not found"
    FAILED=$((FAILED + 1))
  fi
done

# Step 2: Verify scripts are executable
say "Step 2: Verifying Scripts Are Executable"

SCRIPTS=(
  "scripts/smoke-test.sh"
  "scripts/deploy/common.sh"
  "scripts/deploy/upgrade.sh"
  "scripts/deploy/clean-install.sh"
)

for script in "${SCRIPTS[@]}"; do
  if [ -x "$script" ]; then
    ok "$script is executable"
  else
    warn "$script is not executable, fixing..."
    chmod +x "$script"
    ok "$script is now executable"
  fi
done

# Step 3: Run release gate
say "Step 3: Running Release Gate"

if bash scripts/release-gate.sh > /tmp/release-gate-validation.log 2>&1; then
  ok "Release gate passed"
else
  fail "Release gate failed"
  cat /tmp/release-gate-validation.log | tail -30
  FAILED=$((FAILED + 1))
fi

# Step 4: Verify build output
say "Step 4: Verifying Build Output"

if [ -d ".next" ]; then
  ok "Build output (.next) exists"
else
  warn "Build output not found, building..."
  npm run build
  if [ -d ".next" ]; then
    ok "Build completed"
  else
    fail "Build failed"
    FAILED=$((FAILED + 1))
  fi
fi

# Step 5: Test smoke-test.sh (dry run - check syntax)
say "Step 5: Testing Smoke Test Script (Syntax Check)"

if bash -n scripts/smoke-test.sh; then
  ok "smoke-test.sh syntax is valid"
else
  fail "smoke-test.sh has syntax errors"
  FAILED=$((FAILED + 1))
fi

# Step 6: Test deployment scripts (syntax check)
say "Step 6: Testing Deployment Scripts (Syntax Check)"

DEPLOY_SCRIPTS=(
  "scripts/deploy/common.sh"
  "scripts/deploy/upgrade.sh"
  "scripts/deploy/clean-install.sh"
)

for script in "${DEPLOY_SCRIPTS[@]}"; do
  if bash -n "$script"; then
    ok "$script syntax is valid"
  else
    fail "$script has syntax errors"
    FAILED=$((FAILED + 1))
  fi
done

# Step 7: Test common.sh functions (dry run)
say "Step 7: Testing Common Utilities (Dry Run)"

if bash -c "source scripts/deploy/common.sh && detect_package_manager > /dev/null 2>&1"; then
  ok "common.sh functions are loadable"
else
  warn "common.sh functions may have issues (non-critical for local validation)"
fi

# Step 8: Verify package.json start script
say "Step 8: Verifying Production Start Script"

if grep -q '"start": "next start"' package.json; then
  ok "package.json 'start' script is production-ready"
else
  fail "package.json 'start' script is not production-ready"
  FAILED=$((FAILED + 1))
fi

# Step 9: Check documentation links
say "Step 9: Verifying Documentation Links"

if grep -q "DEPLOYMENT.md" README.md; then
  ok "README.md links to DEPLOYMENT.md"
else
  warn "README.md may not link to DEPLOYMENT.md"
fi

if grep -q "Publishing Changes to GitHub" RELEASE.md; then
  ok "RELEASE.md contains GitHub publishing steps"
else
  warn "RELEASE.md may not contain GitHub publishing steps"
fi

# Step 10: Test production start (if server not running)
say "Step 10: Testing Production Start (Quick Check)"

if lsof -ti:3000 > /dev/null 2>&1; then
  warn "Port 3000 is already in use, skipping start test"
  warn "To test: stop existing server, then run: npm start"
else
  # Quick start test (start and stop immediately)
  timeout 5 npm start > /tmp/start-test.log 2>&1 &
  START_PID=$!
  sleep 2
  
  if kill -0 $START_PID 2>/dev/null; then
    ok "Production start works (process started)"
    kill $START_PID 2>/dev/null || true
    wait $START_PID 2>/dev/null || true
  else
    warn "Production start may have issues (check /tmp/start-test.log)"
  fi
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              ✅ VALIDATION: ALL CHECKS PASSED                 ║${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}║  All deployment changes validated successfully.              ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  say "Next steps:"
  echo "  1. Test smoke tests with running server: BASE_URL=http://localhost:3000 ./scripts/smoke-test.sh"
  echo "  2. Review deployment scripts: scripts/deploy/"
  echo "  3. Review deployment guide: docs/DEPLOYMENT.md"
  echo ""
  exit 0
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║              ❌ VALIDATION: SOME CHECKS FAILED                  ║${NC}"
  echo -e "${RED}║                                                               ║${NC}"
  echo -e "${RED}║  $FAILED check(s) failed. Review errors above.                ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi
