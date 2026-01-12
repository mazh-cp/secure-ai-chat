# Production Verification Guide - v1.0.7

This guide provides comprehensive steps to verify that your production server has all required updates for version 1.0.7.

## 🎯 Quick Verification

### Automated Verification Script (Recommended)

The easiest way to verify all updates is using the automated script:

```bash
# Download and run verification script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/verify-production-update.sh | bash

# Or if you have the repository cloned:
cd /home/adminuser/secure-ai-chat
bash scripts/verify-production-update.sh
```

**Custom Configuration:**
```bash
# Custom repository directory
REPO_DIR=/custom/path bash scripts/verify-production-update.sh

# Custom service name
SERVICE_NAME=my-secure-chat bash scripts/verify-production-update.sh
```

## 📋 Manual Verification Steps

If you prefer to verify manually, follow these steps:

### Step 1: Check Repository Status

```bash
cd /home/adminuser/secure-ai-chat

# Check current branch
git branch --show-current

# Check if up to date with remote
git fetch origin
git status

# Check current commit
git rev-parse HEAD
git log -1 --oneline
```

**Expected Result:**
- Branch should be `main`
- Should be up to date with `origin/main`
- Latest commit should include "Fix: Checkpoint TE key update and Model Selector issues"

### Step 2: Check Package Version

```bash
# Check package.json version
grep '"version"' package.json

# Check API version endpoint
curl http://localhost:3000/api/version
```

**Expected Result:**
- `package.json` should show version `"1.0.7"`
- API should return: `{"version":"1.0.7",...}`

### Step 3: Check Service Status

```bash
# Check if service is running
sudo systemctl status secure-ai-chat

# Check service logs for errors
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

**Expected Result:**
- Service should be `active (running)`
- No critical errors in logs

### Step 4: Check API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Version check
curl http://localhost:3000/api/version

# Models endpoint (should work without client-side key)
curl http://localhost:3000/api/models

# Checkpoint TE config endpoint
curl http://localhost:3000/api/te/config
```

**Expected Results:**
- Health endpoint: `{"status":"ok",...}`
- Version endpoint: `{"version":"1.0.7",...}`
- Models endpoint: Should return models if OpenAI key is configured
- TE config endpoint: Should return status (configured: true/false)

### Step 5: Check Key Features

#### Release Notes Page

```bash
# Check if page exists
ls -la app/release-notes/page.tsx

# Check if accessible
curl -I http://localhost:3000/release-notes
```

**Expected Result:**
- File should exist
- Should return HTTP 200

#### Model Selector Fix

```bash
# Check if ModelSelector has the fix
grep -A 5 "server-side storage" components/ModelSelector.tsx
```

**Expected Result:**
- Should find comment about server-side storage

#### Checkpoint TE Error Handling

```bash
# Check SettingsForm error handling
grep -A 3 "errorData.error" components/SettingsForm.tsx
```

**Expected Result:**
- Should find improved error handling code

### Step 6: Check Build Artifacts

```bash
# Check if .next directory exists
ls -la .next

# Check build timestamp
find .next -type f -name "*.js" -mtime -1 | head -5
```

**Expected Result:**
- `.next` directory should exist
- Build files should be recent (within last 24 hours if just upgraded)

### Step 7: Check Storage Directories

```bash
# Check secure storage
ls -ld .secure-storage
stat -c "%a" .secure-storage

# Check file storage
ls -ld .storage
```

**Expected Results:**
- `.secure-storage` should exist with permissions `700` or `750`
- `.storage` should exist (or will be created on first use)

### Step 8: Check Critical Files

```bash
# List critical files that should exist
ls -la app/api/models/route.ts
ls -la app/api/te/config/route.ts
ls -la app/release-notes/page.tsx
ls -la components/ModelSelector.tsx
ls -la components/SettingsForm.tsx
ls -la components/ChatInterface.tsx
```

**Expected Result:**
- All files should exist

