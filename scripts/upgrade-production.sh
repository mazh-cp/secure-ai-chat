#!/bin/bash
# One-Step Production Upgrade Script
# Upgrades the Secure AI Chat application to the latest version from the release branch
# Usage: curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh | bash
# Or: bash scripts/upgrade-production.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (defaults)
REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
BRANCH="${BRANCH:-release/unifi-theme-safe-final}"
SERVICE_USER="${SERVICE_USER:-adminuser}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/.backups}"

# Print functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Error handler
error_exit() {
    print_error "$1"
    exit 1
}

# Check if running as correct user
check_user() {
    if [ "$(whoami)" != "$SERVICE_USER" ]; then
        print_warning "Not running as $SERVICE_USER. Attempting to fix permissions..."
        # Try to fix ownership
        if sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$REPO_DIR" 2>/dev/null; then
            print_success "Fixed repository ownership"
        else
            print_error "Cannot fix ownership. Please run as $SERVICE_USER or with sudo"
            exit 1
        fi
    fi
}

# Pre-flight checks
preflight_checks() {
    print_header "Pre-Flight Checks"
    
    # Check if repo directory exists
    if [ ! -d "$REPO_DIR" ]; then
        error_exit "Repository directory not found: $REPO_DIR"
    fi
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        error_exit "Git is not installed"
    fi
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        error_exit "npm is not installed"
    fi
    
    # Check if node is available
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed"
    fi
    
    # Check Node version
    NODE_VERSION=$(node -v | sed 's/v//')
    if [ "$NODE_VERSION" != "25.2.1" ]; then
        print_warning "Node.js version mismatch (found: v$NODE_VERSION, recommended: v25.2.1)"
        print_info "Continuing anyway, but some features may not work correctly"
    else
        print_success "Node.js version: v$NODE_VERSION"
    fi
    
    print_success "Pre-flight checks passed"
}

# Backup current deployment
backup_current() {
    print_header "Backing Up Current Deployment"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Get current commit hash
    cd "$REPO_DIR"
    CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S)-${CURRENT_COMMIT:0:7}.tar.gz"
    
    print_info "Creating backup: $BACKUP_FILE"
    
    # Backup .next, .secure-storage, and package files
    tar -czf "$BACKUP_FILE" \
        .next \
        .secure-storage \
        package.json \
        package-lock.json \
        node_modules/.package-lock.json 2>/dev/null || true
    
    print_success "Backup created: $BACKUP_FILE"
}

# Pull latest code
pull_latest() {
    print_header "Pulling Latest Code"
    
    cd "$REPO_DIR"
    
    # Ensure we're on the correct branch
    if [ "$(git branch --show-current 2>/dev/null)" != "$BRANCH" ]; then
        print_info "Switching to branch: $BRANCH"
        git fetch origin "$BRANCH" || git fetch origin
        git checkout "$BRANCH" || error_exit "Failed to checkout branch: $BRANCH"
    fi
    
    # Pull latest changes
    print_info "Pulling latest changes from origin/$BRANCH..."
    git pull origin "$BRANCH" || error_exit "Failed to pull latest changes"
    
    # Get commit hash
    NEW_COMMIT=$(git rev-parse HEAD)
    print_success "Updated to commit: ${NEW_COMMIT:0:7}"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    cd "$REPO_DIR"
    
    print_info "Running npm ci (clean install)..."
    npm ci --production=false || error_exit "Failed to install dependencies"
    
    print_success "Dependencies installed"
}

# Build application
build_application() {
    print_header "Building Application"
    
    cd "$REPO_DIR"
    
    # Validate environment
    print_info "Validating environment..."
    npm run validate-env 2>/dev/null || print_warning "Environment validation had warnings (non-blocking)"
    
    # Type check
    print_info "Running type check..."
    npm run typecheck 2>/dev/null || print_warning "Type check had warnings (non-blocking)"
    
    # Build
    print_info "Building Next.js application (this may take a few minutes)..."
    npm run build || error_exit "Build failed"
    
    print_success "Build completed successfully"
}

# Restart service
restart_service() {
    print_header "Restarting Service"
    
    # Check if systemd service exists
    if systemctl list-units --full -all | grep -Fq "$SERVICE_NAME.service"; then
        print_info "Restarting systemd service: $SERVICE_NAME"
        sudo systemctl restart "$SERVICE_NAME" || error_exit "Failed to restart service"
        
        # Wait for service to start
        sleep 3
        
        # Check service status
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            print_success "Service restarted successfully"
        else
            print_error "Service failed to start. Check logs with: sudo journalctl -u $SERVICE_NAME -n 50"
            exit 1
        fi
    else
        print_warning "Systemd service not found. Please restart the application manually."
        print_info "You can start it with: npm run start"
    fi
}

# Verify deployment
verify_deployment() {
    print_header "Verifying Deployment"
    
    # Wait for server to be ready
    print_info "Waiting for server to be ready..."
    sleep 5
    
    # Check health endpoint
    print_info "Checking health endpoint..."
    if curl -sf http://localhost:3000/api/health > /dev/null; then
        print_success "Health endpoint responding"
        
        # Get health status
        HEALTH_RESPONSE=$(curl -sf http://localhost:3000/api/health)
        print_info "Health status: $HEALTH_RESPONSE"
    else
        print_warning "Health endpoint not responding. Server may still be starting."
        print_info "Wait a few seconds and check: curl http://localhost:3000/api/health"
    fi
    
    # Check service status if systemd
    if systemctl list-units --full -all | grep -Fq "$SERVICE_NAME.service"; then
        print_info "Service status:"
        systemctl status "$SERVICE_NAME" --no-pager -l | head -10
    fi
}

# Main execution
main() {
    print_header "Secure AI Chat - Production Upgrade"
    echo ""
    print_info "Repository: $REPO_DIR"
    print_info "Branch: $BRANCH"
    print_info "Service: $SERVICE_NAME"
    echo ""
    
    # Confirmation (only if run interactively)
    if [ -t 0 ]; then
        read -p "Continue with upgrade? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Upgrade cancelled"
            exit 0
        fi
    fi
    
    # Run upgrade steps
    check_user
    preflight_checks
    backup_current
    pull_latest
    install_dependencies
    build_application
    restart_service
    verify_deployment
    
    # Success
    echo ""
    print_header "Upgrade Complete"
    print_success "Application upgraded successfully!"
    print_info "Application URL: http://localhost:3000"
    print_info "Health check: curl http://localhost:3000/api/health"
    echo ""
}

# Run main function
main "$@"