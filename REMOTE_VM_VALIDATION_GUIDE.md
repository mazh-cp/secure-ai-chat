# Remote VM Validation & Troubleshooting Guide

**Version**: 1.0.11  
**Purpose**: Curl commands for validating and troubleshooting Secure AI Chat on a remote VM via public IP

---

## 🌐 Prerequisites

Replace `YOUR_VM_PUBLIC_IP` with your actual VM public IP address in all commands below.

**Example**: If your VM public IP is `203.0.113.45`, use:
```bash
VM_IP="203.0.113.45"
# or
VM_IP="your-domain.com"  # If using domain name
```

---

## 📋 Basic Health Checks

### 1. Check if Server is Running
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-16T...",
  "service": "secure-ai-chat",
  "cacheCleanup": "initialized"
}
```

**Status**: ✅ Server is running if you get `{"status":"ok"}`

---

### 2. Check Application Version
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/version
```

**Expected Response**:
```json
{
  "version": "1.0.11",
  "name": "secure-ai-chat"
}
```

**Status**: ✅ Correct version if returns `1.0.11`

---

### 3. Check WAF Integration Status
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/waf/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "service": "secure-ai-chat",
  "waf": {
    "integrated": true,
    "logsEndpoint": "/api/waf/logs",
    "healthEndpoint": "/api/waf/health",
    "authentication": "disabled"
  },
  "statistics": {
    "total": 0,
    "last24Hours": 0,
    "blocked": 0,
    "threats": 0
  }
}
```

**Status**: ✅ WAF integrated if `waf.integrated` is `true`

---

## 🔍 Detailed System Information

### 4. Get API Keys Configuration Status
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/keys
```

**Response Shows**:
- Which keys are configured
- Source of keys (environment vs storage)
- Configuration status for all services

---

### 5. Get Settings Status
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/settings/status
```

**Response Shows**:
- All API key configuration status
- Source of each key
- Overall configuration state

---

### 6. Get Cache/Storage Status
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/health/cache
```

**Response Shows**:
- File storage statistics
- Cache cleanup status
- Last cleanup time
- Next scheduled cleanup

---

## 📊 Logs & Diagnostics

### 7. Get System Logs
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/logs/system
```

**Response**: Array of system log entries with:
- Timestamp
- Level (info, warning, error)
- Service name
- Message
- Metadata

**Filter by Level**:
```bash
# Get only errors
curl "http://YOUR_VM_PUBLIC_IP:3000/api/logs/system?level=error"

# Get only warnings
curl "http://YOUR_VM_PUBLIC_IP:3000/api/logs/system?level=warning"
```

---

### 8. Get Check Point WAF Logs
```bash
# Get all WAF logs (last 100)
curl http://YOUR_VM_PUBLIC_IP:3000/api/waf/logs

# Get only blocked requests
curl "http://YOUR_VM_PUBLIC_IP:3000/api/waf/logs?blocked=true&limit=50"

# Get only errors
curl "http://YOUR_VM_PUBLIC_IP:3000/api/waf/logs?level=error&limit=50"

# Get logs from last 24 hours
curl "http://YOUR_VM_PUBLIC_IP:3000/api/waf/logs?startTime=2026-01-15T00:00:00Z&limit=100"
```

**Export as CSV**:
```bash
curl -X POST http://YOUR_VM_PUBLIC_IP:3000/api/waf/logs \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","limit":1000}' \
  -o waf-logs.csv
```

---

### 9. Get Recent Activity
```bash
# Get last 50 system logs
curl "http://YOUR_VM_PUBLIC_IP:3000/api/logs/system?limit=50" | jq '.[0:10]'

# Get WAF statistics
curl http://YOUR_VM_PUBLIC_IP:3000/api/waf/health | jq '.statistics'
```

---

## 🔧 Environment & Configuration Checks

### 10. Check OpenAI API Key Status
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/health/openai
```

**Response**:
- `{"ok": true}` - API key is valid
- `{"ok": false, "error": "..."}` - API key issue

---

### 11. Validate Azure OpenAI Configuration
```bash
curl -X POST http://YOUR_VM_PUBLIC_IP:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_AZURE_KEY",
    "endpoint": "https://your-resource.openai.azure.com",
    "deploymentName": "gpt-4o-mini"
  }'
```

