#!/usr/bin/env bash
set -euo pipefail

echo "[smoke] node: $(node -v)"
echo "[smoke] npm:  $(npm -v)"

# Check Node version matches .nvmrc
npm run check:node

npm run lint
npm run build

echo "[smoke] ✅ lint + build passed"
