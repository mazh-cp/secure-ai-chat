#!/bin/bash

# Clean Reinstall Script for Secure AI Chat v1.0.11
# This script performs a complete clean reinstallation with all latest changes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
INSTALL_DIR="${INSTALL_DIR:-$HOME}"
REPO_DIR="secure-ai-chat"
FULL_PATH="${INSTALL_DIR}/${REPO_DIR}"
TAG="${TAG:-v1.0.11}"

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   print_error "Please do not run this script as root. It will use sudo when needed."
   exit 1
fi

print_header "Secure AI Chat v1.0.11 - Clean Reinstallation"

echo "This will:"
echo "  1. Stop and disable the secure-ai-chat service"
echo "  2. Remove the existing installation directory"
echo "  3. Perform a fresh installation with all latest changes"
echo "  4. Validate the installation"
echo ""
echo "Installation directory: $FULL_PATH"
echo "Version: $TAG"
echo ""

# Confirmation
if [ -t 0 ]; then
    read -p "Continue with clean reinstall? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Reinstallation cancelled."
        exit 0
    fi
fi

# Step 1: Stop and disable service
print_header "Step 1: Stopping and Removing Service"

if command -v systemctl &> /dev/null; then
    if sudo systemctl is-active secure-ai-chat &> /dev/null; then
        print_info "Stopping secure-ai-chat service..."
        sudo systemctl stop secure-ai-chat
        print_success "Service stopped"
    else
        print_info "Service is not running"
    fi
    
    if sudo systemctl is-enabled secure-ai-chat &> /dev/null; then
        print_info "Disabling secure-ai-chat service..."
        sudo systemctl disable secure-ai-chat
        print_success "Service disabled"
    fi
    
    # Remove service file
    if [ -f "/etc/systemd/system/secure-ai-chat.service" ]; then
        print_info "Removing systemd service file..."
        sudo rm -f /etc/systemd/system/secure-ai-chat.service
        sudo systemctl daemon-reload
        print_success "Service file removed"
    fi
else
    print_warning "systemctl not available (skipping service removal)"
fi

# Step 2: Backup important data (optional)
print_header "Step 2: Backup (Optional)"

BACKUP_DIR="${INSTALL_DIR}/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"

if [ -d "$FULL_PATH" ]; then
    print_info "Creating backup of important data..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup secure storage (API keys)
    if [ -d "$FULL_PATH/.secure-storage" ]; then
        print_info "Backing up API keys..."
        sudo cp -r "$FULL_PATH/.secure-storage" "$BACKUP_DIR/.secure-storage" 2>/dev/null || true
        print_success "API keys backed up"
    fi
    
    # Backup .env.local
    if [ -f "$FULL_PATH/.env.local" ]; then
        print_info "Backing up .env.local..."
        cp "$FULL_PATH/.env.local" "$BACKUP_DIR/.env.local" 2>/dev/null || true
        print_success ".env.local backed up"
    fi
    
    # Backup uploaded files
    if [ -d "$FULL_PATH/.storage" ]; then
        print_info "Backing up uploaded files..."
        cp -r "$FULL_PATH/.storage" "$BACKUP_DIR/.storage" 2>/dev/null || true
        print_success "Uploaded files backed up"
    fi
    
    print_success "Backup created at: $BACKUP_DIR"
    print_info "You can restore from backup after installation if needed"
fi

# Step 3: Remove existing installation
print_header "Step 3: Removing Existing Installation"

if [ -d "$FULL_PATH" ]; then
    print_info "Removing existing installation directory..."
    
    # Kill any running processes
    if pgrep -f "secure-ai-chat" > /dev/null; then
        print_info "Stopping any running processes..."
        sudo pkill -f "secure-ai-chat" || true
        sleep 2
    fi
    
    # Remove directory
    if [ "$INSTALL_DIR" = "/opt" ]; then
        sudo rm -rf "$FULL_PATH"
    else
        rm -rf "$FULL_PATH"
    fi
    
    print_success "Existing installation removed"
else
    print_info "No existing installation found"
fi

# Step 4: Run fresh installation
print_header "Step 4: Performing Fresh Installation"

print_info "Running installation script with CLEAN_INSTALL=true..."