**Response**:
- `{"ok": true, "message": "..."}` - Valid
- `{"ok": false, "error": "..."}` - Invalid (with specific error)

---

### 12. Check Available Models
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/models
```

**Response**: List of available OpenAI models

---

## 🛠️ Troubleshooting Commands

### 13. Test Chat Endpoint (Without Sending Message)
```bash
# This will fail but shows if endpoint is accessible
curl -X POST http://YOUR_VM_PUBLIC_IP:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[]}'
```

**Expected**: Error about messages array, but confirms endpoint is accessible

---

### 14. Check File Storage Status
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/files/list
```

**Response**: List of uploaded files and their metadata

---

### 15. Get Release Notes
```bash
curl http://YOUR_VM_PUBLIC_IP:3000/api/release-notes
```

**Response**: Structured release notes from CHANGELOG.md

---

## 📝 Generate Comprehensive Logs Report

### 16. Generate Full Diagnostic Report
```bash
VM_IP="YOUR_VM_PUBLIC_IP"
REPORT_FILE="diagnostic-report-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "=========================================="
  echo "Secure AI Chat Diagnostic Report"
  echo "Generated: $(date)"
  echo "VM IP: $VM_IP"
  echo "=========================================="
  echo ""
  
  echo "=== 1. Health Check ==="
  curl -s http://$VM_IP:3000/api/health
  echo ""
  echo ""
  
  echo "=== 2. Version ==="
  curl -s http://$VM_IP:3000/api/version
  echo ""
  echo ""
  
  echo "=== 3. WAF Health ==="
  curl -s http://$VM_IP:3000/api/waf/health
  echo ""
  echo ""
  
  echo "=== 4. API Keys Status ==="
  curl -s http://$VM_IP:3000/api/keys
  echo ""
  echo ""
  
  echo "=== 5. Settings Status ==="
  curl -s http://$VM_IP:3000/api/settings/status
  echo ""
  echo ""
  
  echo "=== 6. Cache Status ==="
  curl -s http://$VM_IP:3000/api/health/cache
  echo ""
  echo ""
  
  echo "=== 7. Recent System Logs (Last 20) ==="
  curl -s "http://$VM_IP:3000/api/logs/system?limit=20"
  echo ""
  echo ""
  
  echo "=== 8. WAF Logs (Last 20) ==="
  curl -s "http://$VM_IP:3000/api/waf/logs?limit=20"
  echo ""
  echo ""
  
  echo "=== 9. File List ==="
  curl -s http://$VM_IP:3000/api/files/list
  echo ""
  echo ""
  
} > "$REPORT_FILE"

echo "Diagnostic report saved to: $REPORT_FILE"
```

---

## 🔐 Secure Access (If Authentication Enabled)

### If WAF Authentication is Enabled

```bash
# Set your WAF API key
WAF_API_KEY="your-waf-secret-key"

# Access WAF endpoints with authentication
curl -H "Authorization: Bearer $WAF_API_KEY" \
  http://YOUR_VM_PUBLIC_IP:3000/api/waf/health

curl -H "Authorization: Bearer $WAF_API_KEY" \
  "http://YOUR_VM_PUBLIC_IP:3000/api/waf/logs?limit=50"
```

---

## 🚨 Error Diagnosis Commands

### 17. Check for Common Issues

```bash
VM_IP="YOUR_VM_PUBLIC_IP"

echo "=== Checking Server Status ==="
curl -s http://$VM_IP:3000/api/health || echo "❌ Server not responding"

echo ""
echo "=== Checking Version ==="
curl -s http://$VM_IP:3000/api/version || echo "❌ Version endpoint failed"

echo ""
echo "=== Checking for Errors in Logs ==="
curl -s "http://$VM_IP:3000/api/logs/system?level=error&limit=10" | jq '.[] | {timestamp, level, service, message}'

echo ""
echo "=== Checking WAF Status ==="
curl -s http://$VM_IP:3000/api/waf/health | jq '.waf'

echo ""
echo "=== Checking API Key Configuration ==="
curl -s http://$VM_IP:3000/api/keys | jq '.configured'
```

---

## 📦 Fetch Configuration Files (If Accessible)

### 18. Get Application Configuration

