#!/usr/bin/env bash
# Local validation of deployment changes (skips release gate security check for type imports)
# Focuses on deployment script validation and build verification

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
echo -e "${BLUE}║     Local Deployment Changes Validation (Quick Check)        ║${NC}"
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

# Step 3: Test script syntax
say "Step 3: Testing Script Syntax"

DEPLOY_SCRIPTS=(
  "scripts/smoke-test.sh"
  "scripts/deploy/common.sh"
  "scripts/deploy/upgrade.sh"
  "scripts/deploy/clean-install.sh"
)

for script in "${DEPLOY_SCRIPTS[@]}"; do
  if bash -n "$script" 2>&1; then
    ok "$script syntax is valid"
  else
    fail "$script has syntax errors"
    FAILED=$((FAILED + 1))
  fi
done

# Step 4: Verify package.json start script
say "Step 4: Verifying Production Start Script"

if grep -q '"start": "next start"' package.json; then
  ok "package.json 'start' script is production-ready"
else
  fail "package.json 'start' script is not production-ready"
  FAILED=$((FAILED + 1))
fi

# Step 5: Run type check
say "Step 5: Running TypeScript Type Check"

if npm run typecheck > /tmp/typecheck.log 2>&1; then
  ok "TypeScript compilation passed"
else
  fail "TypeScript compilation failed"
  cat /tmp/typecheck.log | tail -20
  FAILED=$((FAILED + 1))
fi

# Step 6: Build production
say "Step 6: Building Production Bundle"

if npm run build > /tmp/build.log 2>&1; then
  ok "Production build completed"
else
  fail "Production build failed"
  cat /tmp/build.log | tail -30
  FAILED=$((FAILED + 1))
fi

# Step 7: Verify build output
say "Step 7: Verifying Build Output"

if [ -d ".next" ]; then
  ok "Build output (.next) exists"
  if [ -f ".next/BUILD_ID" ]; then
    ok "Build ID file exists"
  fi
else
  fail "Build output (.next) not found"
  FAILED=$((FAILED + 1))
fi

# Step 8: Check documentation
say "Step 8: Verifying Documentation"

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

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║          ✅ DEPLOYMENT VALIDATION: ALL CHECKS PASSED          ║${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}║  All deployment changes validated successfully.              ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  say "Deployment scripts are ready for use!"
  echo ""
  say "Next steps:"
  echo "  1. Test smoke tests (start server first):"
  echo "     npm start &"
  echo "     sleep 5"
  echo "     BASE_URL=http://localhost:3000 ./scripts/smoke-test.sh"
  echo ""
  echo "  2. Review deployment guide: docs/DEPLOYMENT.md"
  echo ""
  echo "  3. Test upgrade script (on a test server):"
  echo "     sudo ./scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main"
  echo ""
  exit 0
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║          ❌ VALIDATION: SOME CHECKS FAILED                      ║${NC}"
  echo -e "${RED}║                                                               ║${NC}"
  echo -e "${RED}║  $FAILED check(s) failed. Review errors above.                ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi
