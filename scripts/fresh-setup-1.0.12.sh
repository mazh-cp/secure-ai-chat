#!/usr/bin/env bash
# Full cleanup + rebuild for release/1.0.12: clean-local, fetch/pull, confirm version 1.0.12,
# clean install (npm ci), fresh build, then start dev server on port 3000.
# Usage: ./scripts/fresh-setup-1.0.12.sh [--no-pull] [--no-data] [--no-start]
#   --no-pull   skip git fetch/pull
#   --no-data   skip wiping ./data (pass-through to clean-local.sh)
#   --no-start  skip starting dev server (only clean, pull, install, build)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

BRANCH="${BRANCH:-release/1.0.12}"
EXPECTED_VERSION="1.0.12"
DO_PULL=true
DO_START=true
SKIP_DATA=false

for arg in "$@"; do
  case "$arg" in
    --no-pull)  DO_PULL=false ;;
    --no-data)  SKIP_DATA=true ;;
    --no-start) DO_START=false ;;
  esac
done

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo -e "${RED}❌${NC} $*"; exit 1; }
ok() { echo -e "${GREEN}✅${NC} $*"; }
warn() { echo -e "${YELLOW}⚠️${NC} $*"; }

# 1. Clean local (kill 3000, wipe artifacts + data)
say "1. Running clean-local.sh"
if [ "$SKIP_DATA" = true ]; then
  bash "$ROOT/scripts/clean-local.sh" --no-data
else
  bash "$ROOT/scripts/clean-local.sh"
fi
ok "Clean done"

# 2. Fetch/pull latest for release/1.0.12
if [ "$DO_PULL" = true ]; then
  say "2. Fetch and pull $BRANCH"
  git fetch origin 2>/dev/null || true
  if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH" 2>/dev/null; then
    git checkout "$BRANCH" 2>/dev/null || true
    git pull origin "$BRANCH" 2>/dev/null || true
    ok "Checked out and pulled $BRANCH"
  elif git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
    git checkout "$BRANCH" 2>/dev/null || true
    git pull 2>/dev/null || true
    ok "Checked out and pulled $BRANCH"
  else
    warn "Branch $BRANCH not found; pulling current branch"
    git pull 2>/dev/null || true
  fi
else
  say "2. Skipping git pull (--no-pull)"
fi

# 3. Detect package manager from lockfile and confirm version
say "3. Confirm package.json version is $EXPECTED_VERSION"
if [ -f package.json ]; then
  V=$(node -e "console.log(require('$ROOT/package.json').version || '')")
  if [ "$V" != "$EXPECTED_VERSION" ]; then
    fail "Expected version $EXPECTED_VERSION in package.json, got: $V"
  fi
  ok "Version $V"
else
  fail "package.json not found"
fi

# 4. Clean install (npm — lockfile is package-lock.json)
say "4. Clean dependency install (npm ci)"
if [ -f package-lock.json ]; then
  npm ci
  ok "npm ci done"
elif [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
  ok "pnpm install done"
elif [ -f yarn.lock ]; then
  yarn install --frozen-lockfile
  ok "yarn install done"
else
  fail "No lockfile (package-lock.json, pnpm-lock.yaml, or yarn.lock) found"
fi

# 5. Fresh build
say "5. Running build"
npm run build
ok "Build done"

# 6. Start dev server on port 3000 (unless --no-start)
if [ "$DO_START" = true ]; then
  say "6. Starting dev server on port 3000"
  echo ""
  echo -e "${GREEN}Dev server will run in the foreground. Stop with Ctrl+C.${NC}"
  echo -e "Open: ${BLUE}http://localhost:3000${NC}"
  echo ""
  exec npm run dev
else
  say "6. Skipping dev server (--no-start). Run: npm run dev"
  ok "Done. Run npm run dev to start."
fi
