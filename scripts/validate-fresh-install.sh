#!/bin/bash
# Fresh Install Validation Script for v1.0.11
# This script validates a fresh installation of Secure AI Chat v1.0.11

set -e  # Exit on error

echo "=========================================="
echo "Fresh Install Validation - v1.0.11"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

# Function to print pass
print_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASS_COUNT++))
}

# Function to print fail
print_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((FAIL_COUNT++))
}

# Function to print info
print_info() {
  echo -e "${YELLOW}ℹ️  $1${NC}"
}

# 1. Check Node version
echo "1. Checking Node version..."
NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
if [ "$NODE_VERSION" != "not found" ]; then
  print_pass "Node.js installed: $NODE_VERSION"
else
  print_fail "Node.js not found"
  exit 1
fi

# Check Node version requirement (warning only)
npm run check:node 2>&1 | grep -q "Node OK" && print_pass "Node version check" || print_info "Node version warning (non-blocking)"

echo ""

# 2. Check installation
echo "2. Checking installation..."
if [ ! -d "node_modules" ]; then
  print_fail "node_modules not found. Run 'npm install'"
  exit 1
fi
print_pass "Dependencies installed"

echo ""

# 3. Type check
echo "3. Running TypeScript type check..."
if npm run type-check > /dev/null 2>&1; then
  print_pass "Type check passed"
else
  print_fail "Type check failed"
  exit 1
fi

echo ""

# 4. Build
echo "4. Building application..."
if npm run build > /dev/null 2>&1; then
  print_pass "Build successful"
else
  print_fail "Build failed"
  exit 1
fi

echo ""

# 5. Start server
echo "5. Starting server..."
npm start > /tmp/secure-ai-chat-server.log 2>&1 &
SERVER_PID=$!
print_info "Server starting (PID: $SERVER_PID)"

# Wait for server to start
echo "   Waiting for server to be ready..."
for i in {1..15}; do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    print_pass "Server started and responding"
    break
  fi
  if [ $i -eq 15 ]; then
    print_fail "Server failed to start within 15 seconds"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done

echo ""

# 6. Health check
echo "6. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health)
HEALTH_STATUS=$(echo $HEALTH_RESPONSE | grep -o '"status":"ok"' || echo "")
if [ ! -z "$HEALTH_STATUS" ]; then
  print_pass "Health endpoint: OK"
else
  print_fail "Health endpoint failed"
  echo "   Response: $HEALTH_RESPONSE"
fi

echo ""

# 7. Version check
echo "7. Testing version endpoint..."
VERSION_RESPONSE=$(curl -s http://localhost:3000/api/version)
VERSION=$(echo $VERSION_RESPONSE | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
if [ "$VERSION" = "1.0.11" ]; then
  print_pass "Version check: $VERSION"
else
  print_fail "Version check failed: Expected 1.0.11, got $VERSION"
fi

echo ""

# 8. WAF health check
echo "8. Testing WAF health endpoint..."
WAF_RESPONSE=$(curl -s http://localhost:3000/api/waf/health)
WAF_INTEGRATED=$(echo $WAF_RESPONSE | grep -o '"integrated":true' || echo "")
if [ ! -z "$WAF_INTEGRATED" ]; then
  print_pass "WAF integration: Active"
else
  print_fail "WAF integration check failed"
fi

echo ""

# 9. Keys endpoint
echo "9. Testing keys endpoint..."
KEYS_RESPONSE=$(curl -s http://localhost:3000/api/keys)
if echo "$KEYS_RESPONSE" | grep -q "configured" 2>/dev/null; then
  print_pass "Keys endpoint: Working"
else
  print_fail "Keys endpoint failed"
fi

echo ""

# 10. Azure OpenAI validation endpoint
echo "10. Testing Azure OpenAI validation endpoint..."
AZURE_VALIDATION=$(curl -s -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"test","endpoint":"invalid"}' 2>/dev/null)
if echo "$AZURE_VALIDATION" | grep -q "error" 2>/dev/null; then
  print_pass "Azure OpenAI validation endpoint: Working (returns error for invalid input as expected)"
else
  print_fail "Azure OpenAI validation endpoint failed"
fi

echo ""

# 11. WAF logs endpoint
echo "11. Testing WAF logs endpoint..."
WAF_LOGS=$(curl -s "http://localhost:3000/api/waf/logs?limit=1" 2>/dev/null)
if echo "$WAF_LOGS" | grep -q "success\|logs" 2>/dev/null; then
  print_pass "WAF logs endpoint: Working"
else
  print_fail "WAF logs endpoint failed"
fi

echo ""

# 12. Release notes endpoint
echo "12. Testing release notes endpoint..."
RELEASE_NOTES=$(curl -s http://localhost:3000/api/release-notes 2>/dev/null)
if echo "$RELEASE_NOTES" | grep -q "releaseNotes\|1.0.11" 2>/dev/null; then
  print_pass "Release notes endpoint: Working"
else
  print_fail "Release notes endpoint failed"
fi

echo ""

# Cleanup
echo "13. Stopping server..."
kill $SERVER_PID 2>/dev/null
sleep 2
print_pass "Server stopped"

echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✅ ALL VALIDATION CHECKS PASSED!${NC}"
  echo ""
  echo "Fresh install of v1.0.11 is working correctly."
  exit 0
else
  echo -e "${RED}❌ SOME VALIDATION CHECKS FAILED${NC}"
  echo ""
  echo "Please review the errors above and check the troubleshooting guide."
  exit 1
fi
