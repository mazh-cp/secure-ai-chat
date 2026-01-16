#!/bin/bash

# Secure AI Chat - API Keys Update Script
# Updates API keys via CLI on the server side
# 
# Usage:
#   ./scripts/update-api-keys.sh
#   ./scripts/update-api-keys.sh --openai-key "sk-..."
#   ./scripts/update-api-keys.sh --lakera-key "lak-..." --checkpoint-key "cp-..."

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

print_header "Secure AI Chat - API Keys Update"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

# Parse command line arguments
OPENAI_KEY=""
LAKERA_KEY=""
CHECKPOINT_KEY=""
INTERACTIVE=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --openai-key)
            OPENAI_KEY="$2"
            INTERACTIVE=false
            shift 2
            ;;
        --lakera-key)
            LAKERA_KEY="$2"
            INTERACTIVE=false
            shift 2
            ;;
        --checkpoint-key)
            CHECKPOINT_KEY="$2"
            INTERACTIVE=false
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --openai-key KEY       Set OpenAI API key"
            echo "  --lakera-key KEY       Set Lakera AI API key"
            echo "  --checkpoint-key KEY   Set Check Point ThreatCloud API key"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Interactive mode"
            echo "  $0 --openai-key \"sk-...\"            # Set OpenAI key only"
            echo "  $0 --openai-key \"sk-...\" --lakera-key \"lak-...\"  # Set multiple keys"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Interactive mode
if [ "$INTERACTIVE" = true ]; then
    print_info "Interactive mode - Enter keys to update (press Enter to skip)"
    echo ""
    
    # OpenAI Key
    read -sp "OpenAI API Key (sk-...): " OPENAI_KEY_INPUT
    echo ""
    if [ -n "$OPENAI_KEY_INPUT" ]; then
        OPENAI_KEY="$OPENAI_KEY_INPUT"
    fi
    
    # Lakera Key
    read -sp "Lakera AI API Key (lak-...): " LAKERA_KEY_INPUT
    echo ""
    if [ -n "$LAKERA_KEY_INPUT" ]; then
        LAKERA_KEY="$LAKERA_KEY_INPUT"
    fi
    
    # Check Point Key
    read -sp "Check Point ThreatCloud API Key: " CHECKPOINT_KEY_INPUT
    echo ""
    if [ -n "$CHECKPOINT_KEY_INPUT" ]; then
        CHECKPOINT_KEY="$CHECKPOINT_KEY_INPUT"
    fi
fi

# Check if any keys were provided
if [ -z "$OPENAI_KEY" ] && [ -z "$LAKERA_KEY" ] && [ -z "$CHECKPOINT_KEY" ]; then
    print_warning "No keys provided to update"
    echo ""
    echo "Usage: $0 --openai-key \"sk-...\" [--lakera-key \"lak-...\"] [--checkpoint-key \"cp-...\"]"
    echo "   Or: $0  # for interactive mode"
    exit 0
fi

# Create Node.js script to update keys using the actual storage module
cat > /tmp/update-keys-$$.js << 'UPDATE_SCRIPT'
const { saveApiKeys } = require('./lib/api-keys-storage');
const { saveThreatCloudKey } = require('./lib/checkpoint-te');

const appDir = process.argv[2];
process.chdir(appDir);

const keys = {};
const args = process.argv.slice(3);

for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (key && value) {
        keys[key] = value;
    }
}

if (Object.keys(keys).length === 0) {
    console.error('ERROR: No keys provided');
    process.exit(1);
}

(async () => {
    try {
        // Handle OpenAI and Lakera keys
        const apiKeys = {};
        if (keys.openaiApiKey) {
            apiKeys.openaiApiKey = keys.openaiApiKey;
        }
        if (keys.lakeraApiKey) {
            apiKeys.lakeraApiKey = keys.lakeraApiKey;
        }
        
        if (Object.keys(apiKeys).length > 0) {
            await saveApiKeys(apiKeys);
        }
        
        // Handle Check Point key separately
        if (keys.threatCloudApiKey) {
            await saveThreatCloudKey(keys.threatCloudApiKey);
        }
        
        console.log('SUCCESS');
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
})();
UPDATE_SCRIPT

# Prepare arguments for Node.js script
NODE_ARGS=""
if [ -n "$OPENAI_KEY" ]; then
    NODE_ARGS="$NODE_ARGS openaiApiKey \"$OPENAI_KEY\""
fi
if [ -n "$LAKERA_KEY" ]; then
    NODE_ARGS="$NODE_ARGS lakeraApiKey \"$LAKERA_KEY\""
fi
if [ -n "$CHECKPOINT_KEY" ]; then
    NODE_ARGS="$NODE_ARGS threatCloudApiKey \"$CHECKPOINT_KEY\""
fi

# Update keys
print_info "Updating API keys..."
RESULT=$(cd "$APP_DIR" && node /tmp/update-keys-$$.js "$APP_DIR" $NODE_ARGS 2>&1) || true
rm -f /tmp/update-keys-$$.js

if echo "$RESULT" | grep -q "SUCCESS"; then
    print_success "API keys updated successfully"
else
    print_error "Failed to update API keys"
    echo "$RESULT" | tail -5
    exit 1
fi

# Restart service if running
if command -v systemctl &> /dev/null && systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    print_info "Restarting secure-ai-chat service to apply changes..."
    sudo systemctl restart secure-ai-chat
    sleep 2
    if systemctl is-active --quiet secure-ai-chat; then
        print_success "Service restarted successfully"
    else
        print_warning "Service restart may have failed. Check status: sudo systemctl status secure-ai-chat"
    fi
fi

print_success "API keys update complete!"
