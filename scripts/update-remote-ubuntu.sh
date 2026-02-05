#!/usr/bin/env bash
#
# Update Secure AI Chat on a remote Ubuntu VM from GitHub.
# Run on the VM (e.g. via SSH) as the app user (e.g. adminuser).
# Restart step uses sudo; ensure passwordless sudo for systemctl or run with sudo.
#
# Usage:
#   ./scripts/update-remote-ubuntu.sh
#   APP_DIR=/opt/secure-ai-chat BRANCH=main ./scripts/update-remote-ubuntu.sh
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="${APP_DIR:-/home/adminuser/secure-ai-chat}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-secure-ai-chat}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Secure AI Chat – Remote Ubuntu update (fetch & install)       ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "APP_DIR=$APP_DIR"
echo "BRANCH=$BRANCH"
echo ""

if [ ! -d "$APP_DIR" ]; then
  echo -e "${RED}❌ App directory not found: $APP_DIR${NC}"
  exit 1
fi

cd "$APP_DIR"

# Ensure data/uploads exists for file storage (fixes "files not saved" when systemd ReadWritePaths is updated)
DATA_DIR="${APP_DIR}/data"
UPLOADS_DIR="${DATA_DIR}/uploads"
if [ ! -d "$UPLOADS_DIR" ]; then
  echo -e "${YELLOW}Creating data/uploads for file storage...${NC}"
  mkdir -p "$UPLOADS_DIR"
  chown "$(whoami):$(id -gn)" "$DATA_DIR" "$UPLOADS_DIR" 2>/dev/null || true
  echo -e "${GREEN}✅ $UPLOADS_DIR created${NC}"
fi

if [ ! -d ".git" ]; then
  echo -e "${RED}❌ Not a git repository. Clone the repo first or use rsync to deploy.${NC}"
  exit 1
fi

echo -e "${BLUE}Step 1: Fetch and pull from origin ($BRANCH)${NC}"
git fetch origin
git stash 2>/dev/null || true
git checkout "$BRANCH" 2>/dev/null || true
if ! git pull origin "$BRANCH"; then
  echo -e "${YELLOW}⚠️  Pull had conflicts, attempting reset to origin/$BRANCH...${NC}"
  git fetch origin
  git reset --hard "origin/$BRANCH"
fi
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

echo -e "${BLUE}Step 2: Install dependencies (npm ci)${NC}"
if [ -f "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
  nvm use 2>/dev/null || nvm use default || true
fi
npm ci --production=false
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

echo -e "${BLUE}Step 3: Build application${NC}"
npm run build
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

echo -e "${BLUE}Step 4: Restart service ($SERVICE_NAME)${NC}"
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  sudo systemctl restart "$SERVICE_NAME"
  echo -e "${GREEN}✅ Service restarted${NC}"
else
  echo -e "${YELLOW}⚠️  Service $SERVICE_NAME not active; start it with: sudo systemctl start $SERVICE_NAME${NC}"
fi
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Update complete. If file uploads still fail, ensure systemd     ${NC}"
echo -e "${GREEN}  ReadWritePaths includes: $APP_DIR/data${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
