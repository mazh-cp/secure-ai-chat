#!/usr/bin/env bash
# Free port 3000 and start the app bound to 127.0.0.1 for reliable browser access.
set -e
cd "$(dirname "$0")/.."
echo "Checking port 3000..."
if lsof -ti :3000 >/dev/null 2>&1; then
  echo "Killing process(es) on port 3000..."
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
  sleep 2
fi
echo "Starting server at http://127.0.0.1:3000 ..."
exec npm run start:local
