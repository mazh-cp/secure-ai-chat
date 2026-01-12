#!/bin/bash
# Production Rollback Script
# Reverts production system to a previous known good version
#
# Usage:
#   sudo bash scripts/rollback-production.sh [version]
#   Example: sudo bash scripts/rollback-production.sh v1.0.6
#
# If no version specified, will show available versions and prompt

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_DIR="${REPO_DIR:-/home/adminuser/secure-ai-chat}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"
SERVICE_USER="${SERVICE_USER:-adminuser}"
SERVICE_GROUP="${SERVICE_GROUP:-adminuser}"
BACKUP_DIR="${BACKUP_DIR:-/home/adminuser/secure-ai-chat-backups}"

# Known good versions (add more as needed)
KNOWN_VERSIONS=(
    "v1.0.6"
    "v1.0.5"
    "v1.0.4"
    "v1.0.3"
    "v1.0.2"
    "v1.0.1"
    "main"  # Current main branch
)

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Production Rollback Script                            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run with sudo${NC}"
    echo "   Usage: sudo bash scripts/rollback-production.sh [version]"
    exit 1
fi

# Check if repository exists
if [ ! -d "$REPO_DIR" ]; then
    echo -e "${RED}❌ Repository directory not found: $REPO_DIR${NC}"
    exit 1
fi

cd "$REPO_DIR"

# Get current version/commit
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
CURRENT_VERSION=$(grep -E '"version"' package.json 2>/dev/null | head -1 | sed -E 's/.*"version":\s*"([^"]+)".*/\1/' || echo "unknown")

echo -e "${BLUE}Current State:${NC}"
echo "   Branch: $CURRENT_BRANCH"
echo "   Version: $CURRENT_VERSION"
echo "   Commit: ${CURRENT_COMMIT:0:8}"
echo ""

# Determine target version
TARGET_VERSION="${1:-}"

if [ -z "$TARGET_VERSION" ]; then
    echo -e "${CYAN}Available Versions:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    for i in "${!KNOWN_VERSIONS[@]}"; do
        VERSION="${KNOWN_VERSIONS[$i]}"
        if [ "$VERSION" = "main" ]; then
            echo "  $((i+1)). $VERSION (current main branch)"
        else
            echo "  $((i+1)). $VERSION"
        fi
    done
    echo ""
    read -p "Enter version number or version tag (e.g., v1.0.6): " TARGET_VERSION
    echo ""
fi

# Validate target version
if [ -z "$TARGET_VERSION" ]; then
    echo -e "${RED}❌ No version specified${NC}"
    exit 1
fi

