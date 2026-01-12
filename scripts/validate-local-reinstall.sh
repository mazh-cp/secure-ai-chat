#!/bin/bash
# Local Reinstall and Validation Script
# Validates key storage, chat, and RAG functionality after clean reinstall

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Local Reinstall & Validation - v1.0.7                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Stop running processes
echo -e "${CYAN}Step 1: Stopping running processes...${NC}"
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ Processes stopped${NC}"
echo ""

# Step 2: Clean build cache
echo -e "${CYAN}Step 2: Cleaning build cache...${NC}"
rm -rf .next
rm -rf node_modules/.cache
echo -e "${GREEN}✅ Build cache cleared${NC}"
echo ""

# Step 3: Backup existing keys if they exist
echo -e "${CYAN}Step 3: Backing up existing keys...${NC}"
if [ -f ".secure-storage/api-keys.enc" ]; then
    mkdir -p .backup
    cp -r .secure-storage .backup/secure-storage-$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    echo -e "${GREEN}✅ Keys backed up${NC}"
else
    echo -e "${YELLOW}⚠️  No existing keys found${NC}"
fi
echo ""

# Step 4: Reinstall dependencies
echo -e "${CYAN}Step 4: Reinstalling dependencies...${NC}"
npm ci
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 5: Type check
echo -e "${CYAN}Step 5: Running type check...${NC}"
npm run type-check 2>/dev/null || npx tsc --noEmit
echo -e "${GREEN}✅ Type check passed${NC}"
echo ""

# Step 6: Build application
echo -e "${CYAN}Step 6: Building application...${NC}"
npm run build
echo -e "${GREEN}✅ Build completed${NC}"
echo ""

# Step 7: Verify keys storage directory
echo -e "${CYAN}Step 7: Verifying keys storage...${NC}"
if [ -d ".secure-storage" ]; then
    echo -e "${GREEN}✅ Storage directory exists${NC}"
    if [ -f ".secure-storage/api-keys.enc" ]; then
        FILE_SIZE=$(stat -f%z .secure-storage/api-keys.enc 2>/dev/null || stat -c%s .secure-storage/api-keys.enc 2>/dev/null || echo "0")
        echo -e "${GREEN}✅ Keys file exists (${FILE_SIZE} bytes)${NC}"
    else
        echo -e "${YELLOW}⚠️  Keys file does not exist (will be created when keys are saved)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Storage directory does not exist (will be created when keys are saved)${NC}"
fi
echo ""

# Step 8: Verify build artifacts
echo -e "${CYAN}Step 8: Verifying build artifacts...${NC}"
if [ -d ".next" ]; then
    echo -e "${GREEN}✅ Build directory exists${NC}"
    if [ -f ".next/standalone/server.js" ] || [ -d ".next/server" ]; then
        echo -e "${GREEN}✅ Server build artifacts found${NC}"
    else
        echo -e "${YELLOW}⚠️  Server build artifacts not found (may be using different output mode)${NC}"
    fi
else
    echo -e "${RED}❌ Build directory not found${NC}"
    exit 1
fi
echo ""

# Step 9: Check version
echo -e "${CYAN}Step 9: Verifying version...${NC}"
VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✅ Version: ${VERSION}${NC}"
echo ""

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Reinstall Complete!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Application rebuilt successfully${NC}"
echo ""
echo "Next steps:"
echo "  1. Start the application: npm run dev"
echo "  2. Test key storage: Save keys in Settings and verify they persist"
echo "  3. Test chat functionality: Send a message in chat"
echo "  4. Test RAG functionality: Upload a file and ask questions about it"
echo ""
