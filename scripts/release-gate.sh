#!/usr/bin/env bash
# Release Gate - Comprehensive Pre-Deployment Validation
# Strict PASS/FAIL checklist that must pass before deployment

set -Eeuo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=true
FAILED_CHECKS=()
CURRENT_STAGE="Initialization"

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; PASS=false; FAILED_CHECKS+=("$CURRENT_STAGE: $*"); }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

# Enhanced error trap with diagnostic information
trap 'handle_error $? $LINENO "$BASH_COMMAND"' ERR

handle_error() {
  local exit_code=$1
  local line_no=$2
  local command=$3
  
  echo ""
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                    ❌ RELEASE GATE FAILED                     ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${RED}Exit Code:${NC} $exit_code"
  echo -e "${RED}Failed at line:${NC} $line_no"
  echo -e "${RED}Failed command:${NC} $command"
  echo -e "${RED}Failed stage:${NC} $CURRENT_STAGE"
  echo ""
  echo -e "${YELLOW}Environment:${NC}"
  echo "  Node.js: $(node -v 2>/dev/null || echo 'NOT FOUND')"
  echo "  npm: $(npm -v 2>/dev/null || echo 'NOT FOUND')"
  echo "  Working directory: $(pwd)"
  echo ""
  exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Release Gate - Pre-Deployment Validation        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Starting in: $ROOT"

# Print environment information
echo -e "${CYAN}Environment Information:${NC}"
echo "  Node.js: $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "  npm: $(npm -v 2>/dev/null || echo 'NOT FOUND')"
echo "  OS: $(uname -s) $(uname -r)"
echo "  Working directory: $(pwd)"
echo ""

# ============================================
# 1. Repository Sanity Checks
# ============================================
CURRENT_STAGE="Repository Sanity Checks"
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
CURRENT_STAGE="Detect Package Manager"
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
CURRENT_STAGE="Clean Install"
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
# 4. Run npm run doctor (comprehensive validation)
# ============================================
CURRENT_STAGE="npm run doctor"
say "4. Running npm run doctor"
say "   This runs: check:node + lint + type-check + test + build"

if ${RUN_CMD} run doctor > /tmp/doctor.log 2>&1; then
  ok "npm run doctor: PASSED"
else
  fail "npm run doctor: FAILED"
  echo ""
  echo "Doctor script errors (last 50 lines):"
  cat /tmp/doctor.log | tail -50
  exit 1
fi

# ============================================
# 5. Security: Client-Side Key Leakage Check (Hard Gate)
# ============================================
CURRENT_STAGE="Security: Client-Side Key Leakage Check"
say "5. Security: Client-Side Key Leakage Check (Hard Gate)"

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
say "5b. Additional Security Checks"

# Check for checkpoint-te imports in client components (manual verification)
# Only check for imports from @/lib (server-only), not @/types (types only - safe)
# Exclude type-only imports from @/types (TypeScript strips them at compile time)
CLIENT_IMPORTS=$(grep -r "from.*checkpoint-te\|import.*checkpoint-te" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" 2>/dev/null | grep -v "checkpointTeConfigured\|checkpointTeSandboxEnabled\|@/types/checkpoint-te\|@/types/api-keys\|from '@/types/\|from \"@/types/" || true)

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

# Check for localStorage/sessionStorage API key storage (setItem only - getItem for status checks is safe)
# Only flag setItem operations with exact API key variable names - exclude app settings, toggles, etc.
# Pattern: Match exact API key variable names only (apiKey, apiKeys, api_key, openaiApiKey, lakeraApiKey, checkpointApiKey)
STORAGE_KEY_USAGE=$(grep -r "localStorage\.setItem\|sessionStorage\.setItem" components/ app/ --include="*.tsx" --include="*.ts" --exclude-dir="api" 2>/dev/null | grep -iE "setItem\(['\"](apiKey|api_key|apiKeys|openaiApiKey|lakeraApiKey|checkpointApiKey)" || true)

if [[ -n "$STORAGE_KEY_USAGE" ]]; then
  fail "SECURITY: API keys stored in localStorage/sessionStorage (setItem detected)"
  echo "$STORAGE_KEY_USAGE"
  exit 2
fi
ok "No API keys stored in localStorage/sessionStorage (manual check)"

# ============================================
# 6. Security: Build Output Check
# ============================================
CURRENT_STAGE="Security: Build Output Check"
say "6. Security: Build Output Check"

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
# 7. Validate v1.0.10 Features Not Revoked
# ============================================
CURRENT_STAGE="Validate v1.0.10 Features"
say "7. Validate v1.0.10 Features Not Revoked"

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
# 8. Secret Leakage Scan (Git History)
# ============================================
CURRENT_STAGE="Secret Leakage Scan (Git History)"
say "8. Secret Leakage Scan (Git History)"

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
# Summary
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
