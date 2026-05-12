#!/usr/bin/env bash
# Secure AI Chat - Curl one-liner upgrade for production VM
# Repo: https://github.com/mazh-cp/secure-ai-chat
# Default APP_DIR: auto-detect (prefers /opt/secure-ai-chat, then common home paths; override with APP_DIR)
# Default ref: main (override with GIT_REF). Use main for latest; tags (e.g. v1.0.20) are supported.
#
# Optional (export before piping, or use scripts/upgrade-remote-production-v2.sh):
#   RUN_TYPECHECK=1     — run npm run type-check before build (stricter production upgrades)
#   HEALTH_RETRIES=12   — after start, retry curl /api/health this many times (1s apart)
#   USE_BUILD_FRESH=1   — run npm run build:fresh instead of build (secrets scan + typecheck + lint;
#                         skips duplicate RUN_TYPECHECK). VM needs devDependencies (full npm install).
#
# Retry with main: If the build fails and GIT_REF is not main, the script automatically
# retries by checking out main, reinstalling dependencies, and building again so upgrades
# stay seamless even when a tag has a transient build issue.
#
# Usage (production VM via SSH):
#   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
#
# IMPORTANT — variables on the LEFT of `|` apply only to curl, NOT to bash. Wrong:
#   GIT_REF=v1.1.12 APP_DIR=/opt/secure-ai-chat curl ... | bash   # bash will NOT see GIT_REF / APP_DIR / USE_BUILD_FRESH
# Right — put overrides on the RIGHT (bash side) or export first, then pipe:
#   curl -fsSL .../upgrade-curl-production.sh | APP_DIR=/opt/secure-ai-chat GIT_REF=main USE_BUILD_FRESH=1 bash
#   curl -fsSL .../upgrade-curl-production.sh | bash -s -- /opt/secure-ai-chat
# Or:  export APP_DIR=/opt/secure-ai-chat GIT_REF=main USE_BUILD_FRESH=1
#       curl -fsSL .../upgrade-curl-production.sh | bash
#
# If the app lives under another user's home (e.g. /home/adminuser/secure-ai-chat) but systemd
# User= is secureai, auto-detection uses the directory owner for git/npm. Override explicitly:
#   curl -fsSL .../upgrade-curl-production.sh | APP_USER=adminuser bash
#
# If GIT_REF is a version tag (v1.2.3) that does not exist on origin yet, the script
# falls back to GIT_REF_FALLBACK (default: main). Push tags for reproducible deploys:
#   git tag v1.0.20 && git push origin v1.0.20

set -euo pipefail

# Bumped when upgrade behavior changes (appears in logs so support can see which script ran).
UPGRADE_CURL_SCRIPT_REV="${UPGRADE_CURL_SCRIPT_REV:-20260511a}"

# Configuration: APP_DIR from env, or first argument (for "bash -s -- /path"), or auto-detect
# Use sudo test where needed: /opt installs are often root-owned; adminuser cannot [ -d ] / [ -f ] them.
if [ -n "${1:-}" ]; then
  if sudo test -d "${1}" 2>/dev/null || test -d "${1}" 2>/dev/null; then
    APP_DIR="$1"
  fi
fi
if [ -z "${APP_DIR:-}" ]; then
  _try_opt="/opt/secure-ai-chat"
  _try_admin_home="/home/adminuser/secure-ai-chat"
  _try_login_home="${HOME}/secure-ai-chat"
  if { sudo test -d "$_try_opt" 2>/dev/null && sudo test -f "$_try_opt/package.json" 2>/dev/null; }; then
    APP_DIR="$_try_opt"
  elif { sudo test -d "$_try_admin_home" 2>/dev/null && sudo test -f "$_try_admin_home/package.json" 2>/dev/null; }; then
    APP_DIR="$_try_admin_home"
  elif { sudo test -d "$_try_login_home" 2>/dev/null && sudo test -f "$_try_login_home/package.json" 2>/dev/null; }; then
    APP_DIR="$_try_login_home"
  else
    # Prefer /opt in messages — matches install-remote-production-vm / production-upgrade defaults
    APP_DIR="$_try_opt"
  fi
