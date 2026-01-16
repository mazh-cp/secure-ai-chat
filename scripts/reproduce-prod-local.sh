#!/usr/bin/env bash
# Reproduce Production Build Locally
# Runs the exact same commands used on production server to test production build locally

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Reproduce Production Build Locally                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Root: $ROOT"
say "This script reproduces the exact production build process locally"
echo ""

# Step 1: Check Node.js version
say "Step 1: Checking Node.js Version"

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js not found"
fi

CURRENT_NODE=$(node -v | tr -d 'v')
if [ -f ".nvmrc" ]; then
  REQUIRED_NODE=$(cat .nvmrc | tr -d '[:space:]')
  info "Required Node.js: v$REQUIRED_NODE (from .nvmrc)"
  info "Current Node.js: v$CURRENT_NODE"
  
  if [ "$CURRENT_NODE" != "$REQUIRED_NODE" ]; then
    warn "Node.js version mismatch: v$CURRENT_NODE (expected v$REQUIRED_NODE)"
    warn "Consider switching: nvm use $REQUIRED_NODE"
  fi
fi

ok "Node.js: v$CURRENT_NODE"

# Step 2: Detect package manager
say "Step 2: Detecting Package Manager"

PM="npm"
INSTALL_CMD="npm ci"
RUN_CMD="npm"

if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
  INSTALL_CMD="pnpm install --frozen-lockfile"
  RUN_CMD="pnpm"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
  INSTALL_CMD="yarn install --immutable || yarn install --frozen-lockfile"
  RUN_CMD="yarn"
elif [ -f "package-lock.json" ]; then
  PM="npm"
  INSTALL_CMD="npm ci"
  RUN_CMD="npm"
else
  warn "No lockfile found, defaulting to npm install"
  INSTALL_CMD="npm install"
fi

ok "Package manager: $PM"
info "Install command: $INSTALL_CMD"

# Step 3: Clean install (production uses npm ci)
say "Step 3: Clean Install (Production Mode)"

if [ -d "node_modules" ]; then
  say "Removing existing node_modules for clean install..."
  rm -rf node_modules
  ok "Removed node_modules"
fi

say "Running: $INSTALL_CMD"
if eval "$INSTALL_CMD" > /tmp/reproduce-prod-install.log 2>&1; then
  ok "Dependencies installed"
else
  fail "Dependency installation failed"
  cat /tmp/reproduce-prod-install.log | tail -30
  exit 1
fi

# Step 4: Run release gate (production validation)
say "Step 4: Running Release Gate (Production Validation)"

if bash scripts/release-gate.sh > /tmp/reproduce-prod-release-gate.log 2>&1; then
  ok "Release gate passed"
else
  fail "Release gate failed (see /tmp/reproduce-prod-release-gate.log)"
  cat /tmp/reproduce-prod-release-gate.log | tail -50
  exit 1
fi

# Step 5: Production build
say "Step 5: Production Build"

# Ensure NODE_ENV=production (like production)
export NODE_ENV=production

say "Running: $RUN_CMD run build"
if $RUN_CMD run build > /tmp/reproduce-prod-build.log 2>&1; then
  ok "Build completed"
else
  fail "Build failed (see /tmp/reproduce-prod-build.log)"
  cat /tmp/reproduce-prod-build.log | tail -50
  exit 1
fi

# Verify build output
if [ ! -d ".next" ]; then
  fail "Build output (.next) not found"
fi

ok "Build output verified"

# Step 6: Test production start (background)
say "Step 6: Testing Production Start"

# Check if port 3000 is available
if lsof -i:3000 >/dev/null 2>&1; then
  warn "Port 3000 is in use, cannot start production server"
  warn "Stop existing server or use different port"
  exit 1
fi

say "Starting production server in background..."
export NODE_ENV=production
export PORT=3000
export HOSTNAME=0.0.0.0

# Start server in background
$RUN_CMD run start > /tmp/reproduce-prod-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
say "Waiting for server to start..."
sleep 5

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
  fail "Server process died"
  cat /tmp/reproduce-prod-server.log
  exit 1
fi

ok "Server started (PID: $SERVER_PID)"

# Step 7: Run smoke tests
say "Step 7: Running Smoke Tests"

if BASE_URL=http://localhost:3000 bash scripts/smoke-test.sh > /tmp/reproduce-prod-smoke.log 2>&1; then
  ok "Smoke tests passed"
else
  warn "Smoke tests failed (see /tmp/reproduce-prod-smoke.log)"
  cat /tmp/reproduce-prod-smoke.log | tail -30
fi

# Step 8: Stop server
say "Step 8: Stopping Production Server"

kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

ok "Server stopped"

# Summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✅ PRODUCTION BUILD REPRODUCTION: SUCCESS           ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Production build reproduced successfully locally.            ║${NC}"
echo -e "${GREEN}║  This matches what will run on production server.            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "Log files:"
echo "  Install: /tmp/reproduce-prod-install.log"
echo "  Release Gate: /tmp/reproduce-prod-release-gate.log"
echo "  Build: /tmp/reproduce-prod-build.log"
echo "  Server: /tmp/reproduce-prod-server.log"
echo "  Smoke Tests: /tmp/reproduce-prod-smoke.log"
echo ""
