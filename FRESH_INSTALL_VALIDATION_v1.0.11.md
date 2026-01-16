# Fresh Install Validation Guide - Version 1.0.11

**Version**: 1.0.11  
**Date**: January 16, 2026  
**Purpose**: Comprehensive validation checklist for fresh installation

---

## 📋 Pre-Installation Checklist

### System Requirements
- [ ] Node.js 25.2.1 installed (check with `node -v`)
- [ ] npm installed (check with `npm -v`)
- [ ] Git installed (check with `git --version`)
- [ ] At least 500MB free disk space
- [ ] Port 3000 available (or configure different port)

### Prerequisites
- [ ] Internet connection for npm install
- [ ] GitHub access (if cloning from repository)
- [ ] API keys ready (OpenAI, Azure OpenAI, Lakera AI, etc.)

---

## 🚀 Installation Steps

### Step 1: Clone Repository
```bash
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
```

### Step 2: Checkout Release Tag
```bash
git checkout v1.0.11
```

### Step 3: Install Dependencies
```bash
npm install
```

**Expected Output**: Should complete without errors

### Step 4: Verify Installation
```bash
# Check Node version
npm run check:node

# Run type check
npm run type-check

# Run linting
npm run lint
```

**Expected Results**:
- ✅ Node version check: Should show Node 25.2.1 (or warning if different)
- ✅ Type check: Should complete with no errors
- ✅ Lint: Should pass (warnings are acceptable)

### Step 5: Build Application
```bash
npm run build
```

**Expected Output**: 
```
✓ Compiled successfully
```

**Validation**: Check that all routes are listed and compiled

---

## ✅ Post-Installation Validation

### 1. Server Startup Validation

```bash
npm start
```

**Expected**: Server starts without errors

**Validation Commands**:
```bash
# Wait 5 seconds, then test health endpoint
sleep 5 && curl http://localhost:3000/api/health
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

**Status**: ✅ PASS if status is "ok"

---

### 2. Version Validation

```bash
curl http://localhost:3000/api/version
```

**Expected Response**:
```json
{
  "version": "1.0.11",
  "name": "secure-ai-chat"
}
```

**Status**: ✅ PASS if version is "1.0.11"

---

### 3. Core API Endpoints Validation

#### Health Endpoints
```bash
# General health
curl http://localhost:3000/api/health

# Cache health
curl http://localhost:3000/api/health/cache

# OpenAI health (requires API key)
curl http://localhost:3000/api/health/openai

# Azure OpenAI health (requires credentials)
curl -X POST http://localhost:3000/api/health/azure-openai \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"test","endpoint":"https://test.openai.azure.com"}'
```

**Expected**: All endpoints respond (some may require configuration)

---

### 4. Check Point WAF Endpoints Validation

#### WAF Health Check
```bash
curl http://localhost:3000/api/waf/health
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
    "threats": 0,
    "errors": 0,
    "warnings": 0
  },
  "recentActivity": [],
  "timestamp": "..."
}
```

**Status**: ✅ PASS if `waf.integrated` is `true`

#### WAF Logs Endpoint
```bash
# GET logs
curl http://localhost:3000/api/waf/logs?limit=10

# POST export (JSON)
curl -X POST http://localhost:3000/api/waf/logs \
  -H "Content-Type: application/json" \
  -d '{"format":"json","limit":10}'
```

**Expected**: Should return logs structure (may be empty for fresh install)

**Status**: ✅ PASS if endpoint responds with valid JSON

---

### 5. UI Validation

#### Access Main Pages
Open browser and navigate to:
- [ ] `http://localhost:3000` - Main chat page
- [ ] `http://localhost:3000/settings` - Settings page
- [ ] `http://localhost:3000/files` - Files page
- [ ] `http://localhost:3000/dashboard` - Dashboard
- [ ] `http://localhost:3000/release-notes` - Release notes

**Expected**: All pages load without errors

**Status**: ✅ PASS if all pages load

---

### 6. Settings Page Validation

