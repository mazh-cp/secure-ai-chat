#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Secure AI Chat — fresh production build from the remote GitHub repo
#
# On the VM this runs the same path as a v3 upgrade: fetch upgrade-curl-production.sh,
# then git checkout GIT_REF, npm install, npm run build:fresh (secrets + typecheck +
# lint + production build), systemd restart, optional /api/health retries.
#
# Default GIT_REF matches the current release pin (keep in sync with lib/app-release.ts).
#
# On the production VM (recommended — vars after the pipe apply to bash, not curl):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-production-build-from-remote-repo.sh | bash
#
# Track main instead of the tag:
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-production-build-from-remote-repo.sh | GIT_REF=main bash
#
# Custom install path (first arg is forwarded to upgrade-curl-production.sh):
#
#   curl -fsSL .../fresh-production-build-from-remote-repo.sh | bash -s -- /opt/secure-ai-chat
#
# Or env style:
#
#   curl -fsSL .../fresh-production-build-from-remote-repo.sh | APP_DIR=/opt/secure-ai-chat GIT_REF=v1.1.12 bash
#
# Fork / alternate origin (upgrade script only):
#
#   UPGRADE_SCRIPT_URL=https://raw.githubusercontent.com/you/secure-ai-chat/main/scripts/upgrade-curl-production.sh \
#     curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fresh-production-build-from-remote-repo.sh | bash
#
# Repo: https://github.com/mazh-cp/secure-ai-chat
# See also: scripts/upgrade-remote-production-v3.sh, scripts/production-upgrade.sh, UPGRADE_COMMANDS.md
# -----------------------------------------------------------------------------

set -euo pipefail

UPGRADE_SCRIPT_URL="${UPGRADE_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh}"

export GIT_REF="${GIT_REF:-v1.1.12}"
export USE_BUILD_FRESH="${USE_BUILD_FRESH:-1}"

echo "==> Fresh production build from remote repo"
echo "==> GIT_REF=${GIT_REF} USE_BUILD_FRESH=${USE_BUILD_FRESH}"
echo "==> Underlying: ${UPGRADE_SCRIPT_URL}"
echo ""

curl -fsSL "${UPGRADE_SCRIPT_URL}" | bash -s -- "$@"
