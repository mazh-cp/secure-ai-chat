#!/usr/bin/env bash
# Clean reinstall and validate: install, build, start with absolute data paths, run smoke tests.
# Run from project root: bash scripts/reinstall-and-validate.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
ok() { echo "${GREEN}✅${NC} $*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say "1. Clean build artifacts and data"
rm -rf node_modules .next ./data
ok "Removed node_modules, .next, data"

say "2. Install dependencies"
npm install --no-audit --no-fund
ok "npm install done"

say "3. Type-check and build"
npm run type-check
npm run build
ok "Build done"

say "4. Free port 3000 and start server with absolute data paths"
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 2
export REGISTRY_DB_PATH="${ROOT}/data/app.db"
export UPLOADS_DIR="${ROOT}/data/uploads"
npm run start &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null; lsof -ti :3000 | xargs kill -9 2>/dev/null || true" EXIT

say "5. Wait for server to be ready"
for i in {1..24}; do
  if curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:3000/api/health | grep -q 200; then
    ok "Server ready"
    break
  fi
  if [ "$i" -eq 24 ]; then
    fail "Server did not become ready in time"
  fi
  sleep 1
done

say "6. Run smoke test"
BASE_URL=http://localhost:3000 bash scripts/smoke-test.sh
ok "Smoke test passed"

say "7. Run RAG pipeline smoke test"
BASE_URL=http://localhost:3000 bash scripts/smoke-rag-pipeline.sh
ok "RAG pipeline smoke test passed"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Reinstall and validation: PASS                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
