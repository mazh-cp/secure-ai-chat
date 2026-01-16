#!/usr/bin/env bash
# Common deployment utilities
# Sourced by upgrade.sh and clean-install.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
say() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
fail() { echo "${RED}❌ FAIL:${NC} $*"; return 1; }
ok() { echo "${GREEN}✅ PASS:${NC} $*"; }
warn() { echo "${YELLOW}⚠️  WARN:${NC} $*"; }

# Redact secrets from output
redact() {
  sed -E 's/(sk-[a-zA-Z0-9]{20,})/sk-***REDACTED***/g' | \
  sed -E 's/(TE_API_KEY_[a-zA-Z0-9]+)/TE_API_KEY_***REDACTED***/g' | \
  sed -E 's/(CHECKPOINT.*API.*KEY[=:][^[:space:]]+)/CHECKPOINT_API_KEY=***REDACTED***/g' | \
  sed -E 's/(Authorization:[[:space:]]*Bearer[[:space:]]+)[^[:space:]]+/\1***REDACTED***/g' | \
  sed -E 's/(apiKey[=:][^[:space:]]+)/apiKey=***REDACTED***/g'
}

# Detect package manager
detect_package_manager() {
  if [ -f "pnpm-lock.yaml" ]; then
    echo "pnpm"
  elif [ -f "yarn.lock" ]; then
    echo "yarn"
  elif [ -f "package-lock.json" ]; then
    echo "npm"
  else
    warn "No lockfile found, defaulting to npm"
    echo "npm"
  fi
}

# Get install command for package manager
get_install_cmd() {
  local pm="$1"
  case "$pm" in
    pnpm)
      echo "pnpm install --frozen-lockfile"
      ;;
    yarn)
      echo "yarn install --immutable || yarn install --frozen-lockfile"
      ;;
    npm)
      echo "npm ci"
      ;;
    *)
      echo "npm ci"
      ;;
  esac
}

# Get run command for package manager
get_run_cmd() {
  local pm="$1"
  case "$pm" in
    pnpm)
      echo "pnpm"
      ;;
    yarn)
      echo "yarn"
      ;;
    npm)
      echo "npm"
      ;;
    *)
      echo "npm"
      ;;
  esac
}

# Ensure Node.js version matches requirement
ensure_node_version() {
  local required_version="${1:-24.13.0}"
  say "Checking Node.js version (required: v${required_version})"
  
  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js not found. Please install Node.js v${required_version}"
    return 1
  fi
  
  local current_version
  current_version=$(node -v | tr -d 'v')
  
  # Check if using nvm
  if [ -d "$HOME/.nvm" ] || [ -n "${NVM_DIR:-}" ]; then
    local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$nvm_dir/nvm.sh" ]; then
      # shellcheck source=/dev/null
      . "$nvm_dir/nvm.sh"
      
      # Check if required version is installed
      if nvm list | grep -q "v${required_version}"; then
        nvm use "${required_version}" >/dev/null 2>&1
        ok "Node.js v${required_version} activated via nvm"
      else
        warn "Node.js v${required_version} not found in nvm, installing..."
        nvm install "${required_version}" >/dev/null 2>&1
        nvm use "${required_version}" >/dev/null 2>&1
        nvm alias default "${required_version}" >/dev/null 2>&1
        ok "Node.js v${required_version} installed and activated"
      fi
      
      current_version=$(node -v | tr -d 'v')
    fi
  fi
  
  if [ "$current_version" = "$required_version" ]; then
    ok "Node.js version: v${current_version}"
    return 0
  else
    warn "Node.js version mismatch: v${current_version} (expected v${required_version})"
    warn "Continuing, but recommend upgrading to v${required_version}"
    return 0
  fi
}

# Ensure required environment variables are present (without exposing values)
ensure_env_present() {
  local env_file="${1:-/etc/secure-ai-chat.env}"
  
  say "Checking environment file: $env_file"
  
  if [ ! -f "$env_file" ]; then
    warn "Environment file not found: $env_file"
    warn "Create it with required variables (see docs/DEPLOYMENT.md)"
    return 0  # Don't fail, just warn
  fi
  
  # Check for required vars (without exposing values)
  local missing_vars=()
  
  # Note: We don't require API keys to be set (they can be configured via UI)
  # But we check if the file exists and is readable
  
  if [ -r "$env_file" ]; then
    ok "Environment file is readable"
    
    # Check for common required vars (without exposing values)
    if grep -q "^PORT=" "$env_file" 2>/dev/null || grep -q "^NODE_ENV=" "$env_file" 2>/dev/null; then
      ok "Environment file contains configuration"
    else
      warn "Environment file may be empty or incomplete"
    fi
  else
    warn "Environment file is not readable"
  fi
  
  return 0
}

# Get app user (from systemd service or current user)
get_app_user() {
  if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
    grep "^User=" /etc/systemd/system/secure-ai-chat.service | cut -d'=' -f2 || echo "$(whoami)"
  else
    echo "$(whoami)"
  fi
}

# Check if systemd service exists
is_systemd_service() {
  systemctl list-unit-files | grep -q "secure-ai-chat.service" 2>/dev/null
}

# Restart systemd service
restart_systemd_service() {
  local service_name="${1:-secure-ai-chat}"
  
  if is_systemd_service; then
    say "Restarting systemd service: $service_name"
    if sudo systemctl restart "$service_name"; then
      ok "Service restarted"
      sleep 3
      if sudo systemctl is-active --quiet "$service_name"; then
        ok "Service is running"
        return 0
      else
        fail "Service failed to start"
        sudo systemctl status "$service_name" --no-pager -l | head -20
        return 1
      fi
    else
      fail "Failed to restart service"
      return 1
    fi
  else
    warn "Systemd service not found, manual restart required"
    return 0
  fi
}

# Run smoke test
run_smoke_test() {
  local base_url="${1:-http://localhost:3000}"
  
  say "Running smoke tests against: $base_url"
  
  if [ -f "scripts/smoke-test.sh" ]; then
    BASE_URL="$base_url" bash scripts/smoke-test.sh
  else
    warn "smoke-test.sh not found, skipping smoke tests"
    return 0
  fi
}