```bash
VM_IP="YOUR_VM_PUBLIC_IP"

# Get package.json (version info)
curl -s http://$VM_IP:3000/api/version

# Get release notes (changelog)
curl -s http://$VM_IP:3000/api/release-notes > release-notes.json

# Get current configuration status
curl -s http://$VM_IP:3000/api/keys > api-keys-status.json
curl -s http://$VM_IP:3000/api/settings/status > settings-status.json
```

---

## 🔄 Environment Fix Commands

### 19. Check Environment Variables Status

```bash
VM_IP="YOUR_VM_PUBLIC_IP"

# Check which keys are from environment vs storage
curl -s http://$VM_IP:3000/api/keys | jq '.source'
```

**Response shows**:
- `"environment"` - Key from environment variable
- `"storage"` - Key from encrypted storage
- `"none"` - Key not configured

---

### 20. Validate Azure OpenAI Environment

```bash
VM_IP="YOUR_VM_PUBLIC_IP"
AZURE_KEY="your-azure-key"
AZURE_ENDPOINT="https://your-resource.openai.azure.com"

curl -X POST http://$VM_IP:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$AZURE_KEY\",
    \"endpoint\": \"$AZURE_ENDPOINT\",
    \"deploymentName\": \"gpt-4o-mini\"
  }" | jq '.'
```

---

## 📊 Complete Validation Script for Remote VM

Save this as `validate-remote-vm.sh`:

```bash
#!/bin/bash
# Remote VM Validation Script for Secure AI Chat v1.0.11

if [ -z "$1" ]; then
  echo "Usage: $0 <VM_PUBLIC_IP>"
  echo "Example: $0 203.0.113.45"
  exit 1
fi

VM_IP="$1"
PORT="${2:-3000}"
BASE_URL="http://$VM_IP:$PORT"

echo "=========================================="
echo "Remote VM Validation - v1.0.11"
echo "VM IP: $VM_IP"
echo "Port: $PORT"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

# Test function
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected="$3"
  
  echo -n "Testing $name... "
  response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ]; then
    if [ -n "$expected" ]; then
      if echo "$body" | grep -q "$expected"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASS++))
        return 0
      else
        echo -e "${YELLOW}⚠️  WARN (unexpected response)${NC}"
        ((FAIL++))
        return 1
      fi
    else
      echo -e "${GREEN}✅ PASS${NC}"
      ((PASS++))
      return 0
    fi
  else
    echo -e "${RED}❌ FAIL (HTTP $http_code)${NC}"
    ((FAIL++))
    return 1
  fi
}

# 1. Health Check
test_endpoint "Health" "$BASE_URL/api/health" "ok"

# 2. Version Check
test_endpoint "Version" "$BASE_URL/api/version" "1.0.11"

# 3. WAF Health
test_endpoint "WAF Health" "$BASE_URL/api/waf/health" "integrated"

# 4. API Keys Status
test_endpoint "API Keys" "$BASE_URL/api/keys" "configured"

# 5. Settings Status
test_endpoint "Settings" "$BASE_URL/api/settings/status" "status"

# 6. Cache Health
test_endpoint "Cache Health" "$BASE_URL/api/health/cache" "status"

# 7. System Logs
test_endpoint "System Logs" "$BASE_URL/api/logs/system?limit=1" ""

# 8. WAF Logs
test_endpoint "WAF Logs" "$BASE_URL/api/waf/logs?limit=1" "success"

# 9. Release Notes
test_endpoint "Release Notes" "$BASE_URL/api/release-notes" "releaseNotes"

# 10. Files List
test_endpoint "Files List" "$BASE_URL/api/files/list" ""

echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All endpoints accessible!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some endpoints failed. Check firewall/security groups.${NC}"
  exit 1
fi
```

**Usage**:
```bash
chmod +x validate-remote-vm.sh
./validate-remote-vm.sh YOUR_VM_PUBLIC_IP
```

---

## 🔥 Quick Diagnostic One-Liner

```bash
VM_IP="YOUR_VM_PUBLIC_IP" && \
echo "Health: $(curl -s http://$VM_IP:3000/api/health | jq -r '.status')" && \
echo "Version: $(curl -s http://$VM_IP:3000/api/version | jq -r '.version')" && \
echo "WAF: $(curl -s http://$VM_IP:3000/api/waf/health | jq -r '.waf.integrated')" && \
echo "Errors (last 5): $(curl -s "http://$VM_IP:3000/api/logs/system?level=error&limit=5" | jq 'length')"
```

---

## 🛡️ Firewall & Security Group Configuration

