#!/usr/bin/env bash
# Upgrade remote production VM after code is pushed to GitHub.
#
# 1) cp scripts/production-vm-upgrade.sample.env scripts/production-vm-upgrade.local.env
# 2) Edit production-vm-upgrade.local.env (SSH_TARGET, etc.)
# 3) git push origin main
# 4) ./scripts/production-vm-upgrade.sh
#
# You can still pass user@host as the first argument; it overrides SSH_TARGET for this run.
# Or use only env: ./scripts/deploy-upgrade-remote-vm.sh (same underlying script).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV="$SCRIPT_DIR/production-vm-upgrade.local.env"

if [ -f "$LOCAL_ENV" ]; then
  echo "==> Loading $LOCAL_ENV"
  set -a
  # shellcheck source=/dev/null
  source "$LOCAL_ENV"
  set +a
fi

exec bash "$SCRIPT_DIR/deploy-upgrade-remote-vm.sh" "$@"
