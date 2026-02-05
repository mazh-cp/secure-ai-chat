#!/usr/bin/env bash
# Upgrade to v1.0.12: pull tag, install deps, optional release-gate, restart, verify.
# Usage: run from app root (e.g. /opt/secure-ai-chat). Uses systemd if available, else pm2.
#   SKIP_RELEASE_GATE=1  - skip release-gate before restart
#   APP_DIR=/path        - app root (default: current dir)

set -euo pipefail

VERSION="1.0.12"
TAG="v${VERSION}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
say() { printf "\n${YELLOW}==>${NC} %s\n" "$*"; }
ok() { printf "${GREEN}✅ %s${NC}\n" "$*"; }
fail() { printf "${RED}❌ %s${NC}\n" "$*"; exit 1; }

APP_DIR="${APP_DIR:-$(pwd)}"
cd "$APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  fail "Not a git repository: $APP_DIR"
fi

say "Upgrading to $TAG in $APP_DIR"

# 1) Fetch and checkout tag
say "1. Fetching tag $TAG"
git fetch origin "refs/tags/${TAG}:refs/tags/${TAG}" 2>/dev/null || git fetch origin tag "$TAG" 2>/dev/null || true
git checkout "refs/tags/${TAG}" 2>/dev/null || git checkout "$TAG" 2>/dev/null || fail "Could not checkout $TAG"

# 2) Install deps (frozen lockfile)
say "2. Installing dependencies (npm ci)"
if [[ -f package-lock.json ]]; then
  npm ci
elif [[ -f pnpm-lock.yaml ]]; then
  pnpm i --frozen-lockfile
elif [[ -f yarn.lock ]]; then
  yarn install --immutable 2>/dev/null || yarn install --frozen-lockfile
else
  fail "No lockfile (package-lock.json / pnpm-lock.yaml / yarn.lock)"
fi
ok "Dependencies installed"

# 3) Migrations (if any)
if [[ -f "package.json" ]] && grep -q '"migrate"' package.json 2>/dev/null; then
  say "3. Running migrations"
  npm run migrate 2>/dev/null || true
  ok "Migrations done (or none)"
else
  say "3. Migrations (none configured)"
fi

# 4) Optional release-gate
if [[ "${SKIP_RELEASE_GATE:-0}" != "1" ]] && [[ -f scripts/release-gate.sh ]]; then
  say "4. Running release-gate (optional)"
  if SKIP_SMOKE=1 bash scripts/release-gate.sh; then
    ok "Release gate passed"
  else
    fail "Release gate failed; fix or run with SKIP_RELEASE_GATE=1"
  fi
else
  say "4. Release gate skipped (SKIP_RELEASE_GATE=1 or script missing)"
fi

# 5) Build
say "5. Building"
npm run build
ok "Build complete"

# 6) Restart service: systemd vs pm2
say "6. Restarting service"
if systemctl list-units --type=service 2>/dev/null | grep -q secure-ai-chat; then
  sudo systemctl restart secure-ai-chat
  ok "systemd: secure-ai-chat restarted"
elif command -v pm2 >/dev/null 2>&1 && pm2 list 2>/dev/null | grep -q secure-ai-chat; then
  pm2 restart secure-ai-chat
  ok "pm2: secure-ai-chat restarted"
else
  say "No systemd or pm2 secure-ai-chat service found; start manually: npm run start"
fi

# 7) Verify
say "7. Verifying /api/health and /api/rag/status"
BASE="${BASE_URL:-http://localhost:3000}"
sleep 2
for i in $(seq 1 15); do
  if curl -s --max-time 3 "${BASE}/api/health" | grep -q '"status"'; then
    ok "Health OK"
    break
  fi
  [[ $i -eq 15 ]] && fail "Health check did not pass"
  sleep 1
done
curl -s --max-time 3 "${BASE}/api/rag/status" >/dev/null 2>&1 && ok "RAG status reachable" || true

echo ""
ok "Upgrade to $TAG complete."
