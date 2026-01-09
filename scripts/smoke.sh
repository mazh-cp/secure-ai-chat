#!/usr/bin/env bash
set -euo pipefail

echo "[smoke] node: $(node -v)"
echo "[smoke] npm:  $(npm -v)"

npm run lint
npm run build

echo "[smoke] ✅ lint + build passed"
