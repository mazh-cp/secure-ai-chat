#!/usr/bin/env bash
# Secure AI Chat - Cleanup/Reset Script for Ubuntu VM
# Safely removes the application, services, and nginx configuration
#
# Usage:
#   bash scripts/cleanup_reset_vm.sh [--remove-user]

set -euo pipefail

# Configuration
INSTALL_DIR="/opt/secure-ai-chat"
APP_USER="secureai"
SERVICE_NAME="secure-ai-chat"
NGINX_SITE="secure-ai-chat"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }

REMOVE_USER=false
if [ "${1:-}" = "--remove-user" ]; then
    REMOVE_USER=true
fi

log_info "Starting Secure AI Chat cleanup..."

# Step 1: Stop and disable service
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    log_info "Stopping service: $SERVICE_NAME"
    sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    log_success "Service stopped"
else
    log_info "Service $SERVICE_NAME is not running"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    log_info "Disabling service: $SERVICE_NAME"
    sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    log_success "Service disabled"
fi

# Step 2: Remove systemd service file
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    log_info "Removing systemd service file"
    sudo rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    sudo systemctl daemon-reload
    log_success "Service file removed"
else
    log_info "Service file not found"
fi

# Step 3: Kill node/next processes bound to ports 3000-3999
log_info "Checking for node/next processes on ports 3000-3999"
KILLED=false
for port in $(seq 3000 3999); do
    if command -v ss >/dev/null 2>&1; then
        PID=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1 || true)
    elif command -v netstat >/dev/null 2>&1; then
        PID=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d/ -f1 | head -1 || true)
    else
        PID=""
    fi
    
    if [ -n "$PID" ] && ps -p "$PID" >/dev/null 2>&1; then
        PROC_CMD=$(ps -p "$PID" -o comm= 2>/dev/null || echo "")
        if echo "$PROC_CMD" | grep -qE "(node|next)"; then
            log_warning "Killing process $PID ($PROC_CMD) on port $port"
            sudo kill -9 "$PID" 2>/dev/null || true
            KILLED=true
        fi
    fi
done

if [ "$KILLED" = true ]; then
    log_success "Killed node/next processes on ports 3000-3999"
else
    log_info "No node/next processes found on ports 3000-3999"
fi

# Step 4: Remove nginx site
if [ -f "/etc/nginx/sites-available/${NGINX_SITE}" ]; then
    log_info "Removing nginx site: $NGINX_SITE"
    sudo rm -f "/etc/nginx/sites-enabled/${NGINX_SITE}"
    sudo rm -f "/etc/nginx/sites-available/${NGINX_SITE}"
    log_success "Nginx site removed"
else
    log_info "Nginx site not found"
fi

# Step 5: Restore default nginx site (if default config exists)
if [ -f "/etc/nginx/sites-available/default" ] && [ ! -f "/etc/nginx/sites-enabled/default" ]; then
    log_info "Restoring default nginx site"
    sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    log_success "Default nginx site restored"
fi

# Step 6: Test and reload nginx
if command -v nginx >/dev/null 2>&1; then
    log_info "Testing nginx configuration"
    if sudo nginx -t >/dev/null 2>&1; then
        sudo systemctl reload nginx 2>/dev/null || true
        log_success "Nginx reloaded"
    else
        log_warning "Nginx configuration test failed (may be expected)"
    fi
fi

# Step 7: Remove UFW nginx rule (if exists)
if sudo ufw status | grep -q "Nginx Full" 2>/dev/null; then
    log_info "Removing UFW nginx rule"
    sudo ufw delete allow 'Nginx Full' 2>/dev/null || true
    log_success "UFW nginx rule removed"
fi

# Step 8: Remove application directory
if [ -d "$INSTALL_DIR" ]; then
    log_info "Removing application directory: $INSTALL_DIR"
    sudo rm -rf "$INSTALL_DIR"
    log_success "Application directory removed"
else
    log_info "Application directory not found"
fi

# Step 9: Remove user (optional)
if [ "$REMOVE_USER" = true ]; then
    if id "$APP_USER" &>/dev/null; then
        log_warning "Removing user: $APP_USER"
        sudo userdel -r "$APP_USER" 2>/dev/null || sudo userdel "$APP_USER" 2>/dev/null || true
        log_success "User removed"
    else
        log_info "User $APP_USER does not exist"
    fi
else
    log_info "User $APP_USER preserved (use --remove-user to remove)"
fi

# Summary
log_success "Cleanup complete!"
echo ""
echo "Removed:"
echo "  - systemd service: $SERVICE_NAME"
echo "  - nginx site: $NGINX_SITE"
echo "  - application directory: $INSTALL_DIR"
if [ "$REMOVE_USER" = true ]; then
    echo "  - user: $APP_USER"
fi
echo ""
echo "To reinstall, run:"
echo "  curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash"
echo ""
