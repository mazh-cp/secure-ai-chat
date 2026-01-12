# Production Clean Reinstall Guide

**Date:** January 12, 2026  
**Version:** 1.0.7  
**Purpose:** Complete clean reinstall to fix all issues based on current local build

## 🎯 Overview

This script performs a complete clean reinstall of the Secure AI Chat application on your production VM. It:

1. **Stops the service** safely
2. **Backs up all critical data** (API keys, uploaded files, environment variables)
3. **Performs complete cleanup** (removes node_modules, build cache, all caches)
4. **Pulls latest code** from GitHub
5. **Fresh installs** all dependencies
6. **Rebuilds** the application
7. **Restores backups** (API keys, files, environment)
8. **Fixes permissions**
9. **Restarts service**
10. **Verifies** installation

## 🚀 Quick Start

### Option 1: Direct Download and Run (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/clean-reinstall-production.sh | sudo bash
```

### Option 2: Download First, Then Run

```bash
# Download the script
wget https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/clean-reinstall-production.sh

# Make it executable
chmod +x clean-reinstall-production.sh

# Run it
sudo ./clean-reinstall-production.sh
```

### Option 3: If You Have Repository Cloned

```bash
cd /home/adminuser/secure-ai-chat
sudo bash scripts/clean-reinstall-production.sh
```

## 📋 What Gets Backed Up

The script automatically backs up:

- ✅ **`.secure-storage/`** - All encrypted API keys
- ✅ **`.storage/`** - All uploaded files and metadata
- ✅ **`.env`** - Environment variables (if exists)
- ✅ **`.env.local`** - Local environment variables (if exists)
- ✅ **Git commit hash** - Previous version reference

**Backup Location:** `/home/adminuser/secure-ai-chat-backup-YYYYMMDD_HHMMSS/`

## 🔧 Custom Configuration

You can customize the script behavior with environment variables:

```bash
# Custom repository directory
REPO_DIR=/custom/path sudo bash clean-reinstall-production.sh

# Custom branch
BRANCH=main sudo bash clean-reinstall-production.sh

# Custom service name
SERVICE_NAME=my-secure-chat sudo bash clean-reinstall-production.sh
```

## 📝 Step-by-Step Process

### Step 1: Stop Service
- Gracefully stops the systemd service
- Kills any stray Next.js processes
- Ensures clean shutdown

### Step 2: Backup Critical Data
- Creates backup directory with timestamp
- Copies all API keys (encrypted)
- Copies all uploaded files
- Backs up environment files
- Saves current git commit

### Step 3: Clean Installation
- Removes `node_modules/` completely
- Removes `.next/` build directory
- Removes `package-lock.json` (will be regenerated)
- Clears all caches (`.cache`, `node_modules/.cache`, `.turbo`)

### Step 4: Update from GitHub
- Fixes repository permissions
- Fetches latest changes
- Checks out target branch (default: `main`)
- Pulls latest code

### Step 5: Install Dependencies
- Sources Node.js (nvm) if available
- Verifies Node.js version
- Fresh `npm install` (no cache)
- Installs all dependencies

### Step 6: Build Application
- Runs `npm run build`
- Generates production build
- Creates all routes

### Step 7: Restore Backups
- Restores `.secure-storage/` (API keys)
- Restores `.storage/` (uploaded files)
- Restores `.env` files
- Fixes permissions on restored files

### Step 8: Fix Permissions
- Sets correct ownership (service user)
- Sets secure permissions (700 for .secure-storage)
- Ensures files are accessible

### Step 9: Restart Service
- Starts systemd service
- Waits for service to initialize
- Verifies service is running

### Step 10: Verify Installation
- Checks health endpoint
- Checks version endpoint
- Tests all pages
- Provides status summary

## ✅ What This Fixes

This clean reinstall fixes:

- ✅ **Stale build cache** - Complete cache clear
- ✅ **Corrupted node_modules** - Fresh install
- ✅ **Placeholder key issues** - Latest validation code
- ✅ **Webpack chunk errors** - Fresh build
- ✅ **Version mismatches** - Latest code from GitHub
- ✅ **Permission issues** - Proper ownership and permissions
- ✅ **Missing dependencies** - Complete reinstall
- ✅ **Outdated code** - Latest from main branch

## 🔍 Verification

After the script completes, verify:

1. **Service Status:**
   ```bash
   sudo systemctl status secure-ai-chat
   ```

2. **Health Check:**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Version Check:**
   ```bash
   curl http://localhost:3000/api/version
   ```
   Should return: `{"version":"1.0.7",...}`

4. **Test Pages:**
   - Home: `http://your-server-ip:3000/`
   - Release Notes: `http://your-server-ip:3000/release-notes`
   - Settings: `http://your-server-ip:3000/settings`

