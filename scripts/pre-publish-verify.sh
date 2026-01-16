#!/usr/bin/env bash
# Pre-Publish Verification Checklist
# Comprehensive validation before pushing to GitHub
# Exit code: 0 = PASS (ready to publish), 1 = FAIL (do NOT publish)

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=true
FAILED_ITEMS=()
WARNINGS=()

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; PASS=false; FAILED_ITEMS+=("$*"); }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; WARNINGS+=("$*"); }
info() { echo "${CYAN}ℹ️  INFO:${NC} $*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Pre-Publish Verification Checklist                  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. Settings & Config Robustness
# ============================================
say "1. Settings & Config Robustness"

# Check StoredApiKeys interface has optional fields
if grep -q "openAiKey\?:" "$ROOT/lib/api-keys-storage.ts" 2>/dev/null; then
  ok "API keys interface uses optional fields (?)"
else
  fail "API keys interface may not use optional fields"
fi

# Check for safe defaults in loadApiKeys
if grep -q "return {}" "$ROOT/lib/api-keys-storage.ts" 2>/dev/null; then
  ok "loadApiKeys returns empty object as safe default"
else
  fail "loadApiKeys may not have safe default"
fi

# Check backward compatibility (null/missing fields)
if grep -q "decryptKeys.*return.*{}" "$ROOT/lib/api-keys-storage.ts" 2>/dev/null || \
   grep -q "catch.*return.*{}" "$ROOT/lib/api-keys-storage.ts" 2>/dev/null; then
  ok "Decryption handles errors with safe defaults"
else
  warn "Decryption error handling may need review"
fi

# Check SettingsForm handles missing values
if grep -q "openAiKey.*||.*''" "$ROOT/components/SettingsForm.tsx" 2>/dev/null || \
   grep -q "openAiKey.*??.*''" "$ROOT/components/SettingsForm.tsx" 2>/dev/null || \
   grep -q "const.*openAiKey.*=.*''" "$ROOT/components/SettingsForm.tsx" 2>/dev/null; then
  ok "SettingsForm handles missing values with defaults"
else
  warn "SettingsForm may need null-safe defaults"
fi

# ============================================
# 2. Environment Requirements (prod-safe)
# ============================================
say "2. Environment Requirements (prod-safe)"

# Check validate-startup.sh validates env vars (names only, not values)
if [ -f "$ROOT/scripts/validate-startup.sh" ]; then
  if grep -q "OPTIONAL_VARS=" "$ROOT/scripts/validate-startup.sh" 2>/dev/null; then
    ok "validate-startup.sh distinguishes required vs optional vars"
  else
    warn "validate-startup.sh may not distinguish required vs optional vars"
  fi
  
  if ! grep -q "echo.*OPENAI_API_KEY" "$ROOT/scripts/validate-startup.sh" 2>/dev/null; then
    ok "validate-startup.sh does not print secret values"
  else
    fail "validate-startup.sh may print secret values"
  fi
else
  fail "validate-startup.sh not found"
fi

# Check required env vars (NODE_ENV, PORT, HOSTNAME should have defaults)
if grep -q "NODE_ENV.*=.*production" "$ROOT/scripts/validate-startup.sh" 2>/dev/null || \
   grep -q "defaulting to production" "$ROOT/scripts/validate-startup.sh" 2>/dev/null; then
  ok "NODE_ENV has safe default (production)"
else
  fail "NODE_ENV may not have safe default"
fi

# Check ThreatCloud key is server-only (checkpoint-te.ts)
if [ -f "$ROOT/lib/checkpoint-te.ts" ]; then
  if head -15 "$ROOT/lib/checkpoint-te.ts" | grep -q "typeof window.*undefined\|SECURITY.*server-only\|throw.*Error.*server-only" 2>/dev/null; then
    ok "checkpoint-te.ts has server-only guard"
  else
    fail "checkpoint-te.ts may not have server-only guard"
  fi
else
  warn "checkpoint-te.ts not found (may be optional)"
fi

# ============================================
# 3. Installation + Upgrade Parity Tests
# ============================================
say "3. Installation + Upgrade Parity Tests"

# Check release-gate.sh exists
if [ -f "$ROOT/scripts/release-gate.sh" ]; then
  ok "release-gate.sh exists"
else
  fail "release-gate.sh not found"
fi

# Check smoke-test.sh exists
if [ -f "$ROOT/scripts/smoke-test.sh" ]; then
  ok "smoke-test.sh exists"
else
  fail "smoke-test.sh not found"
fi

# Check deploy scripts exist
if [ -f "$ROOT/scripts/deploy/clean-install.sh" ]; then
  ok "clean-install.sh exists"
else
  fail "clean-install.sh not found"
fi

if [ -f "$ROOT/scripts/deploy/upgrade.sh" ]; then
  ok "upgrade.sh exists"
else
  fail "upgrade.sh not found"
fi

# ============================================
# 4. Release Gate Completeness
# ============================================
say "4. Release Gate Completeness"

if [ -f "$ROOT/scripts/release-gate.sh" ]; then
  # Check for package manager detection
  if grep -q "detect.*package.*manager\|Detect Package Manager" "$ROOT/scripts/release-gate.sh" 2>/dev/null; then
    ok "Release gate detects package manager"
  else
    fail "Release gate may not detect package manager"
  fi
  
  # Check for clean install
  if grep -q "Clean Install\|npm ci\|pnpm install\|yarn install" "$ROOT/scripts/release-gate.sh" 2>/dev/null; then
    ok "Release gate runs clean install"
  else
    fail "Release gate may not run clean install"
  fi
  
  # Check for lint/typecheck
  if grep -q "lint\|type-check\|typecheck" "$ROOT/scripts/release-gate.sh" 2>/dev/null; then
    ok "Release gate runs lint/typecheck"
  else
    fail "Release gate may not run lint/typecheck"
  fi
  
  # Check for build
  if grep -q "npm run build\|build" "$ROOT/scripts/release-gate.sh" 2>/dev/null; then
    ok "Release gate runs build"
  else
    fail "Release gate may not run build"
  fi
  
  # Check for secret scans
  if grep -q "check.*secret\|check:secrets\|check-no-client-secrets" "$ROOT/scripts/release-gate.sh" 2>/dev/null; then
    ok "Release gate runs secret scans"
  else
    fail "Release gate may not run secret scans"
  fi
  
  # Check for PASS/FAIL summary
  if grep -q "PASS.*FAIL\|❌.*✅" "$ROOT/scripts/release-gate.sh" 2>/dev/null; then
    ok "Release gate prints PASS/FAIL summary"
  else
    warn "Release gate may not print PASS/FAIL summary"
  fi
else
  fail "release-gate.sh not found"
fi

# Check check-no-client-secrets.mjs exists
if [ -f "$ROOT/scripts/check-no-client-secrets.mjs" ]; then
  ok "check-no-client-secrets.mjs exists"
else
  fail "check-no-client-secrets.mjs not found"
fi

# ============================================
# 5. Deploy Scripts Readiness
# ============================================
say "5. Deploy Scripts Readiness"

# Check clean-install.sh
if [ -f "$ROOT/scripts/deploy/clean-install.sh" ]; then
  if grep -q "/etc/secure-ai-chat.env" "$ROOT/scripts/deploy/clean-install.sh" 2>/dev/null; then
    ok "clean-install.sh references env file path"
  else
    fail "clean-install.sh may not reference env file path"
  fi
  
  # Check for frozen/immutable install via get_install_cmd or direct commands
  if grep -q "get_install_cmd\|npm ci\|frozen-lockfile\|immutable" "$ROOT/scripts/deploy/clean-install.sh" 2>/dev/null; then
    ok "clean-install.sh uses frozen/immutable install"
  else
    fail "clean-install.sh may not use frozen/immutable install"
  fi
  
  if grep -q "release-gate\|release gate" "$ROOT/scripts/deploy/clean-install.sh" 2>/dev/null; then
    ok "clean-install.sh runs release gate"
  else
    fail "clean-install.sh may not run release gate"
  fi
  
  if grep -q "systemd\|secure-ai-chat.service" "$ROOT/scripts/deploy/clean-install.sh" 2>/dev/null; then
    ok "clean-install.sh creates systemd service"
  else
    fail "clean-install.sh may not create systemd service"
  fi
  
  if grep -q "smoke.*test\|smoke-test" "$ROOT/scripts/deploy/clean-install.sh" 2>/dev/null; then
    ok "clean-install.sh runs smoke test"
  else
    fail "clean-install.sh may not run smoke test"
  fi
else
  fail "clean-install.sh not found"
fi

# Check upgrade.sh
if [ -f "$ROOT/scripts/deploy/upgrade.sh" ]; then
  if grep -q "backup\|BACKUP" "$ROOT/scripts/deploy/upgrade.sh" 2>/dev/null; then
    ok "upgrade.sh creates backups"
  else
    fail "upgrade.sh may not create backups"
  fi
  
  if grep -q "rollback\|ROLLBACK" "$ROOT/scripts/deploy/upgrade.sh" 2>/dev/null; then
    ok "upgrade.sh supports rollback"
  else
    warn "upgrade.sh may not support rollback"
  fi
  
  if grep -q "release-gate\|release gate" "$ROOT/scripts/deploy/upgrade.sh" 2>/dev/null; then
    ok "upgrade.sh runs release gate"
  else
    fail "upgrade.sh may not run release gate"
  fi
  
  if grep -q "smoke.*test\|smoke-test" "$ROOT/scripts/deploy/upgrade.sh" 2>/dev/null; then
    ok "upgrade.sh runs smoke test"
  else
    fail "upgrade.sh may not run smoke test"
  fi
else
  fail "upgrade.sh not found"
fi

# ============================================
# 6. Documentation Consistency
# ============================================
say "6. Documentation Consistency"

# Check README links to RELEASE.md
if grep -q "RELEASE\.md\|Release Process" "$ROOT/README.md" 2>/dev/null; then
  ok "README links to RELEASE.md"
else
  fail "README does not link to RELEASE.md"
fi

# Check README links to DEPLOYMENT.md
if grep -q "DEPLOYMENT\.md\|docs/DEPLOYMENT\|Deployment Guide" "$ROOT/README.md" 2>/dev/null; then
  ok "README links to DEPLOYMENT.md"
else
  fail "README does not link to DEPLOYMENT.md"
fi

# Check RELEASE.md exists
if [ -f "$ROOT/RELEASE.md" ]; then
  ok "RELEASE.md exists"
else
  fail "RELEASE.md not found"
fi

# Check docs/DEPLOYMENT.md exists
if [ -f "$ROOT/docs/DEPLOYMENT.md" ]; then
  ok "docs/DEPLOYMENT.md exists"
else
  fail "docs/DEPLOYMENT.md not found"
fi

# Check package.json scripts match documentation
if grep -q "npm run build\|npm build" "$ROOT/README.md" 2>/dev/null; then
  if grep -q '"build"' "$ROOT/package.json" 2>/dev/null; then
    ok "Build command matches package.json"
  else
    fail "Build command in docs does not match package.json"
  fi
fi

# Check for placeholder secrets in docs
if grep -ri "sk-[a-zA-Z0-9]{32,}" "$ROOT/docs" "$ROOT/README.md" "$ROOT/RELEASE.md" 2>/dev/null | grep -v "REDACTED\|***" | head -1; then
  fail "Real-looking API keys found in documentation"
else
  ok "No real-looking API keys in documentation"
fi

# ============================================
# 7. Git Hygiene & Versioning
# ============================================
say "7. Git Hygiene & Versioning"

# Check git status (should be clean or only allowlisted files)
GIT_STATUS=$(git status --porcelain 2>/dev/null || echo "")
if [ -z "$GIT_STATUS" ]; then
  ok "Git working directory is clean"
else
  # Allow docs/DEV_PROD_DRIFT_FIXES.md as it's documentation
  UNTRACKED=$(echo "$GIT_STATUS" | grep "^??" | grep -v "docs/DEV_PROD_DRIFT_FIXES.md" || true)
  if [ -z "$UNTRACKED" ]; then
    warn "Git has untracked files (may be intentional):"
    echo "$GIT_STATUS" | grep "^??" | head -5
  else
    warn "Git has untracked files:"
    echo "$UNTRACKED" | head -5
  fi
fi

# Check .gitignore includes .secure-storage
if grep -q "\.secure-storage" "$ROOT/.gitignore" 2>/dev/null; then
  ok ".secure-storage in .gitignore"
else
  fail ".secure-storage NOT in .gitignore"
fi

# Check .gitignore includes .storage
if grep -q "\.storage" "$ROOT/.gitignore" 2>/dev/null; then
  ok ".storage in .gitignore"
else
  warn ".storage NOT in .gitignore (should be ignored)"
fi

# Check .gitignore includes .next
if grep -q "\.next" "$ROOT/.gitignore" 2>/dev/null; then
  ok ".next in .gitignore"
else
  fail ".next NOT in .gitignore"
fi

# Check .gitignore includes .env.local
if grep -q "\.env.*local" "$ROOT/.gitignore" 2>/dev/null; then
  ok ".env*.local in .gitignore"
else
  fail ".env*.local NOT in .gitignore"
fi

# Check version consistency (package.json vs .nvmrc vs engines.node)
PACKAGE_VERSION=$(grep '"version"' "$ROOT/package.json" | head -1 | cut -d'"' -f4)
NVMRC_VERSION=$(cat "$ROOT/.nvmrc" 2>/dev/null | tr -d '[:space:]' || echo "")
ENGINES_NODE=$(grep '"node"' "$ROOT/package.json" | head -1 | cut -d'"' -f4 || echo "")

info "Package version: $PACKAGE_VERSION"
if [ -n "$NVMRC_VERSION" ]; then
  info "Node version (.nvmrc): $NVMRC_VERSION"
  if [ "$NVMRC_VERSION" = "24.13.0" ]; then
    ok ".nvmrc specifies v24.13.0 (LTS)"
  else
    warn ".nvmrc specifies v$NVMRC_VERSION (should be 24.13.0)"
  fi
else
  fail ".nvmrc not found"
fi

if [ -n "$ENGINES_NODE" ]; then
  info "Node version (package.json engines): $ENGINES_NODE"
  if [ "$ENGINES_NODE" != "$NVMRC_VERSION" ] && [ -n "$NVMRC_VERSION" ]; then
    fail "package.json engines.node ($ENGINES_NODE) does not match .nvmrc ($NVMRC_VERSION)"
  else
    ok "package.json engines.node matches .nvmrc"
  fi
fi

# Check for secrets in current changes (git diff)
if git diff --cached --quiet 2>/dev/null; then
  STAGED_DIFF=""
else
  STAGED_DIFF=$(git diff --cached 2>/dev/null | grep -iE "(sk-[a-zA-Z0-9]{32,}|api.*key.*=.*[a-zA-Z0-9]{20,})" | grep -v "REDACTED\|***\|placeholder\|your.*key" || echo "")
fi

if [ -n "$STAGED_DIFF" ]; then
  fail "Potential secrets found in staged changes"
else
  ok "No secrets detected in staged changes"
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Pre-Publish Verification Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ${#FAILED_ITEMS[@]} -eq 0 ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                    ✅ VERIFICATION: PASS                       ║${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}║  All checks passed. Ready to publish.                        ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  
  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    warn "Warnings (non-blocking):"
    for w in "${WARNINGS[@]}"; do
      echo "  - $w"
    done
  fi
  
  exit 0
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                    ❌ VERIFICATION: FAIL                        ║${NC}"
  echo -e "${RED}║                                                               ║${NC}"
  echo -e "${RED}║  ${#FAILED_ITEMS[@]} check(s) failed. Do NOT publish.                      ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  fail "Failed items:"
  for item in "${FAILED_ITEMS[@]}"; do
    echo "  - $item"
  done
  
  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    warn "Warnings (non-blocking):"
    for w in "${WARNINGS[@]}"; do
      echo "  - $w"
    done
  fi
  
  exit 1
fi