fi
APP_DIR="${APP_DIR:-/opt/secure-ai-chat}"
GIT_REF="${GIT_REF:-main}"
GIT_REF_FALLBACK="${GIT_REF_FALLBACK:-main}"
REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
RUN_TYPECHECK="${RUN_TYPECHECK:-0}"
HEALTH_RETRIES="${HEALTH_RETRIES:-0}"
# USE_BUILD_FRESH=1 — run npm run build:fresh (check:secrets, typecheck, lint, clean .next, build, verify)
# instead of optional type-check + npm run build. Requires devDependencies on the VM (eslint, etc.).
USE_BUILD_FRESH="${USE_BUILD_FRESH:-0}"
if { [ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ]; } && [ "${HEALTH_RETRIES}" = "0" ]; then
  HEALTH_RETRIES=12
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; exit 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Secure AI Chat - Production Upgrade (curl one-liner)      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
say "upgrade-curl-production.sh id: $UPGRADE_CURL_SCRIPT_REV (if missing, push main to GitHub or run: cd APP_DIR && sudo bash scripts/upgrade-curl-production.sh)"

# Directory must exist (use sudo for check; APP_DIR may be owned by app user e.g. secureai)
# If default path missing, try common locations so upgrade works without setting APP_DIR
if ! sudo test -d "$APP_DIR" 2>/dev/null && ! test -d "$APP_DIR" 2>/dev/null; then
  FOUND=""
  for try in /opt/secure-ai-chat "$HOME/secure-ai-chat" /var/lib/secure-ai-chat; do
    if [ -n "$try" ] && { sudo test -d "$try" 2>/dev/null || test -d "$try" 2>/dev/null; } && { sudo test -f "$try/package.json" 2>/dev/null || test -f "$try/package.json" 2>/dev/null; }; then
      FOUND="$try"
      break
    fi
  done
  if [ -n "$FOUND" ]; then
    say "Default path not found; using detected app dir: $FOUND"
    APP_DIR="$FOUND"
  else
    fail "App directory not found: $APP_DIR"
    echo ""
    echo "  If the app is installed elsewhere, set APP_DIR (for the bash process, not curl):"
    echo "  curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | APP_DIR=/path/to/secure-ai-chat bash"
    echo "  or:  curl -fsSL .../upgrade-curl-production.sh | bash -s -- /path/to/secure-ai-chat"
    echo ""
    echo "  If this is a FRESH install (no app yet), run the install script first:"
    echo "  curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh | bash"
    echo ""
    echo "  To look for an existing install: ls -la /opt/secure-ai-chat ~/secure-ai-chat 2>/dev/null"
    exit 1
  fi
fi

# Resolve app root (where package.json lives). Match fresh install: flat or one-level nested.
# Use multiple probes: sudo test, test, sudo cat (some environments break sudo test -f).
APP_ROOT=""
if sudo test -f "$APP_DIR/package.json" 2>/dev/null || test -f "$APP_DIR/package.json" 2>/dev/null; then
  APP_ROOT="$APP_DIR"
fi
if [ -z "$APP_ROOT" ] && sudo cat "$APP_DIR/package.json" >/dev/null 2>&1; then
  APP_ROOT="$APP_DIR"
fi
if [ -z "$APP_ROOT" ]; then
  for sub in "$APP_DIR/secure-ai-chat" "$APP_DIR/app" "$APP_DIR/repo"; do
    if sudo test -f "$sub/package.json" 2>/dev/null || test -f "$sub/package.json" 2>/dev/null; then
      APP_ROOT="$sub"
      break
    fi
  done
fi
if [ -z "$APP_ROOT" ]; then
  for d in $(sudo find "$APP_DIR" -maxdepth 1 -mindepth 1 -type d ! -name '.*' 2>/dev/null); do
    if sudo test -f "$d/package.json" 2>/dev/null; then
      APP_ROOT="$d"
      break
    fi
  done
fi
if [ -z "$APP_ROOT" ]; then
  echo ""
  echo "  Contents of $APP_DIR (sudo ls):"
  sudo ls -la "$APP_DIR" 2>/dev/null | head -20
  fail "Not a secure-ai-chat app directory (no package.json in $APP_DIR or one level down). Check path or run: sudo ls $APP_DIR"
  exit 1
