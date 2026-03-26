#!/usr/bin/env bash
# Secure AI Chat — Remote production upgrade (one-liner friendly)
#
# Defaults GIT_REF to the current production release tag (v1.0.18) and runs the
# same flow as scripts/upgrade-curl-production.sh: backup, fetch, checkout,
# npm install/ci, build, restart systemd, health/version checks. Build failures
# on a non-main ref retry once by checking out main (see upgrade-curl-production.sh).
#
# DATA_DIR and uploaded files: not deleted by this script (same as other upgrade paths).
#
# Usage (SSH into the VM, then):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production.sh | bash
#
# Custom app directory (required if not under default paths — set for the bash that runs the script):
#
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production.sh | APP_DIR=/opt/secure-ai-chat bash
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production.sh | bash -s -- /opt/secure-ai-chat
#
# Track main instead of the release tag:
#
#   GIT_REF=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production.sh | bash
#
# Pin another tag or branch:
#
#   GIT_REF=v1.0.17 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production.sh | bash
#
# Repo / script URL (change owner/repo if you use a fork):
#   https://github.com/mazh-cp/secure-ai-chat
#
# If this URL returns 404, the file is not on main yet — use the canonical script
# (same behavior; set GIT_REF yourself). Default there is already main:
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
#   GIT_REF=v1.0.18 curl -fsSL .../upgrade-curl-production.sh | bash
#
set -euo pipefail

GIT_REF="${GIT_REF:-v1.0.18}"
export GIT_REF

UPGRADE_SCRIPT_URL="${UPGRADE_SCRIPT_URL:-https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh}"

echo "==> Remote production upgrade (GIT_REF=${GIT_REF})"
echo "==> Using upgrade script: ${UPGRADE_SCRIPT_URL}"
echo ""

curl -fsSL "${UPGRADE_SCRIPT_URL}" | bash -s -- "$@"