# Check if it's a number (select from list)
if [[ "$TARGET_VERSION" =~ ^[0-9]+$ ]]; then
    INDEX=$((TARGET_VERSION - 1))
    if [ $INDEX -ge 0 ] && [ $INDEX -lt ${#KNOWN_VERSIONS[@]} ]; then
        TARGET_VERSION="${KNOWN_VERSIONS[$INDEX]}"
    else
        echo -e "${RED}❌ Invalid selection${NC}"
        exit 1
    fi
fi

echo -e "${CYAN}Target Version:${NC} $TARGET_VERSION"
echo ""

# Confirm rollback
echo -e "${YELLOW}⚠️  WARNING: This will rollback the production system${NC}"
echo "   Current: $CURRENT_VERSION (${CURRENT_COMMIT:0:8})"
echo "   Target:  $TARGET_VERSION"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    exit 0
fi

echo ""

# Step 1: Stop service
echo -e "${CYAN}Step 1: Stopping Service${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if sudo systemctl is-active --quiet ${SERVICE_NAME} 2>/dev/null; then
    sudo systemctl stop ${SERVICE_NAME}
    echo -e "${GREEN}✅ Service stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Service was not running${NC}"
fi
echo ""

# Step 2: Create backup
echo -e "${CYAN}Step 2: Creating Backup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/rollback_backup_${BACKUP_TIMESTAMP}"

mkdir -p "$BACKUP_DIR"
echo "Creating backup at: $BACKUP_PATH"

# Backup critical data
mkdir -p "$BACKUP_PATH"

# Backup .secure-storage (API keys)
if [ -d "$REPO_DIR/.secure-storage" ]; then
    sudo cp -r "$REPO_DIR/.secure-storage" "$BACKUP_PATH/" 2>/dev/null || true
    echo -e "${GREEN}✅ Backed up .secure-storage${NC}"
fi

# Backup .storage (uploaded files)
if [ -d "$REPO_DIR/.storage" ]; then
    sudo cp -r "$REPO_DIR/.storage" "$BACKUP_PATH/" 2>/dev/null || true
    echo -e "${GREEN}✅ Backed up .storage${NC}"
fi

# Backup .env
if [ -f "$REPO_DIR/.env" ]; then
    sudo cp "$REPO_DIR/.env" "$BACKUP_PATH/" 2>/dev/null || true
    echo -e "${GREEN}✅ Backed up .env${NC}"
fi

# Backup current commit hash
echo "$CURRENT_COMMIT" > "$BACKUP_PATH/previous_commit.txt"
echo "$CURRENT_VERSION" > "$BACKUP_PATH/previous_version.txt"
echo "$CURRENT_BRANCH" > "$BACKUP_PATH/previous_branch.txt"

echo -e "${GREEN}✅ Backup created: $BACKUP_PATH${NC}"
echo ""

# Step 3: Fetch latest from remote
echo -e "${CYAN}Step 3: Fetching from Remote${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$REPO_DIR"
git fetch origin --tags --force
echo -e "${GREEN}✅ Fetched latest from remote${NC}"
echo ""

# Step 4: Checkout target version
echo -e "${CYAN}Step 4: Checking Out Target Version${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Try to checkout as tag first, then branch, then commit
if git rev-parse "$TARGET_VERSION" >/dev/null 2>&1; then
    echo "Checking out tag/branch: $TARGET_VERSION"
    git checkout "$TARGET_VERSION" 2>/dev/null || {
        # If checkout fails, try to reset
        git fetch origin "$TARGET_VERSION" 2>/dev/null || true
        git reset --hard "origin/$TARGET_VERSION" 2>/dev/null || git reset --hard "$TARGET_VERSION" 2>/dev/null || {
            echo -e "${RED}❌ Failed to checkout $TARGET_VERSION${NC}"
            exit 1
        }
    }
elif git ls-remote --heads origin "$TARGET_VERSION" >/dev/null 2>&1; then
    echo "Checking out remote branch: $TARGET_VERSION"
    git fetch origin "$TARGET_VERSION" 2>/dev/null || true
    git checkout -b "$TARGET_VERSION" "origin/$TARGET_VERSION" 2>/dev/null || git checkout "$TARGET_VERSION" 2>/dev/null || {
        echo -e "${RED}❌ Failed to checkout branch $TARGET_VERSION${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}⚠️  Version $TARGET_VERSION not found as tag or branch${NC}"
    echo "   Trying to find commit with version in package.json..."
    
    # Search for commits with this version
    FOUND_COMMIT=$(git log --all --grep="$TARGET_VERSION" --oneline | head -1 | awk '{print $1}' || echo "")
    
    if [ -z "$FOUND_COMMIT" ]; then
        # Try to find by package.json version
        FOUND_COMMIT=$(git log --all -S "\"version\": \"$TARGET_VERSION\"" --oneline -- package.json | head -1 | awk '{print $1}' || echo "")
    fi
    
    if [ -n "$FOUND_COMMIT" ]; then
        echo "Found commit: $FOUND_COMMIT"
        git checkout "$FOUND_COMMIT"
    else
        echo -e "${RED}❌ Could not find version $TARGET_VERSION${NC}"
        echo "   Available tags:"
        git tag | head -10
        exit 1
    fi
fi

NEW_COMMIT=$(git rev-parse HEAD)
NEW_VERSION=$(grep -E '"version"' package.json 2>/dev/null | head -1 | sed -E 's/.*"version":\s*"([^"]+)".*/\1/' || echo "unknown")

echo -e "${GREEN}✅ Checked out version: $NEW_VERSION${NC}"
echo "   Commit: ${NEW_COMMIT:0:8}"
echo ""

# Step 5: Restore backups
echo -e "${CYAN}Step 5: Restoring Backups${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Restore .secure-storage
if [ -d "$BACKUP_PATH/.secure-storage" ]; then
    sudo rm -rf "$REPO_DIR/.secure-storage" 2>/dev/null || true
    sudo cp -r "$BACKUP_PATH/.secure-storage" "$REPO_DIR/" 2>/dev/null || true
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR/.secure-storage" 2>/dev/null || true
    sudo chmod -R 700 "$REPO_DIR/.secure-storage" 2>/dev/null || true
    echo -e "${GREEN}✅ Restored .secure-storage${NC}"
fi

# Restore .storage
if [ -d "$BACKUP_PATH/.storage" ]; then
    sudo rm -rf "$REPO_DIR/.storage" 2>/dev/null || true
    sudo cp -r "$BACKUP_PATH/.storage" "$REPO_DIR/" 2>/dev/null || true
    sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR/.storage" 2>/dev/null || true
    sudo chmod -R 755 "$REPO_DIR/.storage" 2>/dev/null || true
    echo -e "${GREEN}✅ Restored .storage${NC}"
fi

# Restore .env (but keep HOSTNAME=0.0.0.0 if it exists)
if [ -f "$BACKUP_PATH/.env" ]; then
    # Preserve HOSTNAME setting for public access
    if grep -q "^HOSTNAME=" "$REPO_DIR/.env" 2>/dev/null; then
        CURRENT_HOSTNAME=$(grep "^HOSTNAME=" "$REPO_DIR/.env" | head -1)
        sudo cp "$BACKUP_PATH/.env" "$REPO_DIR/.env"
        # Restore HOSTNAME if it was 0.0.0.0
        if [ "$CURRENT_HOSTNAME" = "HOSTNAME=0.0.0.0" ]; then
            if ! grep -q "^HOSTNAME=0.0.0.0" "$REPO_DIR/.env"; then
                echo "HOSTNAME=0.0.0.0" | sudo tee -a "$REPO_DIR/.env" > /dev/null
            fi
        fi
    else
        sudo cp "$BACKUP_PATH/.env" "$REPO_DIR/.env"
    fi
    sudo chown ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR/.env" 2>/dev/null || true
    sudo chmod 600 "$REPO_DIR/.env" 2>/dev/null || true
    echo -e "${GREEN}✅ Restored .env${NC}"
fi

echo ""

# Step 6: Install dependencies
echo -e "${CYAN}Step 6: Installing Dependencies${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Fix permissions
sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"
sudo chmod -R u+w "$REPO_DIR"

# Source nvm if available
if [ -f "/home/${SERVICE_USER}/.nvm/nvm.sh" ]; then
    source "/home/${SERVICE_USER}/.nvm/nvm.sh" 2>/dev/null || true
fi

cd "$REPO_DIR"
echo "Installing dependencies..."
sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm ci --production=false || {
    echo -e "${YELLOW}⚠️  npm ci failed, trying npm install...${NC}"
    sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm install --production=false || {
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    }
}

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 7: Rebuild application
echo -e "${CYAN}Step 7: Rebuilding Application${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clear build cache
rm -rf .next 2>/dev/null || true

echo "Building application..."
sudo -u ${SERVICE_USER} env HOME="/home/${SERVICE_USER}" npm run build || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Application built${NC}"
echo ""

# Step 8: Fix permissions
echo -e "${CYAN}Step 8: Fixing Permissions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sudo chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$REPO_DIR"
sudo chmod -R 755 "$REPO_DIR"
sudo chmod 600 "$REPO_DIR/.env" 2>/dev/null || true
sudo chmod -R 700 "$REPO_DIR/.secure-storage" 2>/dev/null || true
sudo chmod -R 755 "$REPO_DIR/.storage" 2>/dev/null || true

echo -e "${GREEN}✅ Permissions fixed${NC}"
echo ""

# Step 9: Update systemd service if needed
echo -e "${CYAN}Step 9: Checking Systemd Service${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo "Service file not found, creating..."
    if [ -f "$REPO_DIR/scripts/create-systemd-service.sh" ]; then
        sudo bash "$REPO_DIR/scripts/create-systemd-service.sh"
    else
        echo -e "${YELLOW}⚠️  Service creation script not found${NC}"
        echo "   Service may need to be created manually"
    fi
else
    # Ensure HOSTNAME is set in service
    if ! sudo grep -q "HOSTNAME=0.0.0.0" "/etc/systemd/system/${SERVICE_NAME}.service"; then
        echo "Updating service file to include HOSTNAME=0.0.0.0..."
        sudo sed -i '/^\[Service\]/a Environment=HOSTNAME=0.0.0.0' "/etc/systemd/system/${SERVICE_NAME}.service"
        sudo systemctl daemon-reload
        echo -e "${GREEN}✅ Service file updated${NC}"
    else
        echo -e "${GREEN}✅ Service file is correct${NC}"
    fi
fi

echo ""

# Step 10: Start service
echo -e "${CYAN}Step 10: Starting Service${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sudo systemctl daemon-reload
sudo systemctl start ${SERVICE_NAME}

sleep 5

if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service started successfully${NC}"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    echo ""
    echo "Service status:"
    sudo systemctl status ${SERVICE_NAME} --no-pager -l | head -20
    echo ""
    echo "Recent logs:"
    sudo journalctl -u ${SERVICE_NAME} -n 30 --no-pager
    exit 1
fi

echo ""

# Step 11: Verification
echo -e "${CYAN}Step 11: Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sleep 3

# Check service status
if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ Service is running${NC}"
else
    echo -e "${RED}❌ Service is not running${NC}"
fi

# Check network binding
if command -v ss &> /dev/null; then
    LISTEN_CHECK=$(sudo ss -tlnp 2>/dev/null | grep ":3000" || echo "")
    if echo "$LISTEN_CHECK" | grep -q "0.0.0.0:3000"; then
        echo -e "${GREEN}✅ Application is listening on 0.0.0.0:3000${NC}"
    else
        echo -e "${YELLOW}⚠️  Application binding check:${NC}"
        echo "   $LISTEN_CHECK"
    fi
fi

# Test health endpoint
if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health endpoint responding${NC}"
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding yet${NC}"
fi

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Rollback Complete${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Successfully rolled back to: $NEW_VERSION${NC}"
echo ""
echo "Previous version: $CURRENT_VERSION (${CURRENT_COMMIT:0:8})"
echo "Current version:  $NEW_VERSION (${NEW_COMMIT:0:8})"
echo ""
echo "Backup location: $BACKUP_PATH"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME}"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo "  curl http://localhost:3000/api/health"
echo ""