# Get the installation script
INSTALL_SCRIPT_URL="https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh"

# Download and run installation script
cd "$INSTALL_DIR"

if command -v curl &> /dev/null; then
    print_info "Downloading installation script..."
    CLEAN_INSTALL=true TAG="$TAG" INSTALL_DIR="$INSTALL_DIR" bash <(curl -fsSL "$INSTALL_SCRIPT_URL")
else
    print_error "curl is required but not installed"
    print_info "Please install curl: sudo apt-get install curl"
    exit 1
fi

# Step 5: Restore backup (if exists)
print_header "Step 5: Restoring Backup Data"

if [ -d "$BACKUP_DIR" ]; then
    print_info "Restoring backed up data..."
    
    cd "$FULL_PATH" || exit 1
    
    # Restore secure storage
    if [ -d "$BACKUP_DIR/.secure-storage" ]; then
        print_info "Restoring API keys..."
        sudo cp -r "$BACKUP_DIR/.secure-storage" "$FULL_PATH/.secure-storage"
        sudo chmod 700 "$FULL_PATH/.secure-storage"
        sudo chmod 600 "$FULL_PATH/.secure-storage"/*.enc 2>/dev/null || true
        print_success "API keys restored"
    fi
    
    # Restore .env.local
    if [ -f "$BACKUP_DIR/.env.local" ]; then
        print_info "Restoring .env.local..."
        cp "$BACKUP_DIR/.env.local" "$FULL_PATH/.env.local"
        print_success ".env.local restored"
    fi
    
    # Restore uploaded files
    if [ -d "$BACKUP_DIR/.storage" ]; then
        print_info "Restoring uploaded files..."
        cp -r "$BACKUP_DIR/.storage" "$FULL_PATH/.storage" 2>/dev/null || true
        print_success "Uploaded files restored"
    fi
    
    print_success "Backup data restored"
    print_info "Backup directory kept at: $BACKUP_DIR"
else
    print_info "No backup to restore"
fi

# Step 6: Validation
print_header "Step 6: Validating Installation"

cd "$FULL_PATH" || exit 1

if [ -f "scripts/validate-fresh-install.sh" ]; then
    print_info "Running validation script..."
    bash scripts/validate-fresh-install.sh
    VALIDATION_EXIT=$?
    
    if [ $VALIDATION_EXIT -eq 0 ]; then
        print_success "Validation passed"
    else
        print_warning "Validation had warnings (see output above)"
    fi
else
    print_warning "Validation script not found (skipping)"
fi

# Step 7: Final verification
print_header "Step 7: Final Verification"

# Check service status
if command -v systemctl &> /dev/null; then
    sleep 5  # Wait for service to start
    
    if sudo systemctl is-active --quiet secure-ai-chat; then
        print_success "Service is running"
    else
        print_warning "Service may not be running. Check: sudo systemctl status secure-ai-chat"
    fi
fi

# Check health endpoint
if command -v curl &> /dev/null; then
    sleep 3  # Wait a bit more
    
    if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "Health endpoint is responding"
        
        VERSION=$(curl -s http://localhost:3000/api/version 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        print_info "Installed version: $VERSION"
    else
        print_warning "Health endpoint not responding yet (may need a few more seconds)"
    fi
fi

# Summary
print_header "Clean Reinstallation Complete!"

print_success "Secure AI Chat v1.0.11 has been cleanly reinstalled"
echo ""
echo "Installation directory: $FULL_PATH"
echo "Version: $TAG"
echo ""

if [ -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Backup location: $BACKUP_DIR${NC}"
    echo "You can remove the backup after verifying everything works:"
    echo "  rm -rf $BACKUP_DIR"
    echo ""
fi

echo -e "${BLUE}Next steps:${NC}"
echo "  1. Verify service: sudo systemctl status secure-ai-chat"
echo "  2. Check logs: sudo journalctl -u secure-ai-chat -f"
echo "  3. Test health: curl http://localhost:3000/api/health"
echo "  4. Access web UI: http://localhost:3000"
echo "  5. Configure API keys: http://localhost:3000/settings"
echo ""
echo -e "${GREEN}Clean reinstallation completed successfully!${NC}"