5. **Verify Keys:**
   - Go to Settings page
   - Verify API keys are still configured
   - Test chat functionality

## 🚨 Troubleshooting

### Issue: Script fails during dependency installation

**Solution:**
```bash
# Check Node.js version
node --version
# Should be v25.2.1

# If wrong version, use nvm
source ~/.nvm/nvm.sh
nvm use 25.2.1
nvm alias default 25.2.1

# Re-run script
sudo bash scripts/clean-reinstall-production.sh
```

### Issue: Service fails to start

**Solution:**
```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 50 --no-pager

# Check build
cd /home/adminuser/secure-ai-chat
ls -la .next

# If .next missing, rebuild
npm run build
sudo systemctl restart secure-ai-chat
```

### Issue: API keys missing after reinstall

**Solution:**
```bash
# Check backup
ls -la /home/adminuser/secure-ai-chat-backup-*/

# Restore manually if needed
cd /home/adminuser/secure-ai-chat
cp -r /home/adminuser/secure-ai-chat-backup-*/.secure-storage .secure-storage
sudo chmod -R 700 .secure-storage
sudo chown -R adminuser:adminuser .secure-storage
sudo systemctl restart secure-ai-chat
```

### Issue: Permissions errors

**Solution:**
```bash
cd /home/adminuser/secure-ai-chat
sudo chown -R adminuser:adminuser .
sudo chmod -R 700 .secure-storage
sudo chmod -R 755 .storage
sudo systemctl restart secure-ai-chat
```

## 📊 Expected Output

When successful, you should see:

```
╔═══════════════════════════════════════════════════════════════╗
║            ✅ CLEAN REINSTALL COMPLETE                         ║
║                                                               ║
║  Previous commit: xxxxxxxx                                    ║
║  New commit:      xxxxxxxx                                    ║
║  Branch:          main                                        ║
║  Service:         secure-ai-chat                              ║
║                                                               ║
║  Application reinstalled and restarted successfully.           ║
╚═══════════════════════════════════════════════════════════════╝
```

## 🔄 Rollback

If something goes wrong, you can rollback:

```bash
# Stop service
sudo systemctl stop secure-ai-chat

# Restore from backup
cd /home/adminuser/secure-ai-chat
BACKUP_DIR=/home/adminuser/secure-ai-chat-backup-YYYYMMDD_HHMMSS

# Restore keys
cp -r $BACKUP_DIR/.secure-storage .secure-storage
cp -r $BACKUP_DIR/.storage .storage
cp $BACKUP_DIR/.env .env 2>/dev/null || true

# Restore previous commit
git reset --hard $(cat $BACKUP_DIR/previous-commit.txt)

# Rebuild
npm ci --production=false
npm run build

# Restart
sudo systemctl start secure-ai-chat
```

## 📚 Related Scripts

- `upgrade-production-v1.0.7.sh` - Upgrade script (incremental)
- `fix-production-keys.sh` - Quick fix for key issues
- `verify-production-update.sh` - Verification script

## ⚠️ Important Notes

1. **Backup is Critical:** The script creates backups automatically, but verify they exist before proceeding
2. **Service Downtime:** Expect 5-10 minutes of downtime during reinstall
3. **API Keys Preserved:** All API keys are backed up and restored automatically
4. **Uploaded Files Preserved:** All uploaded files are backed up and restored
5. **Environment Variables:** If you use `.env` files, they are backed up and restored

## 🎯 When to Use This Script

Use this script when:
- ✅ You want a completely fresh installation
- ✅ You're experiencing persistent issues
- ✅ You want to ensure latest code is deployed
- ✅ You want to fix all cache-related issues
- ✅ You're upgrading from an older version

## 📞 Support

If the script fails:
1. Check the error message
2. Review the troubleshooting section
3. Check service logs: `sudo journalctl -u secure-ai-chat -n 100`
4. Verify backups exist: `ls -la /home/adminuser/secure-ai-chat-backup-*/`

---

**Last Updated:** January 12, 2026  
**Script:** `scripts/clean-reinstall-production.sh`  
**Status:** ✅ Ready for Production