### Step 9: Functional Testing

#### Test 1: Model Selector

1. Navigate to Chat page: `http://your-server-ip:3000`
2. Check if Model Selector appears
3. Should show available models (if OpenAI key is configured)
4. Should work even if you just changed the OpenAI key

**Expected Result:**
- Model selector should display models automatically
- No need to refresh page after key change

#### Test 2: Checkpoint TE Key Update

1. Navigate to Settings page: `http://your-server-ip:3000/settings`
2. Scroll to "Check Point ThreatCloud / Threat Emulation (TE) API Key" section
3. Paste a new key
4. Click "Save Check Point TE Key"
5. Should see success message or clear error message

**Expected Result:**
- Should save successfully or show clear error message
- Status indicator should update

#### Test 3: Release Notes Page

1. Navigate to: `http://your-server-ip:3000/release-notes`
2. Or click "Release Notes" in navigation sidebar
3. Or click "View Release Notes" in Settings page

**Expected Result:**
- Page should load with version history
- Should show v1.0.7 as latest version

## 🔍 Verification Checklist

Use this checklist to ensure all updates are in place:

- [ ] Repository is up to date with `origin/main`
- [ ] Package version is `1.0.7`
- [ ] API version endpoint returns `1.0.7`
- [ ] Service is running (`systemctl status secure-ai-chat`)
- [ ] Health endpoint responds (`/api/health`)
- [ ] Version endpoint responds (`/api/version`)
- [ ] Release Notes page exists (`app/release-notes/page.tsx`)
- [ ] Release Notes page is accessible (`/release-notes`)
- [ ] ModelSelector has server-side storage fix
- [ ] SettingsForm has improved error handling
- [ ] Build directory exists (`.next`)
- [ ] Build artifacts are recent
- [ ] Secure storage directory exists with correct permissions
- [ ] All critical files are present
- [ ] Model Selector works after key change
- [ ] Checkpoint TE key update works with error messages
- [ ] Release Notes page displays correctly

## 🚨 Troubleshooting

### Issue: Verification script shows failures

**Solution:**
1. Check which checks failed
2. Review the error messages
3. Run the upgrade script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/upgrade-production-v1.0.7.sh | sudo bash
   ```
4. Re-run verification script

### Issue: Service not running

**Solution:**
```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check logs
sudo journalctl -u secure-ai-chat -n 100 --no-pager

# Restart service
sudo systemctl restart secure-ai-chat
```

### Issue: API endpoints not responding

**Solution:**
```bash
# Check if service is running
sudo systemctl status secure-ai-chat

# Check if port 3000 is in use
sudo netstat -tlnp | grep 3000

# Check firewall
sudo ufw status

# Restart service
sudo systemctl restart secure-ai-chat
```

### Issue: Version mismatch

**Solution:**
```bash
# Pull latest changes
cd /home/adminuser/secure-ai-chat
git pull origin main

# Rebuild
npm ci --production=false
rm -rf .next
npm run build

# Restart service
sudo systemctl restart secure-ai-chat
```

## 📊 Verification Results

After running verification, you should see:

```
✅ Passed: 15+
⚠️  Warnings: 0-2 (acceptable)
❌ Failed: 0
```

If you have failures, review the error messages and follow the troubleshooting steps above.

## 🔄 Continuous Verification

You can add this verification to your monitoring:

```bash
# Add to cron for daily checks
0 2 * * * /home/adminuser/secure-ai-chat/scripts/verify-production-update.sh >> /var/log/secure-ai-chat-verification.log 2>&1
```

## 📞 Support

If verification continues to fail after following troubleshooting steps:

1. Check service logs: `sudo journalctl -u secure-ai-chat -f`
2. Review verification script output
3. Check network connectivity
4. Verify file permissions
5. Review upgrade script output

---

**Last Updated:** January 12, 2026  
**Version:** 1.0.7  
**Script:** `scripts/verify-production-update.sh`
