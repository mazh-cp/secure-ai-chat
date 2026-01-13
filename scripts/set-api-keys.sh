#!/usr/bin/env bash
# Secure AI Chat - CLI Script to Set API Keys
# Sets OpenAI, Lakera AI, Lakera Project ID, and Lakera Endpoint via command line
#
# Usage:
#   bash scripts/set-api-keys.sh --openai-key "sk-..." --lakera-key "..." --lakera-project-id "..." --lakera-endpoint "https://api.lakera.ai/v2/guard"
#   OR
#   bash scripts/set-api-keys.sh --openai-key "sk-..."
#   OR (interactive mode)
#   bash scripts/set-api-keys.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
OPENAI_KEY=""
LAKERA_KEY=""
LAKERA_PROJECT_ID=""
LAKERA_ENDPOINT=""
CHECKPOINT_TE_KEY=""

# Function to print colored output
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Secure AI Chat - Set API Keys via CLI

Usage:
  bash scripts/set-api-keys.sh [OPTIONS]

Options:
  --openai-key KEY           OpenAI API key (starts with sk-)
  --lakera-key KEY           Lakera AI API key
  --lakera-project-id ID      Lakera Project ID
  --lakera-endpoint URL       Lakera API endpoint (default: https://api.lakera.ai/v2/guard)
  --checkpoint-te-key KEY     Check Point Threat Emulation API key
  --api-url URL              API base URL (default: http://localhost:3000)
  --help                     Show this help message

Examples:
  # Set all keys
  bash scripts/set-api-keys.sh \\
    --openai-key "sk-..." \\
    --lakera-key "lkr_..." \\
    --lakera-project-id "proj_..." \\
    --checkpoint-te-key "TE_API_KEY_..."

  # Set only OpenAI key
  bash scripts/set-api-keys.sh --openai-key "sk-..."

  # Set Check Point TE key only
  bash scripts/set-api-keys.sh --checkpoint-te-key "TE_API_KEY_..."

  # Set keys for remote server
  bash scripts/set-api-keys.sh \\
    --api-url "https://your-domain.com" \\
    --openai-key "sk-..." \\
    --lakera-key "lkr_..." \\
    --checkpoint-te-key "TE_API_KEY_..."

  # Interactive mode (no arguments)
  bash scripts/set-api-keys.sh

Environment Variables:
  API_BASE_URL               Override default API URL (http://localhost:3000)

EOF
}

# Parse command line arguments
INTERACTIVE=false
if [ $# -eq 0 ]; then
    INTERACTIVE=true
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --openai-key)
            OPENAI_KEY="$2"
            shift 2
            ;;
        --lakera-key)
            LAKERA_KEY="$2"
            shift 2
            ;;
        --lakera-project-id)
            LAKERA_PROJECT_ID="$2"
            shift 2
            ;;
        --lakera-endpoint)
            LAKERA_ENDPOINT="$2"
            shift 2
            ;;
        --checkpoint-te-key)
            CHECKPOINT_TE_KEY="$2"
            shift 2
            ;;
        --api-url)
            API_BASE_URL="$2"
            shift 2
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Interactive mode
if [ "$INTERACTIVE" = true ]; then
    log_info "Interactive mode - Enter API keys (press Enter to skip)"
    echo ""
    
    read -p "OpenAI API Key (sk-...): " OPENAI_KEY
    read -p "Lakera AI Key: " LAKERA_KEY
    read -p "Lakera Project ID: " LAKERA_PROJECT_ID
    read -p "Lakera Endpoint [https://api.lakera.ai/v2/guard]: " LAKERA_ENDPOINT
    read -p "Check Point TE API Key: " CHECKPOINT_TE_KEY
    
    # Set default endpoint if empty
    if [ -z "$LAKERA_ENDPOINT" ]; then
        LAKERA_ENDPOINT="https://api.lakera.ai/v2/guard"
    fi
fi

# Validate that at least one key is provided
if [ -z "$OPENAI_KEY" ] && [ -z "$LAKERA_KEY" ] && [ -z "$LAKERA_PROJECT_ID" ] && [ -z "$CHECKPOINT_TE_KEY" ]; then
    log_error "At least one API key must be provided"
    show_usage
    exit 1
fi

