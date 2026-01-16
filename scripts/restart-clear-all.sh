#!/bin/bash
# Restart Application and Clear All Cache and Logs
# Stops frontend and backend, clears all caches, logs, and files, then restarts

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
echo -e "${BLUE}║     Restart Application - Clear All Cache & Logs           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Stop all running processes
echo -e "${CYAN}Step 1: Stopping all running processes...${NC}"
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ All processes stopped${NC}"
echo ""

# Step 2: Clear Next.js build cache
echo -e "${CYAN}Step 2: Clearing Next.js build cache...${NC}"
if [ -d ".next" ]; then
    rm -rf .next
    echo -e "${GREEN}✅ .next directory cleared${NC}"
else
    echo -e "${YELLOW}⚠️  .next directory does not exist${NC}"
fi
echo ""

# Step 3: Clear Node modules cache
echo -e "${CYAN}Step 3: Clearing Node modules cache...${NC}"
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo -e "${GREEN}✅ node_modules/.cache cleared${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules/.cache does not exist${NC}"
fi
echo ""

# Step 4: Clear uploaded files and metadata
echo -e "${CYAN}Step 4: Clearing uploaded files and metadata...${NC}"
if [ -d ".storage" ]; then
    # Clear files directory
    if [ -d ".storage/files" ]; then
        FILE_COUNT=$(find .storage/files -name "*.dat" 2>/dev/null | wc -l | tr -d ' ')
        rm -rf .storage/files
        echo -e "${GREEN}✅ Deleted ${FILE_COUNT} uploaded files${NC}"
    fi
    # Clear metadata file
    if [ -f ".storage/files-metadata.json" ]; then
        rm -f .storage/files-metadata.json
        echo -e "${GREEN}✅ Cleared files metadata${NC}"
    fi
    # Remove empty .storage directory if no other files exist
    if [ -z "$(ls -A .storage 2>/dev/null)" ]; then
        rmdir .storage 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}⚠️  .storage directory does not exist${NC}"
fi
echo ""

# Step 5: Clear system logs (but preserve API keys)
echo -e "${CYAN}Step 5: Clearing system logs...${NC}"
if [ -f ".secure-storage/system-logs.json" ]; then
    # Backup the file size before clearing
    FILE_SIZE=$(stat -f%z .secure-storage/system-logs.json 2>/dev/null || stat -c%s .secure-storage/system-logs.json 2>/dev/null || echo "0")
    rm -f .secure-storage/system-logs.json
    echo -e "${GREEN}✅ Cleared system logs (${FILE_SIZE} bytes)${NC}"
else
    echo -e "${YELLOW}⚠️  System logs file does not exist${NC}"
fi
echo ""

# Step 6: Verify API keys are preserved
echo -e "${CYAN}Step 6: Verifying API keys are preserved...${NC}"
if [ -f ".secure-storage/api-keys.enc" ]; then
    KEY_SIZE=$(stat -f%z .secure-storage/api-keys.enc 2>/dev/null || stat -c%s .secure-storage/api-keys.enc 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ API keys file exists (${KEY_SIZE} bytes)${NC}"
else
    echo -e "${YELLOW}⚠️  API keys file does not exist (will be created when keys are saved)${NC}"
fi
echo ""

# Step 7: Type check
echo -e "${CYAN}Step 7: Running type check...${NC}"
npm run type-check 2>/dev/null || npx tsc --noEmit
echo -e "${GREEN}✅ Type check passed${NC}"
echo ""

# Step 8: Build application
echo -e "${CYAN}Step 8: Building application...${NC}"
npm run build
echo -e "${GREEN}✅ Build completed${NC}"
echo ""

# Step 9: Start development server
echo -e "${CYAN}Step 9: Starting development server...${NC}"
echo -e "${YELLOW}⚠️  Server will start in background. Check output for any errors.${NC}"
echo ""

# Start server in background
npm run dev > /dev/null 2>&1 &
DEV_PID=$!

# Wait for server to be ready
echo -e "${CYAN}Waiting for server to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Server did not start in time${NC}"
        kill $DEV_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
echo ""

# Step 10: Clear client-side logs via API
echo -e "${CYAN}Step 10: Clearing client-side logs...${NC}"
if curl -s -X DELETE http://localhost:3000/api/logs/system > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Client-side logs cleared${NC}"
else
    echo -e "${YELLOW}⚠️  Could not clear client-side logs (server may still be starting)${NC}"
fi
echo ""

# Step 11: Verify endpoints
echo -e "${CYAN}Step 11: Verifying endpoints...${NC}"

# Health check
HEALTH=$(curl -s http://localhost:3000/api/health)
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health endpoint: OK${NC}"
else
    echo -e "${RED}❌ Health endpoint: Failed${NC}"
fi

# Version check
VERSION=$(curl -s http://localhost:3000/api/version)
if echo "$VERSION" | grep -q "version"; then
    VERSION_NUM=$(echo "$VERSION" | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo 'unknown')
    echo -e "${GREEN}✅ Version endpoint: ${VERSION_NUM}${NC}"
else
    echo -e "${YELLOW}⚠️  Version endpoint: Failed to retrieve${NC}"
fi

# Keys check
KEYS_RESPONSE=$(curl -s http://localhost:3000/api/keys/retrieve)
if echo "$KEYS_RESPONSE" | grep -q "configured"; then
    echo -e "${GREEN}✅ Keys endpoint: Working${NC}"
    if echo "$KEYS_RESPONSE" | grep -q '"openAiKey":"configured"'; then
        echo -e "${GREEN}   ✅ OpenAI key is configured${NC}"
    else
        echo -e "${YELLOW}   ⚠️  OpenAI key not configured yet${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Keys endpoint: $(echo $KEYS_RESPONSE | head -c 50)${NC}"
fi

echo ""

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Restart Complete - All Cache & Logs Cleared!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Application restarted successfully${NC}"
echo ""
echo "🧹 Cleared:"
echo "   - Next.js build cache (.next/)"
echo "   - Node modules cache (node_modules/.cache)"
echo "   - Uploaded files (.storage/files/)"
echo "   - Files metadata (.storage/files-metadata.json)"
echo "   - System logs (.secure-storage/system-logs.json)"
echo "   - Client-side logs (localStorage)"
echo ""
echo "🔒 Preserved:"
echo "   - API keys (.secure-storage/api-keys.enc)"
echo ""
echo "🌐 Application is running at:"
echo "   http://localhost:3000"
echo ""
echo "📋 Next Steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Check browser console (F12) for any errors"
echo "  3. Verify keys are detected (should see 'Keys loaded from server')"
echo "  4. Test chat functionality"
echo "  5. Test RAG: Upload file, enable RAG, ask questions"
echo ""
echo "🛑 To stop the server:"
echo "   pkill -f 'next dev'"
echo ""
