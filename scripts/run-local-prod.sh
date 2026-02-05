#!/usr/bin/env bash
# Run production build + start locally. Bypasses proxy for localhost.
# Usage: ./scripts/run-local-prod.sh   or: npm run local:prod

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$ROOT"

export NO_PROXY="localhost,127.0.0.1,::1"
export no_proxy="${NO_PROXY}"

export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-127.0.0.1}"
export NODE_ENV=production

echo "==> Removing .next..."
rm -rf .next

echo "==> Building..."
npm run build

echo ""
echo "==> Starting production server at http://127.0.0.1:${PORT}"
echo ""

exec npm run start
