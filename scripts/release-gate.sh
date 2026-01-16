#!/usr/bin/env bash
# Release Gate - Comprehensive Pre-Deployment Validation
# Strict PASS/FAIL checklist that must pass before deployment

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
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

# Show failing line on error
trap 'echo "${RED}❌ ERROR at line $LINENO${NC}"; exit 2' ERR

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Release Gate - Pre-Deployment Validation        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Starting in: $ROOT"

# ============================================
# 1. Repository Sanity Checks
# ============================================
say "1. Repository Sanity Checks"

if ! command -v git >/dev/null 2>&1; then
  fail "git not found"
  exit 2
fi
ok "git found"

if [[ ! -f package.json ]]; then
  fail "package.json not found in repo root"
  exit 2
fi
ok "package.json found"

# Check .gitignore for secure storage
if grep -q ".secure-storage" .gitignore 2>/dev/null; then
  ok ".secure-storage in .gitignore"
else
  fail ".secure-storage NOT in .gitignore"
fi

if grep -q ".storage" .gitignore 2>/dev/null; then
  ok ".storage in .gitignore"
else
  warn ".storage NOT in .gitignore (should be ignored)"
fi

# ============================================
# 2. Detect Package Manager
# ============================================
say "2. Detecting Package Manager"

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
  fail "No lockfile found (pnpm-lock.yaml/yarn.lock/package-lock.json)"
  exit 2
fi
ok "Detected package manager: ${PM}"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  fail "node not found"
  exit 2
fi
NODE_VERSION=$(node -v)
ok "Node.js: ${NODE_VERSION}"

# ============================================
# 3. Clean Install
# ============================================
say "3. Clean Install"

# Remove node_modules for clean install
if [[ -d "node_modules" ]]; then
  rm -rf node_modules
  ok "Removed existing node_modules"
fi

# Clean install
say "Running: ${INSTALL_CMD}"
if eval "${INSTALL_CMD}" > /tmp/install.log 2>&1; then
  ok "Dependencies installed successfully"
else
  fail "Dependency installation failed. Check /tmp/install.log"
  cat /tmp/install.log | tail -20
  exit 2
fi

# ============================================
# 4. TypeScript Type Check
# ============================================
say "4. TypeScript Type Check"

if ${RUN_CMD} run type-check > /tmp/typecheck.log 2>&1; then
  ok "TypeScript compilation: PASSED"
else
  fail "TypeScript compilation: FAILED"
  echo ""
  echo "TypeScript errors:"
  cat /tmp/typecheck.log | grep -i "error" | head -20
  exit 2
fi

# ============================================
# 5. ESLint Check
# ============================================
say "5. ESLint Check"

if ${RUN_CMD} run lint > /tmp/lint.log 2>&1; then
  ok "ESLint: PASSED"
elif grep -q "error" /tmp/lint.log; then
  fail "ESLint: FAILED (errors found)"
  echo ""
  echo "ESLint errors:"
  cat /tmp/lint.log | grep -i "error" | head -20
  exit 2
else
  # Only warnings (expected for img tags)
  ok "ESLint: PASSED (warnings only)"
fi

# ============================================
# 6. Security: Client-Side Key Leakage Check (Hard Gate)
# ============================================
say "6. Security: Client-Side Key Leakage Check (Hard Gate)"

# Run automated check-no-client-secrets script
if node scripts/check-no-client-secrets.mjs > /tmp/secret-check.log 2>&1; then
  ok "No ThreatCloud API key leakage to client"
else
  fail "SECURITY: ThreatCloud API key leakage detected in client code"
  echo ""
  echo "Secret leakage violations:"
  cat /tmp/secret-check.log
  exit 2
fi

# Additional manual checks (redundant but explicit)
say "6b. Additional Security Checks"

# Check for checkpoint-te imports in client components (manual verification)
CLIENT_IMPORTS=$(grep -r "from.*checkpoint-te\|import.*checkpoint-te" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" 2>/dev/null | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled" || true)

if [[ -n "$CLIENT_IMPORTS" ]]; then
  fail "SECURITY: checkpoint-te imported in client components"
  echo "$CLIENT_IMPORTS"
  exit 2
fi
ok "No checkpoint-te imports in client components (manual check)"

