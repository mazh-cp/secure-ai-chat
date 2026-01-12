# Production Permissions Fix Guide

**Issue:** `EACCES: permission denied` when running npm install on production server

## 🐛 Problem

When running the clean reinstall script, you may encounter:

```
npm error code EACCES
npm error syscall open
npm error path /home/adminuser/secure-ai-chat/package-lock.json
npm error errno -13
npm error Error: EACCES: permission denied
```

This happens when:
- Files are owned by a different user
- Files don't have write permissions
- npm is running as wrong user

## ✅ Quick Fix

### Option 1: Run Permission Fix Script

```bash
# Download and run
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/fix-permissions.sh | sudo bash

# Or if you have the repository
cd /home/adminuser/secure-ai-chat
sudo bash scripts/fix-permissions.sh
```

### Option 2: Manual Fix

```bash
cd /home/adminuser/secure-ai-chat

# Fix ownership
sudo chown -R adminuser:adminuser .

# Fix permissions
sudo chmod -R u+w .
sudo chmod 644 package.json
sudo chmod 644 package-lock.json

# Then retry npm install
sudo -u adminuser npm install --production=false
```

## 🔧 Updated Clean Reinstall Script

The clean reinstall script has been updated to fix permissions **before** running npm install. It now:

1. Fixes ownership before install
2. Ensures write permissions
3. Runs npm as the correct user
4. Retries with permission fix if install fails

### Run Updated Script

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/clean-reinstall-production.sh | sudo bash
```

## 📋 Step-by-Step Fix

### Step 1: Identify the Issue

```bash
# Check current ownership
ls -la /home/adminuser/secure-ai-chat/package.json
ls -la /home/adminuser/secure-ai-chat/package-lock.json

# Check who owns the directory
stat -c '%U:%G' /home/adminuser/secure-ai-chat
```

### Step 2: Fix Ownership

```bash
cd /home/adminuser/secure-ai-chat

# Set ownership to service user
sudo chown -R adminuser:adminuser .
```

### Step 3: Fix Permissions

```bash
# Make files writable
sudo chmod -R u+w .

# Fix specific files
sudo chmod 644 package.json
sudo chmod 644 package-lock.json

# Fix .git directory
sudo chmod -R u+w .git
```

### Step 4: Run npm as Correct User

```bash
# Run npm install as the service user
sudo -u adminuser npm install --production=false

# Or if using nvm
sudo -u adminuser bash -c "source ~/.nvm/nvm.sh && nvm use 25.2.1 && npm install --production=false"
```

## 🔍 Common Permission Issues

### Issue 1: Files owned by root

**Symptoms:**
```
EACCES: permission denied, open 'package-lock.json'
```

**Fix:**
```bash
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat
```

### Issue 2: Directory not writable

**Symptoms:**
```
EACCES: permission denied, mkdir 'node_modules'
```

**Fix:**
```bash
sudo chmod -R u+w /home/adminuser/secure-ai-chat
```

### Issue 3: Running as wrong user

**Symptoms:**
```
npm error It is likely you do not have the permissions
```

**Fix:**
```bash
# Always run npm as the service user
sudo -u adminuser npm install --production=false
```

## 🚀 Complete Fix Procedure

If you're getting permission errors during clean reinstall:

```bash
# 1. Stop service
sudo systemctl stop secure-ai-chat

# 2. Fix permissions
cd /home/adminuser/secure-ai-chat
sudo chown -R adminuser:adminuser .
sudo chmod -R u+w .
sudo chmod 644 package.json package-lock.json 2>/dev/null || true

# 3. Run clean reinstall script (it will handle the rest)
sudo bash scripts/clean-reinstall-production.sh
```

## 📝 Prevention

To prevent permission issues:

1. **Always run scripts with sudo:**
   ```bash
   sudo bash scripts/clean-reinstall-production.sh
   ```

2. **Use service user for npm:**
   ```bash
   sudo -u adminuser npm install
   ```

3. **Check ownership before operations:**
   ```bash
   ls -la package.json
   ```

4. **Fix permissions proactively:**
   ```bash
   sudo bash scripts/fix-permissions.sh
   ```

## 🔗 Related Scripts

- `scripts/fix-permissions.sh` - Quick permission fix
- `scripts/clean-reinstall-production.sh` - Updated with permission fixes
- `PRODUCTION_CLEAN_REINSTALL.md` - Complete reinstall guide

---

**Last Updated:** January 12, 2026  
**Status:** ✅ Fixed in clean reinstall script