# Validate OpenAI key format if provided
if [ -n "$OPENAI_KEY" ]; then
    if [[ ! "$OPENAI_KEY" =~ ^sk- ]]; then
        log_warning "OpenAI key should start with 'sk-'"
    fi
    if [ ${#OPENAI_KEY} -lt 20 ]; then
        log_error "OpenAI key appears too short (minimum 20 characters)"
        exit 1
    fi
fi

# Validate Lakera key format if provided
if [ -n "$LAKERA_KEY" ]; then
    if [ ${#LAKERA_KEY} -lt 20 ]; then
        log_warning "Lakera key appears too short (minimum 20 characters)"
    fi
fi

# Validate Lakera Project ID format if provided
if [ -n "$LAKERA_PROJECT_ID" ]; then
    if [ ${#LAKERA_PROJECT_ID} -lt 5 ]; then
        log_error "Lakera Project ID appears too short (minimum 5 characters)"
        exit 1
    fi
fi

# Validate Lakera endpoint format if provided
if [ -n "$LAKERA_ENDPOINT" ]; then
    if [[ ! "$LAKERA_ENDPOINT" =~ ^https?:// ]]; then
        log_error "Lakera endpoint must be a valid URL (http:// or https://)"
        exit 1
    fi
fi

# Validate Check Point TE key format if provided
if [ -n "$CHECKPOINT_TE_KEY" ]; then
    # Remove TE_API_KEY_ prefix if present (will be added by server)
    if [[ "$CHECKPOINT_TE_KEY" =~ ^TE_API_KEY_ ]]; then
        CHECKPOINT_TE_KEY="${CHECKPOINT_TE_KEY#TE_API_KEY_}"
    fi
    if [ ${#CHECKPOINT_TE_KEY} -lt 10 ]; then
        log_error "Check Point TE key appears too short (minimum 10 characters)"
        exit 1
    fi
fi

# Build JSON payload
JSON_PAYLOAD="{"
FIRST=true

if [ -n "$OPENAI_KEY" ]; then
    if [ "$FIRST" = false ]; then
        JSON_PAYLOAD+=","
    fi
    JSON_PAYLOAD+="\"openAiKey\":\"$OPENAI_KEY\""
    FIRST=false
fi

if [ -n "$LAKERA_KEY" ]; then
    if [ "$FIRST" = false ]; then
        JSON_PAYLOAD+=","
    fi
    JSON_PAYLOAD+="\"lakeraAiKey\":\"$LAKERA_KEY\""
    FIRST=false
fi

if [ -n "$LAKERA_PROJECT_ID" ]; then
    if [ "$FIRST" = false ]; then
        JSON_PAYLOAD+=","
    fi
    JSON_PAYLOAD+="\"lakeraProjectId\":\"$LAKERA_PROJECT_ID\""
    FIRST=false
fi

if [ -n "$LAKERA_ENDPOINT" ]; then
    if [ "$FIRST" = false ]; then
        JSON_PAYLOAD+=","
    fi
    JSON_PAYLOAD+="\"lakeraEndpoint\":\"$LAKERA_ENDPOINT\""
    FIRST=false
fi

JSON_PAYLOAD+="}"

# Check if server is running
log_info "Checking server connection at $API_BASE_URL..."
if ! curl -sf "${API_BASE_URL}/api/health" >/dev/null 2>&1; then
    log_error "Cannot connect to server at $API_BASE_URL"
    log_info "Make sure the server is running, or set API_BASE_URL environment variable:"
    log_info "  export API_BASE_URL=https://your-domain.com"
    exit 1
fi
log_success "Server connection OK"

# Save OpenAI/Lakera keys if provided
if [ -n "$OPENAI_KEY" ] || [ -n "$LAKERA_KEY" ] || [ -n "$LAKERA_PROJECT_ID" ] || [ -n "$LAKERA_ENDPOINT" ]; then
    log_info "Sending OpenAI/Lakera API keys to server..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "${API_BASE_URL}/api/keys" \
        -H "Content-Type: application/json" \
        -d "{\"keys\":${JSON_PAYLOAD}}" \
        2>&1) || {
        log_error "Failed to send request to server"
        exit 1
    }

    # Extract HTTP status code (last line)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    # Check response
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "OpenAI/Lakera API keys saved successfully!"
        
        # Parse and display configured keys
        CONFIGURED=$(echo "$BODY" | grep -o '"configured":{[^}]*}' || echo "")
        if [ -n "$CONFIGURED" ]; then
            echo ""
            log_info "Configured keys:"
            echo "$BODY" | grep -o '"configured":{[^}]*}' | sed 's/"configured":{//' | sed 's/}//' | tr ',' '\n' | sed 's/"//g' | sed 's/^/  /' || true
        fi
    else
        log_error "Failed to save OpenAI/Lakera API keys (HTTP $HTTP_CODE)"
        ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 || echo "Unknown error")
        if [ -n "$ERROR_MSG" ]; then
            log_error "Error: $ERROR_MSG"
        else
            echo "$BODY" | head -20
        fi
        exit 1
    fi
fi

# Save Check Point TE key if provided
if [ -n "$CHECKPOINT_TE_KEY" ]; then
    log_info "Sending Check Point TE API key to server..."
    TE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "${API_BASE_URL}/api/te/config" \
        -H "Content-Type: application/json" \
        -d "{\"apiKey\":\"$CHECKPOINT_TE_KEY\"}" \
        2>&1) || {
        log_error "Failed to send Check Point TE key to server"
        exit 1
    }

    # Extract HTTP status code (last line)
    TE_HTTP_CODE=$(echo "$TE_RESPONSE" | tail -n1)
    TE_BODY=$(echo "$TE_RESPONSE" | sed '$d')

    # Check response
    if [ "$TE_HTTP_CODE" = "200" ]; then
        log_success "Check Point TE API key saved successfully!"
    else
        log_error "Failed to save Check Point TE API key (HTTP $TE_HTTP_CODE)"
        TE_ERROR_MSG=$(echo "$TE_BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 || echo "Unknown error")
        if [ -n "$TE_ERROR_MSG" ]; then
            log_error "Error: $TE_ERROR_MSG"
        else
            echo "$TE_BODY" | head -20
        fi
        exit 1
    fi
fi

echo ""
log_success "All keys are now stored securely on the server"
log_info "You can verify keys are configured by checking:"
log_info "  - OpenAI/Lakera: ${API_BASE_URL}/api/keys"
log_info "  - Check Point TE: ${API_BASE_URL}/api/te/config"