### Required Ports
- **Port 3000**: HTTP access to application
- **Port 443**: HTTPS (if using SSL/TLS)

### Security Group Rules (Example for AWS/Azure/GCP)
```
Inbound Rules:
- Port 3000: TCP from 0.0.0.0/0 (or specific IPs)
- Port 443: TCP from 0.0.0.0/0 (if using HTTPS)
```

### Test Port Accessibility
```bash
# From remote machine
telnet YOUR_VM_PUBLIC_IP 3000
# or
nc -zv YOUR_VM_PUBLIC_IP 3000
```

---

## 📋 Complete Remote Validation Checklist

### Basic Connectivity
- [ ] Server responds: `curl http://VM_IP:3000/api/health`
- [ ] Version correct: Returns `1.0.11`
- [ ] WAF integrated: `waf.integrated: true`

### Configuration
- [ ] API keys status: Check `/api/keys`
- [ ] Settings status: Check `/api/settings/status`
- [ ] Cache status: Check `/api/health/cache`

### Logs & Diagnostics
- [ ] System logs accessible: `/api/logs/system`
- [ ] WAF logs accessible: `/api/waf/logs`
- [ ] Error logs: Filter by `level=error`

### Features
- [ ] Chat endpoint: `/api/chat` (may require keys)
- [ ] Files endpoint: `/api/files/list`
- [ ] Release notes: `/api/release-notes`

---

## 🚀 Quick Start Commands

### Set VM IP Variable
```bash
export VM_IP="YOUR_VM_PUBLIC_IP"
```

### Run All Checks
```bash
# Health
curl http://$VM_IP:3000/api/health

# Version
curl http://$VM_IP:3000/api/version

# WAF
curl http://$VM_IP:3000/api/waf/health

# Keys
curl http://$VM_IP:3000/api/keys

# Recent Errors
curl "http://$VM_IP:3000/api/logs/system?level=error&limit=10"
```

---

## 📝 Generate Logs Export

### Export All Logs
```bash
VM_IP="YOUR_VM_PUBLIC_IP"

# Export system logs as JSON
curl -s "http://$VM_IP:3000/api/logs/system?limit=1000" > system-logs.json

# Export WAF logs as CSV
curl -s -X POST "http://$VM_IP:3000/api/waf/logs" \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","limit":1000}' > waf-logs.csv

# Export diagnostic report
curl -s http://$VM_IP:3000/api/waf/health > waf-health.json
curl -s http://$VM_IP:3000/api/keys > api-keys.json
```

---

## 🔧 Troubleshooting Common Issues

### Issue: Connection Refused
```bash
# Check if port is open
curl -v http://YOUR_VM_PUBLIC_IP:3000/api/health

# Check firewall
# On VM: sudo ufw status
# On VM: sudo iptables -L
```

### Issue: Timeout
```bash
# Increase timeout
curl --connect-timeout 10 --max-time 30 \
  http://YOUR_VM_PUBLIC_IP:3000/api/health
```

### Issue: SSL/HTTPS Required
```bash
# Use HTTPS if configured
curl https://YOUR_VM_PUBLIC_IP:3000/api/health

# Skip SSL verification (testing only)
curl -k https://YOUR_VM_PUBLIC_IP:3000/api/health
```

---

## 📊 Example: Complete Remote Validation

```bash
#!/bin/bash
VM_IP="203.0.113.45"  # Replace with your VM IP

echo "=== Remote VM Validation ==="
echo "VM IP: $VM_IP"
echo ""

# Health
echo "1. Health Check:"
curl -s http://$VM_IP:3000/api/health | jq '.status'
echo ""

# Version
echo "2. Version:"
curl -s http://$VM_IP:3000/api/version | jq '.version'
echo ""

# WAF
echo "3. WAF Status:"
curl -s http://$VM_IP:3000/api/waf/health | jq '.waf.integrated'
echo ""

# Errors
echo "4. Recent Errors:"
curl -s "http://$VM_IP:3000/api/logs/system?level=error&limit=5" | \
  jq '.[] | {timestamp, service, message}'
echo ""

# Configuration
echo "5. API Keys Status:"
curl -s http://$VM_IP:3000/api/keys | jq '.configured'
echo ""

echo "✅ Validation Complete"
```

---

**Guide Version**: 1.0.11  
**Last Updated**: January 16, 2026
