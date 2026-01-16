#!/bin/bash
# Remote VM Validation Script for Secure AI Chat v1.0.11
# Usage: ./validate-remote-vm.sh <VM_PUBLIC_IP> [PORT]

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <VM_PUBLIC_IP> [PORT]"
  echo "Example: $0 203.0.113.45"
  echo "Example: $0 203.0.113.45 3000"
  exit 1
fi

VM_IP="$1"
PORT="${2:-3000}"
BASE_URL="http://$VM_IP:$PORT"
TIMEOUT=10

echo "=========================================="
echo "Remote VM Validation - v1.0.11"
echo "VM IP: $VM_IP"
echo "Port: $PORT"
echo "Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

# Test function
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local description="$4"
  
  echo -n "Testing $name... "
  
  response=$(curl -s -w "\n%{http_code}" --connect-timeout $TIMEOUT --max-time $TIMEOUT "$url" 2>/dev/null || echo -e "\n000")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "000" ]; then
    if [ "$http_code" = "000" ]; then
      echo -e "${RED}❌ FAIL (Connection timeout/refused)${NC}"
      if [ -n "$description" ]; then
        echo "   $description"
      fi
      ((FAIL++))
      return 1
    elif [ -n "$expected" ]; then
      if echo "$body" | grep -q "$expected" 2>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASS++))
        return 0
      else
        echo -e "${YELLOW}⚠️  WARN (unexpected response)${NC}"
        if [ -n "$description" ]; then
          echo "   $description"
        fi
        ((WARN++))
        return 1
      fi
    else
      echo -e "${GREEN}✅ PASS${NC}"
      ((PASS++))
      return 0
    fi
  else
    echo -e "${RED}❌ FAIL (HTTP $http_code)${NC}"
    if [ -n "$description" ]; then
      echo "   $description"
    fi
    ((FAIL++))
    return 1
  fi
}

# Detailed test with response
test_endpoint_detailed() {
  local name="$1"
  local url="$2"
  
  echo -e "${BLUE}=== $name ===${NC}"
  response=$(curl -s --connect-timeout $TIMEOUT --max-time $TIMEOUT "$url" 2>/dev/null || echo '{"error":"Connection failed"}')
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
  echo ""
}

# 1. Health Check
test_endpoint "Health Check" "$BASE_URL/api/health" "ok" "Server is running"

# 2. Version Check
test_endpoint "Version Check" "$BASE_URL/api/version" "1.0.11" "Correct version installed"

# 3. WAF Health
test_endpoint "WAF Health" "$BASE_URL/api/waf/health" "integrated" "WAF middleware active"

# 4. API Keys Status
test_endpoint "API Keys Status" "$BASE_URL/api/keys" "configured" "Keys endpoint accessible"

# 5. Settings Status
test_endpoint "Settings Status" "$BASE_URL/api/settings/status" "status" "Settings endpoint accessible"

# 6. Cache Health
test_endpoint "Cache Health" "$BASE_URL/api/health/cache" "status" "Cache service running"

# 7. System Logs
test_endpoint "System Logs" "$BASE_URL/api/logs/system?limit=1" "" "Logs endpoint accessible"

# 8. WAF Logs
test_endpoint "WAF Logs" "$BASE_URL/api/waf/logs?limit=1" "success" "WAF logs accessible"

# 9. Release Notes
test_endpoint "Release Notes" "$BASE_URL/api/release-notes" "releaseNotes" "Release notes accessible"

# 10. Files List
test_endpoint "Files List" "$BASE_URL/api/files/list" "" "Files endpoint accessible"

echo ""
echo "=========================================="
echo "Detailed Information"
echo "=========================================="
echo ""

# Show detailed responses
test_endpoint_detailed "Health Details" "$BASE_URL/api/health"
test_endpoint_detailed "Version Details" "$BASE_URL/api/version"
test_endpoint_detailed "WAF Status" "$BASE_URL/api/waf/health"
test_endpoint_detailed "API Keys Configuration" "$BASE_URL/api/keys"

# Show recent errors if any
echo -e "${BLUE}=== Recent Errors (Last 5) ===${NC}"
errors=$(curl -s --connect-timeout $TIMEOUT --max-time $TIMEOUT "$BASE_URL/api/logs/system?level=error&limit=5" 2>/dev/null || echo '[]')
error_count=$(echo "$errors" | jq 'length' 2>/dev/null || echo "0")
if [ "$error_count" -gt 0 ]; then
  echo "$errors" | jq '.[] | {timestamp, service, message}' 2>/dev/null || echo "$errors"
else
  echo "No errors found"
fi
echo ""

# Show WAF statistics
echo -e "${BLUE}=== WAF Statistics ===${NC}"
waf_stats=$(curl -s --connect-timeout $TIMEOUT --max-time $TIMEOUT "$BASE_URL/api/waf/health" 2>/dev/null || echo '{}')
echo "$waf_stats" | jq '.statistics' 2>/dev/null || echo "Unable to fetch statistics"
echo ""

echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ] && [ $WARN -eq 0 ]; then
  echo -e "${GREEN}✅ All endpoints accessible and working!${NC}"
  echo ""
  echo "The application is properly configured and running on the remote VM."
  exit 0
elif [ $FAIL -eq 0 ]; then
  echo -e "${YELLOW}⚠️  All endpoints accessible with some warnings.${NC}"
  echo ""
  echo "The application is running but may need configuration adjustments."
  exit 0
else
  echo -e "${RED}❌ Some endpoints failed.${NC}"
  echo ""
  echo "Possible issues:"
  echo "  - Firewall blocking port $PORT"
  echo "  - Server not running"
  echo "  - Network connectivity issues"
  echo "  - Security group rules need adjustment"
  echo ""
  echo "Check:"
  echo "  1. Server is running: ssh into VM and check 'npm start'"
  echo "  2. Port is open: telnet $VM_IP $PORT"
  echo "  3. Firewall rules allow port $PORT"
  exit 1
fi