#### Navigate to Settings
1. Open `http://localhost:3000/settings`
2. Verify layout:
   - [ ] Two-column layout visible (on larger screens)
   - [ ] Left column: API Keys section
   - [ ] Right column: Security & Settings section
   - [ ] Verification PIN section at bottom

#### Test API Key Fields
- [ ] OpenAI API Key field visible
- [ ] Azure OpenAI API Key field visible
- [ ] Azure OpenAI Endpoint field visible
- [ ] Lakera AI Key field visible
- [ ] Check Point TE Key field visible

**Status**: ✅ PASS if all fields visible

---

### 7. Azure OpenAI Validation Feature

#### Test Validation Endpoint
1. In Settings page, enter:
   - Azure OpenAI API Key: `test-key-1234567890`
   - Azure OpenAI Endpoint: `https://test.openai.azure.com`
2. Click "🔍 Validate Azure OpenAI Credentials" button
3. Verify:
   - [ ] Button appears when both fields have values
   - [ ] Button shows "Validating..." when clicked
   - [ ] Error message appears (expected for test credentials)
   - [ ] Error message is helpful and specific

**Status**: ✅ PASS if validation button works and shows feedback

---

### 8. Chat Interface Validation

#### Access Chat Page
1. Navigate to `http://localhost:3000`
2. Verify:
   - [ ] Chat interface loads
   - [ ] Message input area visible
   - [ ] Initial welcome message displayed

#### Provider Selector (Without Keys)
- [ ] Provider selector visible (even without keys)
- [ ] Shows "OpenAI" and "Azure OpenAI" options
- [ ] Options show "(Not configured)" if keys missing
- [ ] Warning message appears if no keys configured

**Status**: ✅ PASS if UI is accessible even without keys

---

### 9. Provider Switching Validation

#### Test Provider Selector
1. If you have OpenAI key configured:
   - [ ] Select "OpenAI" provider
   - [ ] Model selector shows OpenAI models
   - [ ] Can send messages (if key valid)

2. If you have Azure OpenAI configured:
   - [ ] Select "Azure OpenAI" provider
   - [ ] Model selector shows Azure-compatible models
   - [ ] gpt-4o-mini is selected automatically
   - [ ] Can send messages (if credentials valid)

**Status**: ✅ PASS if provider switching works

---

### 10. API Keys Management Validation

#### Test Key Storage
1. Go to Settings page
2. Paste an API key (use test key for validation)
3. Click "Save Keys"
4. Verify:
   - [ ] Success message appears
   - [ ] Key field is cleared (security)
   - [ ] Status indicator shows "configured"

#### Test Key Retrieval
```bash
curl http://localhost:3000/api/keys
```

**Expected Response**:
```json
{
  "configured": {
    "openAiKey": true/false,
    "azureOpenAiKey": true/false,
    "azureOpenAiEndpoint": true/false,
    ...
  },
  "source": {
    "openAiKey": "storage|environment|none",
    ...
  }
}
```

**Status**: ✅ PASS if endpoint returns key status

---

### 11. File Management Validation

#### Test File Upload
1. Navigate to Files page
2. Upload a test file (TXT, CSV, or JSON)
3. Verify:
   - [ ] File appears in list
   - [ ] File metadata displayed
   - [ ] Upload progress shown

#### Test File Deletion
1. Click remove button on a file
2. Verify:
   - [ ] File removed from list
   - [ ] UI refreshes correctly

#### Test Clear All Files
1. Click "Clear All Files" button
2. Verify:
   - [ ] All files removed
   - [ ] List is empty
   - [ ] Confirmation message shown

**Status**: ✅ PASS if all file operations work

---

### 12. RAG Functionality Validation

#### Test RAG with Files
1. Upload a CSV or JSON file
2. Go to Chat page
3. Ask a question about the file content
4. Verify:
   - [ ] Chat includes file context
   - [ ] Response references file data
   - [ ] File content is used in response

**Status**: ✅ PASS if RAG works with uploaded files

---

### 13. Error Handling Validation

