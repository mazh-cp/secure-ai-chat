#!/usr/bin/env bash
# Startup Validation Script
# Validates environment variables and required directories before application starts
# This should be called on application startup (before starting Next.js)

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; return 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ISSUES=0

say "Validating Startup Requirements"

# 1. Check NODE_ENV
if [ -z "${NODE_ENV:-}" ]; then
  warn "NODE_ENV not set (defaulting to production)"
  export NODE_ENV=production
else
  if [ "$NODE_ENV" != "production" ] && [ "$NODE_ENV" != "development" ]; then
    warn "NODE_ENV=$NODE_ENV (expected 'production' or 'development')"
  else
    ok "NODE_ENV=$NODE_ENV"
  fi
fi

# 2. Check PORT
if [ -z "${PORT:-}" ]; then
  warn "PORT not set (defaulting to 3000)"
  export PORT=3000
else
  ok "PORT=$PORT"
fi

# 3. Check HOSTNAME
if [ -z "${HOSTNAME:-}" ]; then
  warn "HOSTNAME not set (defaulting to 0.0.0.0)"
  export HOSTNAME=0.0.0.0
else
  ok "HOSTNAME=$HOSTNAME"
fi

# 4. Check required directories exist and are writable
say "Checking Required Directories"

REQUIRED_DIRS=(".secure-storage" ".storage")

for dir in "${REQUIRED_DIRS[@]}"; do
  FULL_PATH="$ROOT/$dir"
  
  if [ ! -d "$FULL_PATH" ]; then
    warn "Directory missing: $dir (creating...)"
    mkdir -p "$FULL_PATH"
    
    # Set permissions based on directory
    if [ "$dir" = ".secure-storage" ]; then
      chmod 700 "$FULL_PATH"
      ok "Created $dir with permissions 700"
    else
      chmod 755 "$FULL_PATH"
      ok "Created $dir with permissions 755"
    fi
  else
    ok "Directory exists: $dir"
    
    # Check permissions
    if [ -w "$FULL_PATH" ]; then
      ok "$dir is writable"
    else
      fail "$dir is not writable"
      ISSUES=$((ISSUES + 1))
    fi
    
    # Check .secure-storage permissions specifically
    if [ "$dir" = ".secure-storage" ]; then
      PERMS=$(stat -c%a "$FULL_PATH" 2>/dev/null || stat -f%OLp "$FULL_PATH" 2>/dev/null || echo "unknown")
      if [ "$PERMS" = "700" ]; then
        ok ".secure-storage has correct permissions (700)"
      else
        warn ".secure-storage permissions: $PERMS (expected 700, fixing...)"
        chmod 700 "$FULL_PATH"
        ok "Fixed .secure-storage permissions to 700"
      fi
    fi
  fi
done

# 5. Check .next directory exists (for production)
if [ "$NODE_ENV" = "production" ]; then
  if [ ! -d ".next" ]; then
    fail ".next directory not found (production build required)"
    warn "Run: npm run build"
    ISSUES=$((ISSUES + 1))
  else
    ok ".next directory exists"
  fi
fi

# 6. Validate environment variables (names only, not values)
say "Checking Environment Variables"

# Optional env vars (can be set via UI)
OPTIONAL_VARS=("OPENAI_API_KEY" "LAKERA_AI_KEY" "LAKERA_PROJECT_ID" "LAKERA_ENDPOINT" "CHECKPOINT_TE_API_KEY")

for var in "${OPTIONAL_VARS[@]}"; do
  if [ -n "${!var:-}" ]; then
    # Check if it's a placeholder
    VALUE="${!var}"
    if echo "$VALUE" | grep -qiE "(your|placeholder|dummy|example)"; then
      warn "$var is set but appears to be a placeholder"
    else
      ok "$var is set (not a placeholder)"
    fi
  else
    info "$var not set (can be configured via UI)"
  fi
done

# Summary
echo ""
if [ $ISSUES -eq 0 ]; then
  ok "Startup validation passed"
  exit 0
else
  fail "Startup validation failed ($ISSUES issue(s))"
  exit 1
fi
