#!/bin/bash

# Test script to generate logs for Azure OpenAI API key/endpoint errors
# This script tests various error scenarios to help debug Azure OpenAI integration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
LOG_DIR="${LOG_DIR:-./azure-openai-test-logs}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create log directory
mkdir -p "$LOG_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Azure OpenAI Error Testing Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Base URL: $BASE_URL"
echo "Log Directory: $LOG_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Test scenarios
declare -a TEST_SCENARIOS=(
    "invalid_key:Invalid API key format"
    "invalid_endpoint:Invalid endpoint URL"
    "wrong_endpoint:Wrong endpoint format"
    "missing_deployment:Valid credentials but wrong deployment"
    "timeout:Endpoint timeout scenario"
    "network_error:Network connectivity issues"
    "auth_failed:Authentication failure"
    "deployment_unavailable:Deployment not available"
)

# Function to test validation endpoint
test_validation() {
    local scenario=$1
    local api_key=$2
    local endpoint=$3
    local deployment=$4
    local description=$5
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "  API Key: ${api_key:0:10}..."
    echo "  Endpoint: $endpoint"
    echo "  Deployment: ${deployment:-not specified}"
    echo ""
    
    local log_file="$LOG_DIR/${scenario}_${TIMESTAMP}.json"
    local response_file="$LOG_DIR/${scenario}_${TIMESTAMP}_response.json"
    
    # Make request
    local response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/health/azure-openai" \
        -H "Content-Type: application/json" \
        -d "{
            \"apiKey\": \"$api_key\",
            \"endpoint\": \"$endpoint\",
            \"deploymentName\": \"$deployment\"
        }" 2>&1)
    
    # Split response and status code
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    # Save response
    echo "$body" | jq . > "$response_file" 2>/dev/null || echo "$body" > "$response_file"
    
    # Log test details
    cat > "$log_file" << EOF
{
  "scenario": "$scenario",
  "description": "$description",
  "timestamp": "$TIMESTAMP",
  "request": {
    "apiKey": "${api_key:0:10}...",
    "endpoint": "$endpoint",
    "deploymentName": "$deployment"
  },
  "response": {
    "httpCode": $http_code,
    "body": $(echo "$body" | jq . 2>/dev/null || echo "\"$body\"")
  }
}
EOF
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Test passed (HTTP $http_code)${NC}"
    else
        echo -e "${RED}❌ Test failed (HTTP $http_code)${NC}"
        echo "Response: $(echo "$body" | jq -r '.error // .message // .' 2>/dev/null || echo "$body")"
    fi
    
    echo "  Log saved to: $log_file"
    echo "  Response saved to: $response_file"
    echo ""
}

# Function to test chat endpoint
test_chat() {
    local scenario=$1
    local api_key=$2
    local endpoint=$3
    local model=$4
    local description=$5
    
    echo -e "${YELLOW}Testing Chat API: $description${NC}"
    echo "  Provider: azure"
    echo "  Model: $model"
    echo ""
    
    local log_file="$LOG_DIR/${scenario}_chat_${TIMESTAMP}.json"
    local response_file="$LOG_DIR/${scenario}_chat_${TIMESTAMP}_response.json"
    
    # Get API keys status first
    local keys_response=$(curl -s "$BASE_URL/api/keys/retrieve")
    
    # Make chat request
    local response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/chat" \
        -H "Content-Type: application/json" \
        -d "{
            \"messages\": [{\"role\": \"user\", \"content\": \"Hello, this is a test message\"}],
            \"model\": \"$model\",
            \"provider\": \"azure\",
            \"apiKeys\": {
                \"azureOpenAiKey\": \"$api_key\",
                \"azureOpenAiEndpoint\": \"$endpoint\",
                \"openAiKey\": \"configured\",
                \"lakeraAiKey\": \"\",
                \"checkpointTeApiKey\": \"\"
            },
            \"scanOptions\": {
                \"scanInput\": false,
                \"scanOutput\": false
            },
            \"enableRAG\": false
        }" 2>&1)
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    # Save response
    echo "$body" | jq . > "$response_file" 2>/dev/null || echo "$body" > "$response_file"
    
    # Log test details
    cat > "$log_file" << EOF
{
  "scenario": "$scenario",
  "description": "$description",
  "timestamp": "$TIMESTAMP",
  "request": {
    "provider": "azure",
    "model": "$model",
    "endpoint": "$endpoint",
    "apiKey": "${api_key:0:10}..."
  },
  "response": {
    "httpCode": $http_code,
    "body": $(echo "$body" | jq . 2>/dev/null || echo "\"$body\"")
  }
}
EOF
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Chat test passed (HTTP $http_code)${NC}"
    else
        echo -e "${RED}❌ Chat test failed (HTTP $http_code)${NC}"
        echo "Response: $(echo "$body" | jq -r '.error // .message // .' 2>/dev/null || echo "$body")"
    fi
    
    echo "  Log saved to: $log_file"
    echo "  Response saved to: $response_file"
    echo ""
}

# Test 1: Invalid API Key
echo -e "${BLUE}Test 1: Invalid API Key${NC}"
test_validation "invalid_key" \
    "invalid-key-123" \
    "https://test.openai.azure.com" \
    "gpt-4o-mini" \
    "Testing with invalid API key format"

