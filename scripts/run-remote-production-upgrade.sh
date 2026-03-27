#!/usr/bin/env bash
# Run the production VM upgrade over SSH from your laptop or CI.
# Uses the same curl | bash flow as running directly on the server.
#
# Usage:
#   export SSH_TARGET=adminuser@YOUR_VM_IP
#   bash scripts/run-remote-production-upgrade.sh
#
# Or pass user@host as the first argument:
#   bash scripts/run-remote-production-upgrade.sh adminuser@57.151.99.6
#
# Environment:
#   SSH_TARGET   — user@host (optional if first argument is set)
#   SSH_OPTS     — extra ssh args, e.g. "-i ~/.ssh/id_ed25519"
#   USE_V2       — if 1 (default), run upgrade-remote-production-v2.sh (pinned tag + type-check + health)
#   GIT_REF      — optional; forwarded only when non-empty (e.g. main)
#   APP_DIR      — optional remote app path
#   RUN_TYPECHECK, HEALTH_RETRIES — optional; only forwarded when USE_V2=1
#
# Examples:
#   SSH_TARGET=adminuser@57.151.99.6 bash scripts/run-remote-production-upgrade.sh
#   USE_V2=0 GIT_REF=main SSH_TARGET=user@host bash scripts/run-remote-production-upgrade.sh
#
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts}"
TARGET="${SSH_TARGET:-${1:-}}"
if [ -z "$TARGET" ]; then
  echo "Set SSH_TARGET=user@host or pass user@host as the first argument." >&2
  exit 1
fi

USE_V2="${USE_V2:-1}"
if [ "${USE_V2}" = "1" ] || [ "${USE_V2}" = "true" ]; then
  SCRIPT_NAME="upgrade-remote-production-v2.sh"
else
  SCRIPT_NAME="upgrade-remote-production.sh"
fi

REMOTE_URL="${REPO_RAW}/${SCRIPT_NAME}"

echo "==> SSH ${TARGET}  (script: ${SCRIPT_NAME})"
echo ""

# shellcheck disable=SC2086
exec ssh ${SSH_OPTS:-} -t "$TARGET" bash -s <<EOF
set -euo pipefail
$(if [ -n "${GIT_REF:-}" ]; then printf '%s\n' "export GIT_REF=$(printf '%q' "$GIT_REF")"; fi)
$(if [ -n "${APP_DIR:-}" ]; then printf '%s\n' "export APP_DIR=$(printf '%q' "$APP_DIR")"; fi)
$(if { [ "${USE_V2}" = "1" ] || [ "${USE_V2}" = "true" ]; } && [ -n "${RUN_TYPECHECK:-}" ]; then printf '%s\n' "export RUN_TYPECHECK=$(printf '%q' "$RUN_TYPECHECK")"; fi)
$(if { [ "${USE_V2}" = "1" ] || [ "${USE_V2}" = "true" ]; } && [ -n "${HEALTH_RETRIES:-}" ]; then printf '%s\n' "export HEALTH_RETRIES=$(printf '%q' "$HEALTH_RETRIES")"; fi)
curl -fsSL $(printf '%q' "$REMOTE_URL") | bash
EOF
