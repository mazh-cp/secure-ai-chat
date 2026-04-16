#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Remote production upgrade — canonical entry point (after code is on GitHub).
#
# Repo: https://github.com/mazh-cp/secure-ai-chat  (branch: main by default)
#
# 1) Push from your machine (project root = directory with package.json):
#      ./scripts/push-to-github.sh "Your release message"
#      # or:  git push origin main
#
# 2a) Upgrade FROM YOUR LAPTOP over SSH (runs the bundled VM helper):
#      ./scripts/remote-production-upgrade.sh user@production-host
#
#     Optional env (same as upgrade-remote-production-vm.sh):
#       APP_DIR=/opt/secure-ai-chat GIT_REF=main SSH_OPTS="-i ~/.ssh/id_ed25519" \
#         ./scripts/remote-production-upgrade.sh user@host
#
#       DIRECT=1 APP_DIR=/opt/secure-ai-chat APP_USER=secureai \
#         ./scripts/remote-production-upgrade.sh user@host
#
# 2b) Upgrade ON THE PRODUCTION VM (curl latest upgrade script from GitHub):
#      curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
#
#      With overrides:
#      APP_DIR=/opt/secure-ai-chat GIT_REF=main \
#        curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
#
# Standard installs under /opt/secure-ai-chat may use instead:
#      INSTALL_DIR=/opt/secure-ai-chat \
#        curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
#
# See: scripts/REMOTE-UPGRADE.md  docs/UPGRADE_REMOTE.md
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -n "${1:-}" ] && [[ "${1}" == *"@"* ]]; then
  exec bash "$SCRIPT_DIR/upgrade-remote-production-vm.sh" "$@"
fi

echo "=============================================================================="
echo "  Secure AI Chat — remote production upgrade"
echo "=============================================================================="
echo ""
echo "  No SSH target passed. Use one of:"
echo ""
echo "  Laptop → VM:"
echo "    $0 user@your-production-host"
echo ""
echo "  On the VM (after git push):"
echo "    curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash"
echo ""
echo "  Optional: APP_DIR=/opt/secure-ai-chat GIT_REF=main before the curl | bash"
echo "=============================================================================="
exit 0