#### Test Invalid Azure OpenAI Credentials
1. Configure invalid Azure OpenAI credentials
2. Try to send a message with Azure provider selected
3. Verify:
   - [ ] Error message appears
   - [ ] Error message is helpful
   - [ ] Suggests switching to OpenAI (if configured)
   - [ ] Chat page remains accessible

**Status**: ✅ PASS if errors are handled gracefully

---

### 14. Middleware Validation

#### Test WAF Middleware
1. Make any API request:
```bash
curl http://localhost:3000/api/health
```

2. Check server logs for middleware activity:
   - [ ] Request metadata captured
   - [ ] WAF headers processed (if present)
   - [ ] No middleware errors

**Status**: ✅ PASS if middleware runs without errors

---

## 🔍 Comprehensive Validation Script

Create and run this validation script:

```bash
#!/bin/bash
# validation-script.sh

echo "=== Fresh Install Validation for v1.0.11 ==="
echo ""

# Check Node version
echo "1. Checking Node version..."
node -v
npm run check:node
echo ""

# Check installation
echo "2. Checking installation..."
if [ ! -d "node_modules" ]; then
  echo "❌ node_modules not found. Run 'npm install'"
  exit 1
fi
echo "✅ node_modules found"
echo ""

# Type check
echo "3. Running type check..."
npm run type-check
if [ $? -eq 0 ]; then
  echo "✅ Type check passed"
else
  echo "❌ Type check failed"
  exit 1
fi
echo ""

# Build
echo "4. Building application..."
npm run build
if [ $? -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed"
  exit 1
fi
echo ""

# Start server in background
echo "5. Starting server..."
npm start &
SERVER_PID=$!
sleep 8
echo ""

# Health check
echo "6. Testing health endpoint..."
HEALTH=$(curl -s http://localhost:3000/api/health | jq -r '.status' 2>/dev/null)
if [ "$HEALTH" = "ok" ]; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed: $HEALTH"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# Version check
echo "7. Testing version endpoint..."
VERSION=$(curl -s http://localhost:3000/api/version | jq -r '.version' 2>/dev/null)
if [ "$VERSION" = "1.0.11" ]; then
  echo "✅ Version check passed: $VERSION"
else
  echo "❌ Version check failed: Expected 1.0.11, got $VERSION"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# WAF health check
echo "8. Testing WAF health endpoint..."
WAF_STATUS=$(curl -s http://localhost:3000/api/waf/health | jq -r '.waf.integrated' 2>/dev/null)
if [ "$WAF_STATUS" = "true" ]; then
  echo "✅ WAF integration check passed"
else
  echo "❌ WAF integration check failed"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# Keys endpoint
echo "9. Testing keys endpoint..."
KEYS_RESPONSE=$(curl -s http://localhost:3000/api/keys)
if echo "$KEYS_RESPONSE" | jq . >/dev/null 2>&1; then
  echo "✅ Keys endpoint working"
else
  echo "❌ Keys endpoint failed"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo ""

# Cleanup
echo "10. Stopping server..."
kill $SERVER_PID 2>/dev/null
sleep 2

echo ""
echo "=== Validation Complete ==="
echo "✅ All checks passed!"
```

**Save as**: `scripts/validate-fresh-install.sh`  
**Make executable**: `chmod +x scripts/validate-fresh-install.sh`  
**Run**: `./scripts/validate-fresh-install.sh`

---

## 📊 Validation Checklist Summary

### Installation Validation
- [ ] Repository cloned successfully
- [ ] Release tag v1.0.11 checked out
- [ ] Dependencies installed (`npm install`)
- [ ] Type check passed
- [ ] Lint check passed
- [ ] Build successful

### Server Validation
- [ ] Server starts without errors
- [ ] Health endpoint responds (`/api/health`)
- [ ] Version endpoint returns 1.0.11 (`/api/version`)
- [ ] All core endpoints accessible

