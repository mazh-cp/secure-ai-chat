#!/bin/bash
# Restart Local Installation
# Stops current processes, cleans build, rebuilds, and starts the application

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
echo -e "${BLUE}║        Restart Local Installation                            ║${NC}"
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

# Step 3: Verify keys storage
echo -e "${CYAN}Step 3: Verifying keys storage...${NC}"
if [ -f ".secure-storage/api-keys.enc" ]; then
    FILE_SIZE=$(stat -f%z .secure-storage/api-keys.enc 2>/dev/null || stat -c%s .secure-storage/api-keys.enc 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ Keys file exists (${FILE_SIZE} bytes)${NC}"
else
    echo -e "${YELLOW}⚠️  Keys file does not exist (will be created when keys are saved)${NC}"
fi
echo ""

# Step 4: Type check
echo -e "${CYAN}Step 4: Running type check...${NC}"
npm run type-check 2>/dev/null || npx tsc --noEmit
echo -e "${GREEN}✅ Type check passed${NC}"
echo ""

# Step 5: Build application
echo -e "${CYAN}Step 5: Building application...${NC}"
npm run build
echo -e "${GREEN}✅ Build completed${NC}"
echo ""

# Step 6: Start development server
echo -e "${CYAN}Step 6: Starting development server...${NC}"
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

# Step 7: Verify endpoints
echo -e "${CYAN}Step 7: Verifying endpoints...${NC}"

# Health check
HEALTH=$(curl -s http://localhost:3000/api/health)
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health endpoint: OK${NC}"
else
    echo -e "${RED}❌ Health endpoint: Failed${NC}"
fi

# Version check
VERSION=$(curl -s http://localhost:3000/api/version)
if echo "$VERSION" | grep -q "1.0.7"; then
    echo -e "${GREEN}✅ Version endpoint: 1.0.7${NC}"
else
    echo -e "${YELLOW}⚠️  Version: $(echo $VERSION | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo 'unknown')${NC}"
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
echo -e "${CYAN}Restart Complete!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Application restarted successfully${NC}"
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
