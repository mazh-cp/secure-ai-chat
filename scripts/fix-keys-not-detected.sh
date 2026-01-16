#!/bin/bash

# Secure AI Chat - Fix Keys Not Detected in Chat Section
# This script fixes the issue where keys are saved but chat section doesn't detect them
# 
# Usage:
#   ./scripts/fix-keys-not-detected.sh

set -eo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
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
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

# Find the application directory
if [ -f "package.json" ]; then
    APP_DIR="$(pwd)"
elif [ -f "../package.json" ]; then
    APP_DIR="$(cd .. && pwd)"
elif [ -d "/opt/secure-ai-chat" ] && [ -f "/opt/secure-ai-chat/package.json" ]; then
    APP_DIR="/opt/secure-ai-chat"
elif [ -d "$HOME/secure-ai-chat" ] && [ -f "$HOME/secure-ai-chat/package.json" ]; then
    APP_DIR="$HOME/secure-ai-chat"
else
    print_error "Could not find application directory. Please run this script from the application root."
    exit 1
fi

cd "$APP_DIR"

print_header "Secure AI Chat - Fix Keys Not Detected Issue"

# Step 1: Verify keys are saved
print_info "Step 1: Checking if keys are saved..."

if [ -f ".secure-storage/api-keys.enc" ]; then
    print_success "API keys file exists: .secure-storage/api-keys.enc"
    KEYS_FILE_SIZE=$(stat -c%s ".secure-storage/api-keys.enc" 2>/dev/null || stat -f%z ".secure-storage/api-keys.enc" 2>/dev/null || echo "0")
    if [ "$KEYS_FILE_SIZE" -gt 0 ]; then
        print_success "API keys file is not empty ($KEYS_FILE_SIZE bytes)"
    else
        print_warning "API keys file is empty"
    fi
else
    print_warning "API keys file not found: .secure-storage/api-keys.enc"
fi

if [ -f ".secure-storage/checkpoint-te-key.enc" ]; then
    print_success "Check Point key file exists: .secure-storage/checkpoint-te-key.enc"
else
    print_info "Check Point key file not found (optional)"
fi

# Step 2: Check file permissions
print_info "Step 2: Verifying file permissions..."

if [ -d ".secure-storage" ]; then
    PERMS=$(stat -c%a ".secure-storage" 2>/dev/null || stat -f%OLp ".secure-storage" 2>/dev/null || echo "unknown")
    print_info "Storage directory permissions: $PERMS"
    
    if [ "$PERMS" != "700" ] && [ "$PERMS" != "755" ]; then
        print_warning "Fixing storage directory permissions..."
        chmod 700 .secure-storage 2>/dev/null || sudo chmod 700 .secure-storage
        print_success "Permissions fixed"
    fi
fi

if [ -f ".secure-storage/api-keys.enc" ]; then
    PERMS=$(stat -c%a ".secure-storage/api-keys.enc" 2>/dev/null || stat -f%OLp ".secure-storage/api-keys.enc" 2>/dev/null || echo "unknown")
    print_info "Keys file permissions: $PERMS"
    
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "644" ]; then
        print_warning "Fixing keys file permissions..."
        chmod 600 .secure-storage/api-keys.enc 2>/dev/null || sudo chmod 600 .secure-storage/api-keys.enc
        print_success "Permissions fixed"
    fi
fi

# Step 3: Clear Next.js cache
print_info "Step 3: Clearing Next.js cache..."

if [ -d ".next" ]; then
    print_info "Clearing .next cache..."
    rm -rf .next/cache 2>/dev/null || true
    print_success "Next.js cache cleared"
else
    print_warning ".next directory not found (app may not be built)"
fi

# Step 4: Restart service
print_info "Step 4: Restarting service to reload keys..."

if command -v systemctl &> /dev/null && systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    print_info "Restarting secure-ai-chat service..."
    sudo systemctl restart secure-ai-chat
    sleep 3
    
    if systemctl is-active --quiet secure-ai-chat; then
        print_success "Service restarted successfully"
    else
        print_warning "Service restart may have failed. Check status: sudo systemctl status secure-ai-chat"
    fi
elif command -v systemctl &> /dev/null && systemctl is-enabled secure-ai-chat 2>/dev/null; then
    print_warning "Service is enabled but not running. Starting service..."
    sudo systemctl start secure-ai-chat
    sleep 3
    
    if systemctl is-active --quiet secure-ai-chat; then
        print_success "Service started successfully"
    else
        print_warning "Service start failed. Check logs: sudo journalctl -u secure-ai-chat -n 50"
    fi
else
    print_warning "Service not found. If running manually, restart the application."
fi

# Step 5: Verify keys endpoint
print_info "Step 5: Verifying keys endpoint..."

sleep 2  # Wait for service to fully start

if curl -s http://localhost:3000/api/keys/retrieve > /tmp/keys-status.json 2>/dev/null; then
    print_success "Keys endpoint is accessible"
    
    # Parse response to check configured keys
    if command -v jq &> /dev/null; then
        OPENAI_CONFIGURED=$(jq -r '.configured.openAiKey // false' /tmp/keys-status.json 2>/dev/null || echo "false")
        LAKERA_CONFIGURED=$(jq -r '.configured.lakeraAiKey // false' /tmp/keys-status.json 2>/dev/null || echo "false")
        
        echo ""
        print_info "Key Status from API:"
        echo "  OpenAI Key: $([ "$OPENAI_CONFIGURED" = "true" ] && echo "✅ Configured" || echo "❌ Not configured")"
        echo "  Lakera AI Key: $([ "$LAKERA_CONFIGURED" = "true" ] && echo "✅ Configured" || echo "❌ Not configured")"
    else
        print_info "Response received. Install 'jq' for better parsing."
        cat /tmp/keys-status.json | head -20
    fi
    
    rm -f /tmp/keys-status.json
else
    print_warning "Keys endpoint not accessible. Service may still be starting."
    print_info "Wait a few seconds and try: curl http://localhost:3000/api/keys/retrieve"
fi

# Step 6: Clear browser cache (instructions)
print_info "Step 6: Browser cache instructions..."

echo ""
print_warning "IMPORTANT: Clear your browser cache or do a hard refresh:"
echo "  • Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)"
echo "  • Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)"
echo "  • Safari: Cmd+Option+E (clear cache), then Cmd+R"
echo ""
print_info "Or open the application in an incognito/private window to test"

# Summary
print_header "Summary"

print_success "Fix steps completed!"
echo ""
print_info "Next steps:"
echo "  1. Clear browser cache or use incognito/private window"
echo "  2. Refresh the application page"
echo "  3. Check the Settings page to verify keys are shown"
echo "  4. Try sending a chat message to test"
echo ""
print_info "If keys still don't appear:"
echo "  • Check service logs: sudo journalctl -u secure-ai-chat -n 50"
echo "  • Verify keys file: ls -la .secure-storage/"
echo "  • Test API endpoint: curl http://localhost:3000/api/keys/retrieve"