# Check for api-keys-storage imports in client components
API_KEY_IMPORTS=$(grep -r "from.*api-keys-storage\|import.*api-keys-storage" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" 2>/dev/null || true)

if [[ -n "$API_KEY_IMPORTS" ]]; then
  fail "SECURITY: api-keys-storage imported in client components"
  echo "$API_KEY_IMPORTS"
  exit 2
fi
ok "No api-keys-storage imports in client components (manual check)"

# Check for localStorage/sessionStorage API key usage
STORAGE_KEY_USAGE=$(grep -r "localStorage\.getItem.*api.*key\|sessionStorage\.getItem.*api.*key\|localStorage\.setItem.*api.*key\|sessionStorage\.setItem.*api.*key" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" -i 2>/dev/null | grep -v "lakeraToggles\|checkpointTeSandboxEnabled\|lakeraFileScanEnabled\|lakeraRagScanEnabled" || true)

if [[ -n "$STORAGE_KEY_USAGE" ]]; then
  fail "SECURITY: API keys stored in localStorage/sessionStorage"
  echo "$STORAGE_KEY_USAGE"
  exit 2
fi
ok "No API keys in localStorage/sessionStorage (manual check)"

# ============================================
# 7. Build
# ============================================
say "7. Production Build"

if ${RUN_CMD} run build > /tmp/build.log 2>&1; then
  ok "Build: PASSED"
else
  fail "Build: FAILED"
  echo ""
  echo "Build errors:"
  cat /tmp/build.log | grep -i "error" | head -30
  exit 2
fi

# ============================================
# 8. Security: Build Output Check
# ============================================
say "8. Security: Build Output Check"

# Check for API keys in build output
if [[ -d ".next/static" ]]; then
  BUILD_KEY_CHECK=$(grep -r "sk-[a-zA-Z0-9]\{48\}" .next/static 2>/dev/null || true)
  
  if [[ -n "$BUILD_KEY_CHECK" ]]; then
    fail "SECURITY: API keys found in build output"
    echo "$BUILD_KEY_CHECK" | head -5
    exit 2
  fi
  ok "No API keys in build output"
else
  warn ".next/static not found (build may have failed)"
fi

# Check for checkpoint TE API key patterns in build
TE_KEY_CHECK=$(grep -r "CHECKPOINT.*API.*KEY\|TE_API_KEY\|ThreatCloud" .next/static 2>/dev/null -i || true)

if [[ -n "$TE_KEY_CHECK" ]]; then
  fail "SECURITY: Check Point TE API key patterns found in build"
  echo "$TE_KEY_CHECK" | head -5
  exit 2
fi
ok "No Check Point TE key patterns in build"

# ============================================
# 9. Validate v1.0.10 Features Not Revoked
# ============================================
say "9. Validate v1.0.10 Features Not Revoked"

# Run v1.0.10 feature validation
if node scripts/validate-v1.0.10-features.mjs > /tmp/v1.0.10-validation.log 2>&1; then
  ok "All v1.0.10 features present and intact"
else
  fail "v1.0.10 features validation failed - some features may be revoked"
  echo ""
  echo "v1.0.10 feature validation errors:"
  cat /tmp/v1.0.10-validation.log
  exit 2
fi

# ============================================
# 10. Secret Leakage Scan (Git History)
# ============================================
say "10. Secret Leakage Scan (Git History)"

# Check for API keys in tracked files (not in .gitignore)
GIT_KEY_CHECK=$(git grep -i "sk-[a-zA-Z0-9]\{48\}" -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.json" 2>/dev/null | grep -v ".next\|node_modules" || true)

if [[ -n "$GIT_KEY_CHECK" ]]; then
  fail "SECURITY: API keys found in tracked source files"
  echo "$GIT_KEY_CHECK" | head -5
  exit 2
fi
ok "No API keys in tracked source files"

# Check for Check Point TE API key patterns
GIT_TE_CHECK=$(git grep -i "CHECKPOINT.*API.*KEY\|TE_API_KEY" -- "*.ts" "*.tsx" "*.js" "*.jsx" 2>/dev/null | grep -v ".next\|node_modules" || true)

if [[ -n "$GIT_TE_CHECK" ]]; then
  # Only fail if it's an actual key, not just a variable name
  ACTUAL_KEY=$(echo "$GIT_TE_CHECK" | grep -i "api.*key.*=.*[a-zA-Z0-9]\{32,\}" || true)
  if [[ -n "$ACTUAL_KEY" ]]; then
    fail "SECURITY: Check Point TE API key found in tracked files"
    echo "$ACTUAL_KEY" | head -3
    exit 2
  fi
fi
ok "No Check Point TE keys in tracked files"

# ============================================
# 10. Summary
# ============================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Release Gate Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [[ "$PASS" == "true" ]]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                    ✅ RELEASE GATE: PASS                      ║${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}║  All checks passed. Ready for deployment.                    ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
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
  echo ""
  exit 1
fi