# Test 2: Invalid Endpoint URL
echo -e "${BLUE}Test 2: Invalid Endpoint URL${NC}"
test_validation "invalid_endpoint" \
    "valid-key-123456789012345678901234567890" \
    "not-a-valid-url" \
    "gpt-4o-mini" \
    "Testing with invalid endpoint URL format"

# Test 3: Wrong Endpoint Format
echo -e "${BLUE}Test 3: Wrong Endpoint Format${NC}"
test_validation "wrong_endpoint" \
    "valid-key-123456789012345678901234567890" \
    "https://wrong-endpoint.com" \
    "gpt-4o-mini" \
    "Testing with wrong endpoint (not Azure OpenAI)"

# Test 4: Missing Deployment
echo -e "${BLUE}Test 4: Missing Deployment${NC}"
if [ -n "$AZURE_OPENAI_KEY" ] && [ -n "$AZURE_OPENAI_ENDPOINT" ]; then
    test_validation "missing_deployment" \
        "$AZURE_OPENAI_KEY" \
        "$AZURE_OPENAI_ENDPOINT" \
        "non-existent-deployment-12345" \
        "Testing with valid credentials but non-existent deployment"
else
    echo -e "${YELLOW}⚠️  Skipping (AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT not set)${NC}"
fi

# Test 5: Timeout Scenario (using unreachable endpoint)
echo -e "${BLUE}Test 5: Timeout Scenario${NC}"
test_validation "timeout" \
    "valid-key-123456789012345678901234567890" \
    "https://192.168.255.255:443" \
    "gpt-4o-mini" \
    "Testing timeout with unreachable endpoint"

# Test 6: Network Error (invalid DNS)
echo -e "${BLUE}Test 6: Network Error${NC}"
test_validation "network_error" \
    "valid-key-123456789012345678901234567890" \
    "https://this-domain-does-not-exist-12345.azure.com" \
    "gpt-4o-mini" \
    "Testing network error with invalid DNS"

# Test 7: Authentication Failure (if real credentials provided)
echo -e "${BLUE}Test 7: Authentication Failure${NC}"
if [ -n "$AZURE_OPENAI_ENDPOINT" ]; then
    test_validation "auth_failed" \
        "wrong-key-123456789012345678901234567890" \
        "$AZURE_OPENAI_ENDPOINT" \
        "gpt-4o-mini" \
        "Testing authentication failure with wrong API key"
else
    echo -e "${YELLOW}⚠️  Skipping (AZURE_OPENAI_ENDPOINT not set)${NC}"
fi

# Test 8: Deployment Unavailable (if real credentials provided)
echo -e "${BLUE}Test 8: Deployment Unavailable${NC}"
if [ -n "$AZURE_OPENAI_KEY" ] && [ -n "$AZURE_OPENAI_ENDPOINT" ]; then
    test_validation "deployment_unavailable" \
        "$AZURE_OPENAI_KEY" \
        "$AZURE_OPENAI_ENDPOINT" \
        "gpt-4o-mini" \
        "Testing deployment availability"
else
    echo -e "${YELLOW}⚠️  Skipping (AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT not set)${NC}"
fi

# Test Chat API with invalid credentials
echo -e "${BLUE}Test 9: Chat API with Invalid Credentials${NC}"
test_chat "chat_invalid" \
    "invalid-key-123" \
    "https://test.openai.azure.com" \
    "gpt-4o-mini" \
    "Testing chat API with invalid Azure OpenAI credentials"

# Generate summary report
SUMMARY_FILE="$LOG_DIR/summary_${TIMESTAMP}.md"
cat > "$SUMMARY_FILE" << EOF
# Azure OpenAI Error Testing Summary

**Generated:** $(date)
**Base URL:** $BASE_URL
**Log Directory:** $LOG_DIR

## Test Results

EOF

for log_file in "$LOG_DIR"/*_${TIMESTAMP}.json; do
    if [ -f "$log_file" ]; then
        scenario=$(jq -r '.scenario' "$log_file" 2>/dev/null || echo "unknown")
        description=$(jq -r '.description' "$log_file" 2>/dev/null || echo "N/A")
        http_code=$(jq -r '.response.httpCode' "$log_file" 2>/dev/null || echo "N/A")
        error=$(jq -r '.response.body.error // .response.body.message // "N/A"' "$log_file" 2>/dev/null || echo "N/A")
        
        echo "### $scenario" >> "$SUMMARY_FILE"
        echo "- **Description:** $description" >> "$SUMMARY_FILE"
        echo "- **HTTP Code:** $http_code" >> "$SUMMARY_FILE"
        echo "- **Error:** $error" >> "$SUMMARY_FILE"
        echo "- **Log File:** $(basename "$log_file")" >> "$SUMMARY_FILE"
        echo "" >> "$SUMMARY_FILE"
    fi
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Testing Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "All logs saved to: $LOG_DIR"
echo "Summary report: $SUMMARY_FILE"
echo ""
echo -e "${BLUE}To view logs:${NC}"
echo "  cat $SUMMARY_FILE"
echo "  ls -lh $LOG_DIR"
echo ""
echo -e "${BLUE}To view server logs (if using systemd):${NC}"
echo "  sudo journalctl -u secure-ai-chat -f"
echo ""
echo -e "${BLUE}To view server logs (if running manually):${NC}"
echo "  Check console output or log files in the application directory"
echo ""
