#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Canonical production upgrade — thin wrapper around upgrade-curl-production.sh
#
# Fixes the common mistake: VAR=value curl ... | bash  (vars apply only to curl).
# This script passes defaults on the bash side of the inner pipe.
#
# On the production VM (typical /opt install):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/production-upgrade.sh | bash
#
# Overrides (must be on THIS script's bash, not curl):
#   APP_DIR=/opt/secure-ai-chat GIT_REF=main USE_BUILD_FRESH=1 \
#     curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/production-upgrade.sh | bash
#
# Pin a release tag:
#   curl -fsSL .../production-upgrade.sh | GIT_REF=v1.1.12 bash
#
# Repo: https://github.com/mazh-cp/secure-ai-chat
# -----------------------------------------------------------------------------

set -euo pipefail

UPGRADE_SCRIPT_URL="${UPGRADE_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh}"

: "${APP_DIR:=/opt/secure-ai-chat}"
: "${GIT_REF:=main}"
: "${USE_BUILD_FRESH:=1}"

echo "==> Secure AI Chat — production upgrade"
echo "==> APP_DIR=$APP_DIR GIT_REF=$GIT_REF USE_BUILD_FRESH=$USE_BUILD_FRESH"
echo "==> Fetching: $UPGRADE_SCRIPT_URL"
echo ""

curl -fsSL "${UPGRADE_SCRIPT_URL}" | env APP_DIR="$APP_DIR" GIT_REF="$GIT_REF" USE_BUILD_FRESH="$USE_BUILD_FRESH" bash -s -- "$@"
