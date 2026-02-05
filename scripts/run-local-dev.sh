#!/usr/bin/env bash
# Run dev server for local validation. Bypasses proxy for localhost.
# Raises ulimit (open files) to avoid EMFILE so the GUI loads instead of 404.
# Usage: ./scripts/run-local-dev.sh   or: npm run local:dev

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$ROOT"

export NO_PROXY="localhost,127.0.0.1,::1"
export no_proxy="${NO_PROXY}"

export PORT="${PORT:-3000}"
# Bind to all interfaces so http://localhost:3000 and http://127.0.0.1:3000 both work
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

# Avoid "EMFILE: too many open files" so Next.js dev can watch files and serve routes (fixes 404 on /)
# Try to raise soft limit; child processes (npm -> node) inherit this.
current=$(ulimit -n 2>/dev/null || echo "0")
for n in 10240 8192 4096 2048 1024; do
  if ulimit -n "$n" 2>/dev/null; then
    new=$(ulimit -n 2>/dev/null || echo "?")
    echo "    Open-file limit: $current -> $new (avoids EMFILE / 404 on /)"
    break
  fi
done
final=$(ulimit -n 2>/dev/null || echo "?")
if [ "${final:-0}" -lt 1024 ] 2>/dev/null; then
  echo "    WARNING: limit still low ($final). Run in this terminal first: ulimit -n 10240"
  echo "    Then run this script again, or use: npm run local:prod"
fi

echo "==> Starting dev server (NO_PROXY set for localhost)"
echo "    Open in browser: http://localhost:${PORT}"
echo "    Or:              http://127.0.0.1:${PORT}"
echo "    (Wait for 'Ready' before opening.)"
echo ""

exec npm run dev