### Feature Validation
- [ ] Settings page loads with two-column layout
- [ ] Azure OpenAI fields visible and functional
- [ ] Validation button works for Azure OpenAI
- [ ] Provider selector visible on chat page
- [ ] Model selector updates based on provider
- [ ] File upload works (up to 10 files)
- [ ] File deletion works
- [ ] Clear all files works
- [ ] RAG functionality works

### Integration Validation
- [ ] Check Point WAF health endpoint works
- [ ] Check Point WAF logs endpoint works
- [ ] Middleware captures requests
- [ ] Azure OpenAI validation endpoint works
- [ ] API keys management works

### Error Handling Validation
- [ ] Invalid keys show helpful errors
- [ ] Chat page accessible with one provider
- [ ] Provider switching works
- [ ] Network errors handled gracefully

---

## 🐛 Troubleshooting

### Issue: Build Fails
**Check**:
- Node version: `node -v` (should be 25.2.1)
- Dependencies: `npm install` completed successfully
- Disk space: Enough free space

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Server Won't Start
**Check**:
- Port 3000 available: `lsof -i :3000`
- Previous process: Kill any existing Node processes

**Solution**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm start
```

### Issue: Endpoints Not Responding
**Check**:
- Server is running: `curl http://localhost:3000/api/health`
- Firewall settings
- Network connectivity

**Solution**:
- Check server logs for errors
- Verify server started successfully
- Check if port is accessible

### Issue: Azure OpenAI Validation Fails
**Check**:
- Endpoint URL format (must start with http:// or https://)
- API key length (minimum 10 characters)
- Network connectivity to Azure

**Solution**:
- Verify endpoint URL in Azure Portal
- Check API key is correct
- Test endpoint URL in browser (should show Azure OpenAI page)

### Issue: WAF Endpoints Not Working
**Check**:
- Middleware file exists: `middleware.ts`
- Server logs show middleware running
- No Edge Runtime errors

**Solution**:
- Verify middleware.ts is in root directory
- Check Next.js configuration
- Review server logs for errors

---

## ✅ Success Criteria

A fresh install is **VALIDATED** if:

1. ✅ **Installation**: All dependencies installed, build successful
2. ✅ **Server**: Starts without errors, health endpoint responds
3. ✅ **Version**: Returns 1.0.11 correctly
4. ✅ **Endpoints**: All core endpoints accessible
5. ✅ **UI**: All pages load without errors
6. ✅ **Features**: Key features functional (provider switching, file upload, etc.)
7. ✅ **Integrations**: WAF and Azure OpenAI endpoints working
8. ✅ **Error Handling**: Graceful error handling demonstrated

---

## 📝 Validation Report Template

After validation, create a report:

```markdown
# Fresh Install Validation Report

**Date**: [Date]
**Version**: 1.0.11
**Environment**: [Production/Staging/Development]

## Installation
- [ ] Repository cloned
- [ ] Tag v1.0.11 checked out
- [ ] Dependencies installed
- [ ] Build successful

## Server Validation
- [ ] Server starts
- [ ] Health endpoint: [OK/FAIL]
- [ ] Version endpoint: [1.0.11/OTHER]
- [ ] WAF health: [OK/FAIL]

## Feature Validation
- [ ] Settings page: [OK/FAIL]
- [ ] Chat page: [OK/FAIL]
- [ ] Provider switching: [OK/FAIL]
- [ ] File upload: [OK/FAIL]
- [ ] Azure validation: [OK/FAIL]

## Issues Found
[List any issues]

## Overall Status
[PASS/FAIL]
```

---

## 🎯 Quick Validation Commands

Run these commands for quick validation:

```bash
# 1. Install and build
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
git checkout v1.0.11
npm install
npm run build

# 2. Start server
npm start &

# 3. Wait and test
sleep 8
curl http://localhost:3000/api/health
curl http://localhost:3000/api/version
curl http://localhost:3000/api/waf/health

# 4. Expected results
# - Health: {"status":"ok"}
# - Version: {"version":"1.0.11"}
# - WAF: {"waf":{"integrated":true}}
```

---

**Validation Guide Version**: 1.0.11  
**Last Updated**: January 16, 2026