fi
if [ "$APP_ROOT" != "$APP_DIR" ]; then
  say "Using app root: $APP_ROOT (package.json found one level under $APP_DIR)"
  APP_DIR="$APP_ROOT"
fi

say "App directory: $APP_DIR"
say "Git reference: $GIT_REF"
if [ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ]; then
  say "Build mode: build:fresh (secrets gate + typecheck + lint + production build)"
fi
echo ""

# Detect app user: must be able to cd to APP_DIR (e.g. secureai cannot enter /home/adminuser/...).
try_cd_as_user() {
  local u="$1"
  [ -z "$u" ] && return 1
  sudo -u "$u" bash -c "cd \"$APP_DIR\" 2>/dev/null" || return 1
  return 0
}

DIR_OWNER=$(sudo stat -c '%U' "$APP_DIR" 2>/dev/null || sudo stat -f '%Su' "$APP_DIR" 2>/dev/null || echo "")
UNIT_USER=""
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
  UNIT_USER=$(grep "^User=" "/etc/systemd/system/${SERVICE_NAME}.service" 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")
fi

if [ -n "${APP_USER:-}" ]; then
  if ! try_cd_as_user "$APP_USER"; then
    warn "APP_USER=$APP_USER cannot access $APP_DIR; ignoring override and auto-detecting"
    APP_USER=""
  fi
fi

if [ -z "${APP_USER:-}" ]; then
  if try_cd_as_user "$UNIT_USER"; then
    APP_USER="$UNIT_USER"
  elif try_cd_as_user "$DIR_OWNER"; then
    APP_USER="$DIR_OWNER"
    if [ -n "$UNIT_USER" ] && [ "$UNIT_USER" != "$DIR_OWNER" ]; then
      warn "systemd User=$UNIT_USER cannot cd to $APP_DIR; using directory owner $APP_USER for git/npm/build"
      warn "Fix long-term: set systemd User=$APP_USER, or move app to /opt/secure-ai-chat owned by the service user"
    fi
  elif try_cd_as_user "$(whoami)"; then
    APP_USER="$(whoami)"
  else
    fail "No user can cd to $APP_DIR. Try: curl -fsSL ... | APP_USER=adminuser bash (or chmod +x parent home dirs)"
  fi
fi
say "App user: $APP_USER"

# Backup (use /tmp to avoid permission issues inside APP_DIR; /tmp may be cleared on reboot)
BACKUP_DIR="/tmp/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
say "Creating backup at $BACKUP_DIR"
mkdir -p "$BACKUP_DIR" || fail "Cannot create backup dir $BACKUP_DIR. Check: df /tmp (disk full?), ls -ld /tmp (writable?). Note: backups live in /tmp and may be cleared on reboot."
sudo test -f "$APP_DIR/.env.local" && sudo cp -a "$APP_DIR/.env.local" "$BACKUP_DIR/" || true
sudo test -d "$APP_DIR/.secure-storage" && sudo cp -a "$APP_DIR/.secure-storage" "$BACKUP_DIR/" || true
sudo test -d "$APP_DIR/.storage" && sudo cp -a "$APP_DIR/.storage" "$BACKUP_DIR/" 2>/dev/null || true
ok "Backup done"

# Stop service
say "Stopping service: $SERVICE_NAME"
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  sudo systemctl stop "$SERVICE_NAME" || true
  sleep 2
  ok "Service stopped"
else
  warn "Service not running"
fi

# Git fetch and checkout (run as APP_USER). Handle shallow single-branch clone (e.g. from tag v1.0.16).
say "Fetching and checking out: $GIT_REF"
run_in_app_dir() {
  if [ "$(whoami)" = "$APP_USER" ]; then
    (cd "$APP_DIR" && "$@")
  else
    sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && $*"
  fi
}
# Shallow clone with --branch tag has only that ref. Expand to fetch all branches so origin/main exists.
run_in_app_dir git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*' 2>/dev/null || true
run_in_app_dir git fetch origin --tags 2>/dev/null || true
run_in_app_dir git fetch origin 2>/dev/null || true

checkout_git_ref() {
  local ref="$1"
  if run_in_app_dir git show-ref -q "origin/$ref" 2>/dev/null; then
    run_in_app_dir git checkout -B "$ref" "origin/$ref" 2>/dev/null || run_in_app_dir git checkout "$ref" 2>/dev/null || {
      warn "Checkout failed. Git status:"
      run_in_app_dir git status 2>&1 || true
      run_in_app_dir git branch -a 2>&1 || true
      return 1
    }
    # Match remote exactly (pull with `|| true` could leave a stale package.json if pull failed silently).
    if run_in_app_dir git reset --hard "origin/$ref" 2>/dev/null; then
      :
    else
      warn "git reset --hard origin/$ref failed (permissions or local changes?); trying pull"
      run_in_app_dir git pull origin "$ref" || warn "git pull origin $ref also failed"
    fi
    ok "Checked out $ref (latest from origin)"
    return 0
  fi
  if run_in_app_dir git rev-parse "$ref" 2>/dev/null; then
    run_in_app_dir git checkout "$ref" 2>/dev/null || return 1
    ok "Checked out $ref (tag or ref)"
    return 0
  fi
  return 1
}

ORIGINAL_GIT_REF="$GIT_REF"
# Checkout: branch (e.g. main) or tag.
if checkout_git_ref "$GIT_REF"; then
  :
elif echo "$ORIGINAL_GIT_REF" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  warn "Ref $ORIGINAL_GIT_REF not found on origin (tag not pushed or shallow clone). Using $GIT_REF_FALLBACK instead."
  warn "To pin releases: git tag $ORIGINAL_GIT_REF && git push origin $ORIGINAL_GIT_REF"
  GIT_REF="$GIT_REF_FALLBACK"
  if checkout_git_ref "$GIT_REF"; then
    :
  else
    echo ""
    run_in_app_dir git branch -a 2>&1 || true
    fail "Ref $GIT_REF not found. Run: cd $APP_DIR && sudo -u $APP_USER git fetch origin && git branch -a"
  fi
else
  echo ""
  run_in_app_dir git branch -a 2>&1 || true
  fail "Ref $GIT_REF not found. Run: cd $APP_DIR && sudo -u $APP_USER git fetch origin && git branch -a"
fi

PKG_VER_LINE="$(sudo grep -m1 '"version"' "$APP_DIR/package.json" 2>/dev/null || true)"
say "After checkout: $PKG_VER_LINE (HEAD $(run_in_app_dir git rev-parse --short HEAD 2>/dev/null || echo '?'))"

# Restore backup over any changed config (use sudo to write into APP_DIR if needed)
if [ -f "$BACKUP_DIR/.env.local" ]; then
  sudo cp -a "$BACKUP_DIR/.env.local" "$APP_DIR/" 2>/dev/null || cp -a "$BACKUP_DIR/.env.local" "$APP_DIR/" || true
fi
if [ -d "$BACKUP_DIR/.secure-storage" ]; then
  sudo cp -a "$BACKUP_DIR/.secure-storage" "$APP_DIR/" 2>/dev/null || cp -a "$BACKUP_DIR/.secure-storage" "$APP_DIR/" || true
fi
if [ -d "$BACKUP_DIR/.storage" ]; then
  sudo cp -a "$BACKUP_DIR/.storage" "$APP_DIR/" 2>/dev/null || cp -a "$BACKUP_DIR/.storage" "$APP_DIR/" || true
fi

# --- Config migration: inject new required vars into .env.local if absent ---
# This runs after backup restore so every upgrade (not just fresh installs) picks up
# variables added in newer releases. Safe to run repeatedly — only appends if missing.
say "Checking .env.local for required configuration..."
ENV_FILE="$APP_DIR/.env.local"
if ! sudo test -f "$ENV_FILE" 2>/dev/null; then
  # No .env.local yet — create a minimal one so the app can start
  PKG_VER_NOW=$(sudo grep -m1 '"version"' "$APP_DIR/package.json" 2>/dev/null | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo '0.0.0')
  APP_PORT_NOW=$(sudo grep -m1 '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo '3000')
  sudo -u "$APP_USER" tee "$ENV_FILE" >/dev/null <<ENVEOF
OPENAI_API_KEY=
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=
NEXT_PUBLIC_APP_NAME=Secure AI Chat
NEXT_PUBLIC_APP_VERSION=${PKG_VER_NOW}
PORT=${APP_PORT_NOW}
HOSTNAME=0.0.0.0
NODE_ENV=production
SHARED_ORG_OWNER_ID=org
ENVEOF
  warn "Created minimal .env.local — add OPENAI_API_KEY (and LAKERA_AI_KEY if using Lakera Guard)"
fi

# Inject SHARED_ORG_OWNER_ID if not already present.
# Without it every browser session gets a different UUID owner, so files uploaded in one session
# are invisible to another and RAG silently returns no context.
if ! sudo grep -q '^SHARED_ORG_OWNER_ID=' "$ENV_FILE" 2>/dev/null; then
  echo '' | sudo tee -a "$ENV_FILE" >/dev/null
  echo '# Shared file + RAG namespace — all sessions share one corpus (required for RAG on single-org VMs)' | sudo tee -a "$ENV_FILE" >/dev/null
  echo 'SHARED_ORG_OWNER_ID=org' | sudo tee -a "$ENV_FILE" >/dev/null
  ok "Injected SHARED_ORG_OWNER_ID=org into .env.local (was missing — RAG fix)"
else
  ok "SHARED_ORG_OWNER_ID already set in .env.local"
fi
sudo chown "$APP_USER:$APP_USER" "$ENV_FILE" 2>/dev/null || true

# install_ubuntu_clean installs nvm under APP_DIR/.nvm using HOME=INSTALL_DIR for the app user.
# sudo -u secureai leaves HOME=/home/secureai — then system Node/npm run → EBADENGINE + npm 9.2 "Invalid comparator" on overrides.
APP_HOME="$APP_DIR"

# Run shell as APP_USER with HOME=APP_HOME, load nvm, nvm use (from .nvmrc) or nvm install, then eval CMD.
run_app_nvm_cmd() {
  local cmd="$1"
  if [ "$(whoami)" = "$APP_USER" ]; then
    env APP_HOME="$APP_HOME" APP_DIR="$APP_DIR" CMD="$cmd" bash <<'NVMRUN'
set -euo pipefail
export HOME="$APP_HOME"
cd "$APP_DIR" || exit 1
if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
  echo "Expected nvm at $HOME/.nvm/nvm.sh (install_ubuntu_clean uses HOME=app dir for this user). See scripts/install_ubuntu_clean.sh Phase 3." >&2
  exit 2
fi
# shellcheck disable=SC1090
. "$HOME/.nvm/nvm.sh"
if ! nvm use >/dev/null 2>&1; then
  nvm install
  nvm use
fi
eval "$CMD"
NVMRUN
  else
    sudo -u "$APP_USER" env APP_HOME="$APP_HOME" APP_DIR="$APP_DIR" CMD="$cmd" bash <<'NVMRUN'
set -euo pipefail
export HOME="$APP_HOME"
cd "$APP_DIR" || exit 1
if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
  echo "Expected nvm at $HOME/.nvm/nvm.sh (HOME must be app dir for this install layout)." >&2
  exit 2
fi
# shellcheck disable=SC1090
. "$HOME/.nvm/nvm.sh"
if ! nvm use >/dev/null 2>&1; then
  nvm install
  nvm use
fi
eval "$CMD"
NVMRUN
  fi
}

say "Installing dependencies (npm install)"
run_app_nvm_cmd 'npm install || npm ci' || fail "npm install failed"
ok "Dependencies installed"

# Optional TypeScript check before build (RUN_TYPECHECK=1); skipped when USE_BUILD_FRESH=1
if [ "${USE_BUILD_FRESH}" != "1" ] && [ "${USE_BUILD_FRESH}" != "true" ]; then
  if [ "${RUN_TYPECHECK}" = "1" ] || [ "${RUN_TYPECHECK}" = "true" ]; then
    say "Running type-check (RUN_TYPECHECK=1)"
    run_app_nvm_cmd 'npm run type-check' || fail "type-check failed; fix errors or set RUN_TYPECHECK=0"
    ok "type-check passed"
  fi
else
  say "Skipping separate type-check (included in npm run build:fresh)"
fi

# When USE_BUILD_FRESH=1: prefer npm run build:fresh; if package.json has no such script (fork / old
# tree while HEAD matches upstream), run the same steps: clear, optional gates, build.
run_npm_build_fresh_or_fallback() {
  local _inner
  _inner=$(cat <<'BUILD_FRESH_INNER'
set -euo pipefail
export HOME="$APP_HOME"
cd "$APP_DIR" || exit 1
if [ ! -s "$HOME/.nvm/nvm.sh" ]; then echo "[upgrade-curl-production] ERROR: missing $HOME/.nvm/nvm.sh" >&2; exit 2; fi
# shellcheck disable=SC1090
. "$HOME/.nvm/nvm.sh"
if ! nvm use >/dev/null 2>&1; then nvm install; nvm use; fi
if node -e "const p=require(\"./package.json\");const s=p.scripts||{};process.exit(s[\"build:fresh\"]?0:1)" 2>/dev/null; then
  exec npm run build:fresh
fi
echo "[upgrade-curl-production] WARN: scripts.build:fresh missing in package.json (different origin or old tree). Running: clear, optional check:secrets/typecheck/lint, build." >&2
if npm run clear 2>/dev/null; then :; else rm -rf .next; fi
if node -e "const p=require(\"./package.json\");process.exit((p.scripts||{})[\"check:secrets\"]?0:1)" 2>/dev/null; then npm run check:secrets; fi
if node -e "const p=require(\"./package.json\");process.exit((p.scripts||{})[\"typecheck\"]?0:1)" 2>/dev/null; then npm run typecheck
elif node -e "const p=require(\"./package.json\");process.exit((p.scripts||{})[\"type-check\"]?0:1)" 2>/dev/null; then npm run type-check; fi
if node -e "const p=require(\"./package.json\");process.exit((p.scripts||{})[\"lint\"]?0:1)" 2>/dev/null; then npm run lint; fi
exec npm run build
BUILD_FRESH_INNER
)
  if [ "$(whoami)" = "$APP_USER" ]; then
    env APP_DIR="$APP_DIR" APP_HOME="$APP_HOME" bash -c "$_inner"
  else
    sudo -u "$APP_USER" env APP_DIR="$APP_DIR" APP_HOME="$APP_HOME" bash -c "$_inner"
  fi
}

# Build (retry with main if build fails, e.g. old tag had TypeScript error)
build_ok=false
if [ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ]; then
  BUILD_LABEL="npm run build:fresh (or equivalent if script missing)"
else
  BUILD_LABEL="npm run build"
fi
for attempt in 1 2; do
  if [ "$attempt" -eq 2 ]; then say "Building application (retry with main): $BUILD_LABEL"; else say "Building application: $BUILD_LABEL"; fi
  if [ "$(whoami)" = "$APP_USER" ]; then
    if [ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ]; then
      if run_npm_build_fresh_or_fallback; then build_ok=true; break; fi
    else
      if run_app_nvm_cmd 'npm run build'; then build_ok=true; break; fi
    fi
  else
    if [ "${USE_BUILD_FRESH}" = "1" ] || [ "${USE_BUILD_FRESH}" = "true" ]; then
      if run_npm_build_fresh_or_fallback; then build_ok=true; break; fi
    else
      if run_app_nvm_cmd 'npm run build'; then build_ok=true; break; fi
    fi
  fi
  if [ "$attempt" -eq 1 ] && [ "$GIT_REF" != "main" ]; then
    warn "Build failed. Retrying with main (latest fixes)..."
    run_in_app_dir git fetch origin 2>/dev/null || true
    run_in_app_dir git checkout -B main origin/main 2>/dev/null || run_in_app_dir git checkout main 2>/dev/null || true
    run_in_app_dir git reset --hard origin/main 2>/dev/null || {
      warn "git reset --hard origin/main failed; trying pull"
      run_in_app_dir git pull --ff-only origin main 2>/dev/null || run_in_app_dir git pull origin main 2>/dev/null || true
    }
    GIT_REF=main
    [ -f "$BACKUP_DIR/.env.local" ] && sudo cp -a "$BACKUP_DIR/.env.local" "$APP_DIR/" 2>/dev/null || true
    [ -d "$BACKUP_DIR/.secure-storage" ] && sudo cp -a "$BACKUP_DIR/.secure-storage" "$APP_DIR/" 2>/dev/null || true
    [ -d "$BACKUP_DIR/.storage" ] && sudo cp -a "$BACKUP_DIR/.storage" "$APP_DIR/" 2>/dev/null || true
    say "Reinstalling dependencies after checkout main"
    run_app_nvm_cmd 'npm install || npm ci' || true
  elif [ "$attempt" -eq 1 ] && [ "$GIT_REF" = "main" ]; then
    warn "Build failed on main — syncing working tree to origin/main..."
    run_in_app_dir git fetch origin 2>/dev/null || true
    run_in_app_dir git checkout -B main origin/main 2>/dev/null || run_in_app_dir git checkout main 2>/dev/null || true
    run_in_app_dir git reset --hard origin/main 2>/dev/null || {
      warn "git reset --hard origin/main failed; trying pull"
      run_in_app_dir git pull --ff-only origin main 2>/dev/null || run_in_app_dir git pull origin main 2>/dev/null || true
    }
    say "Reinstalling dependencies after git sync"
    run_app_nvm_cmd 'npm install || npm ci' || true
  else
    break
  fi
done
[ "$build_ok" = true ] || fail "Build failed. On VM use app nvm (HOME=app dir): sudo -u $APP_USER env HOME=$APP_DIR bash -lc 'cd $APP_DIR && . \"\$HOME/.nvm/nvm.sh\" && nvm use && npm run build'. Or: curl .../upgrade-curl-production.sh | ... bash (id: $UPGRADE_CURL_SCRIPT_REV)"
ok "Build complete"

if [ -n "${UNIT_USER:-}" ] && [ -n "${APP_USER:-}" ] && [ "$UNIT_USER" != "$APP_USER" ]; then
  warn "systemd unit uses User=$UNIT_USER but this upgrade ran git/npm/build as $APP_USER."
  warn "If the service fails to read files, set User=$APP_USER and Group=$APP_USER in /etc/systemd/system/${SERVICE_NAME}.service, then: sudo systemctl daemon-reload && sudo systemctl restart $SERVICE_NAME"
  warn "If the app lives under /home/otheruser with mode 700, the service account must be that user (or move the app to e.g. /opt/secure-ai-chat)."
fi

# Start service
say "Starting service: $SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME" 2>/dev/null || true
sleep 3
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  ok "Service started"
else
  warn "Service may not have started; check: sudo journalctl -u $SERVICE_NAME -n 30"
fi
# App runs on port 3000 only (no nginx); skip nginx reload.

# Optional health probe (HEALTH_RETRIES > 0 or default when RUN_TYPECHECK=1)
HR="${HEALTH_RETRIES}"
if [ -z "$HR" ] || [ "$HR" = "0" ]; then
  if [ "${RUN_TYPECHECK}" = "1" ] || [ "${RUN_TYPECHECK}" = "true" ]; then HR=12; fi
fi
if [ -n "$HR" ] && [ "$HR" -gt 0 ] 2>/dev/null; then
  say "Waiting for /api/health (up to ${HR} attempts)"
  health_ok=false
  i=1
  while [ "$i" -le "$HR" ]; do
    if curl -fsS --max-time 5 "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
      health_ok=true
      ok "Health check passed (attempt $i)"
      break
    fi
    sleep 1
    i=$((i + 1))
  done
  [ "$health_ok" = true ] || warn "Health check did not succeed after ${HR} attempts; verify: curl -s http://127.0.0.1:3000/api/health"
fi

# Version check (sudo in case APP_DIR is owned by app user)
NEW_VERSION=$(sudo cat "$APP_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
say "Upgrade complete. Version: $NEW_VERSION"
echo ""
echo "  Backup: $BACKUP_DIR"
echo "  (Backup is in /tmp; move it elsewhere if you need to keep it after reboot.)"
echo "  Health: curl -s http://localhost:3000/api/health"
echo "  Logs:   sudo journalctl -u $SERVICE_NAME -f"
echo ""
