#!/usr/bin/env bash
# Dev vs Prod Drift Checker
# Identifies differences between local dev and production environments

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Flags
CHECK_NODE=false
CHECK_PM=false
CHECK_ENV=false
CHECK_PATHS=false
CHECK_PERMS=false
CHECK_ALL=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --check-node)
      CHECK_NODE=true
      CHECK_ALL=false
      shift
      ;;
    --check-pm)
      CHECK_PM=true
      CHECK_ALL=false
      shift
      ;;
    --check-env)
      CHECK_ENV=true
      CHECK_ALL=false
      shift
      ;;
    --check-paths)
      CHECK_PATHS=true
      CHECK_ALL=false
      shift
      ;;
    --check-perms)
      CHECK_PERMS=true
      CHECK_ALL=false
      shift
      ;;
    *)
      echo "Usage: $0 [--check-node|--check-pm|--check-env|--check-paths|--check-perms]"
      exit 1
      ;;
  esac
done

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; return 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }
info() { echo "${CYAN}ℹ️  INFO:${NC} $*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Dev vs Prod Drift Checker                       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Root: $ROOT"
echo ""

ISSUES=0

# 1. Check Node.js Version
if [ "$CHECK_ALL" = true ] || [ "$CHECK_NODE" = true ]; then
  say "1. Node.js Version Parity"
  
  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js not found"
    ISSUES=$((ISSUES + 1))
  else
    CURRENT_NODE=$(node -v | tr -d 'v')
    info "Current Node.js: v$CURRENT_NODE"
    
    if [ -f ".nvmrc" ]; then
      REQUIRED_NODE=$(cat .nvmrc | tr -d '[:space:]')
      info "Required Node.js: v$REQUIRED_NODE (from .nvmrc)"
      
      if [ "$CURRENT_NODE" = "$REQUIRED_NODE" ]; then
        ok "Node.js version matches .nvmrc"
      else
        warn "Node.js version mismatch: v$CURRENT_NODE (expected v$REQUIRED_NODE)"
        ISSUES=$((ISSUES + 1))
      fi
    else
      warn ".nvmrc not found, cannot validate Node.js version"
    fi
    
    # Check package.json engines
    if [ -f "package.json" ]; then
      PACKAGE_NODE=$(grep -o '"node": "[^"]*"' package.json | cut -d'"' -f4 || echo "")
      if [ -n "$PACKAGE_NODE" ] && [ "$PACKAGE_NODE" != "$REQUIRED_NODE" ]; then
        warn "package.json engines.node ($PACKAGE_NODE) doesn't match .nvmrc ($REQUIRED_NODE)"
      fi
    fi
  fi
fi

# 2. Check Package Manager
if [ "$CHECK_ALL" = true ] || [ "$CHECK_PM" = true ]; then
  say "2. Package Manager Parity"
  
  PM=""
  if [ -f "pnpm-lock.yaml" ]; then
    PM="pnpm"
  elif [ -f "yarn.lock" ]; then
    PM="yarn"
  elif [ -f "package-lock.json" ]; then
    PM="npm"
  else
    warn "No lockfile found"
    ISSUES=$((ISSUES + 1))
  fi
  
  if [ -n "$PM" ]; then
    info "Detected package manager: $PM"
    ok "Lockfile exists: ${PM}-lock.*"
    
    # Check if npm is available (since we use npm in scripts)
    if ! command -v npm >/dev/null 2>&1; then
      fail "npm not found (required for scripts)"
      ISSUES=$((ISSUES + 1))
    else
      NPM_VERSION=$(npm -v)
      info "npm version: $NPM_VERSION"
    fi
  fi
fi

# 3. Check Environment Variables
if [ "$CHECK_ALL" = true ] || [ "$CHECK_ENV" = true ]; then
  say "3. Environment Variables Parity"
  
  # Check local .env.local
  if [ -f ".env.local" ]; then
    info "Found .env.local (local dev)"
    ENV_LOCAL_VARS=$(grep -E "^(NODE_ENV|PORT|HOSTNAME|OPENAI_API_KEY|LAKERA_AI_KEY|CHECKPOINT_TE_API_KEY)=" .env.local 2>/dev/null | cut -d'=' -f1 || echo "")
    if [ -n "$ENV_LOCAL_VARS" ]; then
      info "Local env vars: $(echo "$ENV_LOCAL_VARS" | tr '\n' ' ')"
    fi
  else
    info ".env.local not found (using defaults or UI configuration)"
  fi
  
  # Check production env file location
  PROD_ENV_FILE="/etc/secure-ai-chat.env"
  if [ -f "$PROD_ENV_FILE" ]; then
    info "Found production env file: $PROD_ENV_FILE"
    PROD_ENV_VARS=$(grep -E "^(NODE_ENV|PORT|HOSTNAME|OPENAI_API_KEY|LAKERA_AI_KEY|CHECKPOINT_TE_API_KEY)=" "$PROD_ENV_FILE" 2>/dev/null | cut -d'=' -f1 || echo "")
    if [ -n "$PROD_ENV_VARS" ]; then
      info "Production env vars: $(echo "$PROD_ENV_VARS" | tr '\n' ' ')"
    fi
  else
    warn "Production env file not found: $PROD_ENV_FILE (will use systemd Environment or defaults)"
  fi
  
  # Check systemd service
  SYSTEMD_SERVICE="/etc/systemd/system/secure-ai-chat.service"
  if [ -f "$SYSTEMD_SERVICE" ]; then
    info "Found systemd service: $SYSTEMD_SERVICE"
    if grep -q "EnvironmentFile=" "$SYSTEMD_SERVICE"; then
      ENV_FILE_PATH=$(grep "EnvironmentFile=" "$SYSTEMD_SERVICE" | cut -d'=' -f2 || echo "")
      if [ -n "$ENV_FILE_PATH" ] && [ ! -f "$ENV_FILE_PATH" ]; then
        warn "Systemd EnvironmentFile ($ENV_FILE_PATH) does not exist"
        ISSUES=$((ISSUES + 1))
      fi
    else
      info "Systemd service uses inline Environment variables"
    fi
  else
    info "Systemd service not found (not running as service?)"
  fi
  
  ok "Environment variable check completed"
fi

# 4. Check Storage Paths
if [ "$CHECK_ALL" = true ] || [ "$CHECK_PATHS" = true ]; then
  say "4. Storage Paths Parity"
  
  # Check required directories
  REQUIRED_DIRS=(".secure-storage" ".storage" ".next")
  
  for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      ok "Directory exists: $dir"
    else
      if [ "$dir" = ".next" ]; then
        warn "Directory missing: $dir (will be created by 'npm run build')"
      else
        info "Directory missing: $dir (will be created by application on first use)"
      fi
    fi
  done
  
  ok "Storage paths check completed"
fi

# 5. Check Permissions
if [ "$CHECK_ALL" = true ] || [ "$CHECK_PERMS" = true ]; then
  say "5. Permissions Parity"
  
  # Check .secure-storage permissions
  if [ -d ".secure-storage" ]; then
    PERMS=$(stat -c%a ".secure-storage" 2>/dev/null || stat -f%OLp ".secure-storage" 2>/dev/null || echo "unknown")
    info ".secure-storage permissions: $PERMS"
    
    if [ "$PERMS" = "700" ]; then
      ok ".secure-storage has correct permissions (700)"
    else
      warn ".secure-storage permissions: $PERMS (expected 700)"
      ISSUES=$((ISSUES + 1))
    fi
  else
    info ".secure-storage doesn't exist yet (will be created with mode 700)"
  fi
  
  # Check file ownership (if running as service)
  if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
    APP_USER=$(grep "^User=" /etc/systemd/system/secure-ai-chat.service | cut -d'=' -f2 || echo "")
    if [ -n "$APP_USER" ]; then
      info "App user from systemd: $APP_USER"
      CURRENT_USER=$(whoami)
      if [ "$CURRENT_USER" != "$APP_USER" ]; then
        info "Current user ($CURRENT_USER) differs from app user ($APP_USER) - expected in production"
      fi
    fi
  fi
  
  ok "Permissions check completed"
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Drift Check Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $ISSUES -eq 0 ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                  ✅ NO DRIFT DETECTED                        ║${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}║  Local dev and production appear to be in sync.              ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 0
else
  echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║                ⚠️  DRIFT ISSUES DETECTED                     ║${NC}"
  echo -e "${YELLOW}║                                                               ║${NC}"
  echo -e "${YELLOW}║  $ISSUES potential drift issue(s) found.                     ║${NC}"
  echo -e "${YELLOW}║  Review warnings above and fix before deploying.             ║${NC}"
  echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 0  # Don't fail, just warn
fi
