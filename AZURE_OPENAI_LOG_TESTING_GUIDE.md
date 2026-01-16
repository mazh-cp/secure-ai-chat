# Azure OpenAI Log Testing Guide

This guide explains how to generate and analyze logs for testing Azure OpenAI API key and endpoint errors.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Log Sources](#log-sources)
3. [Testing Scenarios](#testing-scenarios)
4. [Viewing Logs](#viewing-logs)
5. [Error Analysis](#error-analysis)
6. [Automated Testing](#automated-testing)

## Quick Start

### 1. Test Validation Endpoint

```bash
# Test with invalid API key
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "invalid-key-123",
    "endpoint": "https://test.openai.azure.com",
    "deploymentName": "gpt-4o-mini"
  }'
```

### 2. Test Chat Endpoint

```bash
# Test chat with invalid credentials
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "gpt-4o-mini",
    "provider": "azure",
    "apiKeys": {
      "azureOpenAiKey": "invalid-key",
      "azureOpenAiEndpoint": "https://test.openai.azure.com"
    }
  }'
```

### 3. Run Automated Test Script

```bash
# Make script executable
chmod +x scripts/test-azure-openai-errors.sh

# Run tests
./scripts/test-azure-openai-errors.sh

# Or with custom base URL
BASE_URL=http://your-server:3000 ./scripts/test-azure-openai-errors.sh
```

## Log Sources

### 1. Server Console Logs

**Location:** Console output where the Next.js server is running

**What to look for:**
- `console.log('Azure OpenAI request:', ...)` - Request details
- `console.error('Azure OpenAI fetch error:', ...)` - Network/connection errors
- Error stack traces

**How to view:**
```bash
# If running manually
npm start  # View console output

# If using systemd
sudo journalctl -u secure-ai-chat -f
```

### 2. Browser Console Logs

**Location:** Browser Developer Tools (F12 → Console)

**What to look for:**
- Network request errors
- API response errors
- Client-side error messages

**How to view:**
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for red error messages
4. Check Network tab for failed requests

### 3. API Response Logs

**Location:** API endpoint responses

**Endpoints:**
- `/api/health/azure-openai` - Validation endpoint
- `/api/chat` - Chat endpoint

**What to look for:**
- `ok: false` - Validation failed
- `error: "..."` - Error message
- HTTP status codes (400, 401, 404, 500, etc.)

### 4. System Logs (systemd)

**Location:** System journal

**How to view:**
```bash
# View all logs
sudo journalctl -u secure-ai-chat

# Follow logs in real-time
sudo journalctl -u secure-ai-chat -f

# View last 100 lines
sudo journalctl -u secure-ai-chat -n 100

# Filter for Azure OpenAI errors
sudo journalctl -u secure-ai-chat | grep -i "azure"
```

## Testing Scenarios

### Scenario 1: Invalid API Key

**Test:**
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "invalid-key-123",
    "endpoint": "https://your-resource.openai.azure.com"
  }'
```

**Expected Error:**
- HTTP 401 (Unauthorized)
- Error: "Azure OpenAI authentication failed"

**Logs to Check:**
- Server console: `console.error('Azure OpenAI fetch error:', ...)`
- API response: `{ ok: false, error: "..." }`

### Scenario 2: Invalid Endpoint URL

**Test:**
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "valid-key-123456789012345678901234567890",
    "endpoint": "not-a-valid-url"
  }'
```

**Expected Error:**
- HTTP 400 (Bad Request)
- Error: "Invalid endpoint URL. Must start with http:// or https://"

**Logs to Check:**
- API response validation error

### Scenario 3: Wrong Endpoint (Not Azure OpenAI)

**Test:**
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "valid-key-123456789012345678901234567890",
    "endpoint": "https://api.openai.com"
  }'
```

**Expected Error:**
- HTTP 500 or network error
- Error: "Cannot connect to Azure OpenAI endpoint"

**Logs to Check:**
- Server console: Network connection errors
- API response: Connection failed message

### Scenario 4: Deployment Not Found

**Test:**
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_VALID_KEY",
    "endpoint": "https://your-resource.openai.azure.com",
    "deploymentName": "non-existent-deployment"
  }'
```

**Expected Error:**
- HTTP 404 (Not Found)
- Error: "Deployment 'non-existent-deployment' not found"

**Logs to Check:**
- API response: Deployment not found error
- Available deployments list (if provided)

### Scenario 5: Deployment Unavailable

**Test:**
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_VALID_KEY",
    "endpoint": "https://your-resource.openai.azure.com",
    "deploymentName": "gpt-4o-mini"
  }'
```

**Expected Error (if deployment unavailable):**
- HTTP 503 (Service Unavailable)
- Error: "Deployment is unavailable. Possible causes: 1) Deployment name doesn't match exactly..."

**Logs to Check:**
- API response: Deployment unavailable message
- Server console: "No Suitable backend" errors

### Scenario 6: Network Timeout

**Test:**
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "valid-key-123456789012345678901234567890",
    "endpoint": "https://192.168.255.255:443"
  }'
```

**Expected Error:**
- HTTP 408 (Request Timeout)
- Error: "Request timeout. Please check your endpoint URL and network connection."

**Logs to Check:**
- Server console: Timeout errors
- API response: Timeout message

### Scenario 7: DNS Resolution Failure

**Test:**
```bash
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "valid-key-123456789012345678901234567890",
    "endpoint": "https://this-domain-does-not-exist-12345.azure.com"
  }'
```

**Expected Error:**
- HTTP 500 (Internal Server Error)
- Error: "Cannot connect to Azure OpenAI endpoint. Please verify: 1) Endpoint URL..."

**Logs to Check:**
- Server console: DNS resolution errors
- API response: Network error message

## Viewing Logs

### Method 1: Server Console (Manual)

If running `npm start` manually:
```bash
cd /path/to/secure-ai-chat
npm start
# Watch console output for errors
```

### Method 2: Systemd Journal

If using systemd service:
```bash
# Real-time logs
sudo journalctl -u secure-ai-chat -f

# Last 50 lines
sudo journalctl -u secure-ai-chat -n 50

# Filter for Azure OpenAI
sudo journalctl -u secure-ai-chat | grep -i "azure"

# Filter for errors only
sudo journalctl -u secure-ai-chat -p err
```

### Method 3: Browser Developer Tools

1. Open application in browser
2. Press F12 to open Developer Tools
3. Go to **Console** tab for client-side errors
4. Go to **Network** tab for API requests/responses
5. Filter by "azure" or "openai"

### Method 4: API Response Logs

Save API responses to files:
```bash
# Test validation endpoint
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "test-key",
    "endpoint": "https://test.openai.azure.com"
  }' | jq . > validation-test.json

# View response
cat validation-test.json
```

## Error Analysis

### Common Error Patterns

#### 1. Authentication Errors (401)

**Symptoms:**
- HTTP 401 status
- Error: "Azure OpenAI authentication failed"

**Causes:**
- Invalid API key
- API key expired
- Wrong API key for endpoint

**Logs to Check:**
```bash
# Server logs
sudo journalctl -u secure-ai-chat | grep -i "401\|auth"

# API response
curl ... | jq '.error'
```

#### 2. Deployment Not Found (404)

**Symptoms:**
- HTTP 404 status
- Error: "Deployment 'X' not found"

**Causes:**
- Deployment name doesn't match (case-sensitive)
- Deployment doesn't exist
- Wrong resource/endpoint

**Logs to Check:**
```bash
# Check available deployments
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_KEY",
    "endpoint": "YOUR_ENDPOINT"
  }' | jq '.availableDeployments'
```

#### 3. Network Errors (500/408)

**Symptoms:**
- HTTP 500 or 408 status
- Error: "Cannot connect to Azure OpenAI endpoint"

**Causes:**
- DNS resolution failure
- Network connectivity issues
- Firewall blocking connection
- Endpoint URL incorrect

**Logs to Check:**
```bash
# Server console for network errors
sudo journalctl -u secure-ai-chat | grep -i "fetch\|network\|timeout"

# Test DNS resolution
nslookup your-resource.openai.azure.com

# Test connectivity
curl -v https://your-resource.openai.azure.com
```

#### 4. Deployment Unavailable (503)

**Symptoms:**
- HTTP 503 status
- Error: "No Suitable backend was found"

**Causes:**
- Deployment not in "Succeeded" state
- Model capacity exhausted
- Deployment throttled

**Logs to Check:**
```bash
# Check deployment status in Azure Portal
# Or test with different deployment name
```

## Automated Testing

### Using the Test Script

The `scripts/test-azure-openai-errors.sh` script automatically tests multiple error scenarios:

```bash
# Basic usage
./scripts/test-azure-openai-errors.sh

# With custom base URL
BASE_URL=http://your-server:3000 ./scripts/test-azure-openai-errors.sh

# With real credentials (for realistic tests)
export AZURE_OPENAI_KEY="your-key"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
./scripts/test-azure-openai-errors.sh
```

### Test Output

The script generates:
- Individual test logs in `./azure-openai-test-logs/`
- Summary report: `./azure-openai-test-logs/summary_TIMESTAMP.md`
- JSON responses for each test

### Reviewing Test Results

```bash
# View summary
cat ./azure-openai-test-logs/summary_*.md

# View specific test
cat ./azure-openai-test-logs/invalid_key_*.json | jq .

# List all tests
ls -lh ./azure-openai-test-logs/
```

## Best Practices

1. **Test in Isolation:** Test one error scenario at a time
2. **Use Real Credentials Sparingly:** Only use real credentials for final validation
3. **Check Multiple Log Sources:** Server logs, browser console, API responses
4. **Save Test Results:** Keep logs for comparison and debugging
5. **Test Edge Cases:** Invalid formats, missing fields, network issues

## Troubleshooting

### Logs Not Appearing

1. **Check service status:**
   ```bash
   sudo systemctl status secure-ai-chat
   ```

2. **Check log level:**
   - Ensure `console.log` and `console.error` are not filtered
   - Check Next.js log level settings

3. **Check file permissions:**
   ```bash
   ls -la /path/to/secure-ai-chat/.next/
   ```

### Logs Too Verbose

Filter logs:
```bash
# Only errors
sudo journalctl -u secure-ai-chat -p err

# Only Azure OpenAI related
sudo journalctl -u secure-ai-chat | grep -i "azure"

# Last 20 lines
sudo journalctl -u secure-ai-chat -n 20
```

## Additional Resources

- [Azure OpenAI API Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Error Handling Guide](./AZURE_CONNECTION_FIX_v1.0.11.md)
- [Validation Endpoint Documentation](./USER_GUIDE.md#azure-openai-health-check)
