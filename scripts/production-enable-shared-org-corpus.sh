#!/usr/bin/env bash
# Run on the production VM after deploying >= 1.1.5. Appends SHARED_ORG_OWNER_ID to .env.local if missing, then restarts systemd.
#
# Usage (from any directory, as a user with sudo):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/production-enable-shared-org-corpus.sh | sudo -E bash -s
#
# Or from a repo checkout on the server:
#   sudo SHARED_ORG_OWNER_ID=org APP_DIR=/opt/secure-ai-chat SERVICE_NAME=secure-ai-chat bash scripts/production-enable-shared-org-corpus.sh
#
# Override defaults:
#   SHARED_ORG_OWNER_ID=acme-corp APP_DIR=/home/adminuser/secure-ai-chat sudo -E bash scripts/production-enable-shared-org-corpus.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/secure-ai-chat}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
SHARED_ORG_OWNER_ID="${SHARED_ORG_OWNER_ID:-org}"
ENV_FILE="$APP_DIR/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Create it first (e.g. from install or .env.example)." >&2
  exit 1
fi

if grep -qE '^[[:space:]]*SHARED_ORG_OWNER_ID=' "$ENV_FILE" 2>/dev/null; then
  echo "SHARED_ORG_OWNER_ID already set in $ENV_FILE — edit manually if you need a different value."
else
  printf '\n# Shared file + RAG corpus for all browsers (v1.1.5+)\nSHARED_ORG_OWNER_ID=%s\n' "$SHARED_ORG_OWNER_ID" >>"$ENV_FILE"
  echo "Appended SHARED_ORG_OWNER_ID=$SHARED_ORG_OWNER_ID to $ENV_FILE"
fi

if [[ "${EUID:-0}" -eq 0 ]]; then
  systemctl restart "$SERVICE_NAME"
else
  sudo systemctl restart "$SERVICE_NAME"
fi
echo "Restarted $SERVICE_NAME. Check: curl -sS http://127.0.0.1:${PORT:-3000}/api/owner | head -c 200"
echo "(Set PORT in .env.local if not 3000, or curl your public URL + /api/owner)"
