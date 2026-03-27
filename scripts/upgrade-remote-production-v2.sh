#!/usr/bin/env bash
# Secure AI Chat — Remote production upgrade (v2: stricter + health probe)
#
# If this URL 404s on GitHub, use the same behavior without this file:
#   curl -fsSL .../upgrade-curl-production.sh | GIT_REF=main RUN_TYPECHECK=1 bash
#
# Same flow as upgrade-curl-production.sh, but by default:
#   - GIT_REF is main (latest). Set GIT_REF=v1.0.20 when that tag exists on origin.
#   - RUN_TYPECHECK=1  — npm run type-check before build
#   - HEALTH_RETRIES   — after systemd start, retry /api/health (default 12 when type-check on)
#
# DATA_DIR and uploaded files are never deleted by the underlying script.
#
# On the production VM (SSH):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v2.sh | bash
#
# Custom app dir (env must apply to bash reading the pipe):
#   curl -fsSL .../upgrade-remote-production-v2.sh | APP_DIR=/opt/secure-ai-chat bash
#   curl -fsSL .../upgrade-remote-production-v2.sh | bash -s -- /opt/secure-ai-chat
#
# Track main (latest) instead of the tag (export so the inner bash sees it):
#   curl -fsSL .../upgrade-remote-production-v2.sh | GIT_REF=main bash
#   (or from your laptop: GIT_REF=main SSH_TARGET=user@host bash scripts/run-remote-production-upgrade.sh)
#
# Faster path (skip type-check; still pin GIT_REF unless you override):
#   curl -fsSL .../upgrade-remote-production-v2.sh | RUN_TYPECHECK=0 HEALTH_RETRIES=8 bash
#
# Fork / alternate repo script URL:
#   UPGRADE_SCRIPT_URL=https://raw.githubusercontent.com/you/secure-ai-chat/main/scripts/upgrade-curl-production.sh \
#     curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v2.sh | bash
#
set -euo pipefail

export GIT_REF="${GIT_REF:-main}"
export RUN_TYPECHECK="${RUN_TYPECHECK:-1}"
# When RUN_TYPECHECK=1, upgrade-curl-production.sh defaults health retries to 12 if HEALTH_RETRIES is 0.
export HEALTH_RETRIES="${HEALTH_RETRIES:-0}"

UPGRADE_SCRIPT_URL="${UPGRADE_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh}"

echo "==> Remote production upgrade v2 (GIT_REF=${GIT_REF} RUN_TYPECHECK=${RUN_TYPECHECK} HEALTH_RETRIES=${HEALTH_RETRIES})"
echo "==> Fetching: ${UPGRADE_SCRIPT_URL}"
echo ""

curl -fsSL "${UPGRADE_SCRIPT_URL}" | bash -s -- "$@"
