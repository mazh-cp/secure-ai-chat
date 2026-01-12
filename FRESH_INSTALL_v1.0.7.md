# Fresh Clean Install Guide - v1.0.7

**Date:** January 12, 2026  
**Version:** 1.0.7  
**Purpose:** Complete fresh installation on remote production VM with all latest fixes

## 🎯 Overview

This guide provides instructions for a fresh clean install of Secure AI Chat v1.0.7 on a remote Ubuntu VM. The installation script has been updated with all latest fixes including:

- ✅ Permission handling fixes
- ✅ API key validation
- ✅ ModelSelector server-side storage
- ✅ Checkpoint TE improvements
- ✅ Release Notes page
- ✅ All v1.0.7 features

## 🚀 Quick Install

### Option 1: One-Line Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/deploy-ubuntu-vm.sh | sudo bash
```

### Option 2: Download and Run

```bash
# Download the script
wget https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/deploy-ubuntu-vm.sh

# Make it executable
chmod +x deploy-ubuntu-vm.sh

# Run it
sudo bash deploy-ubuntu-vm.sh
```

### Option 3: Alternative Install Script

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

## 📋 What the Script Does

### Step 1: Update OS Packages
- Updates package list
- Upgrades system packages
- Installs required tools (git, curl, etc.)

### Step 2: Install Node.js 25.2.1
- Installs NVM (Node Version Manager)
- Installs Node.js v25.2.1
- Sets as default version
- Verifies installation

### Step 3: Clone Repository
- Clones from GitHub (main branch)
- Or updates existing repository
- Fixes permissions
- Ensures correct ownership

### Step 4: Fix Permissions
- Sets ownership to service user
- Ensures write permissions
- Fixes file permissions
- **NEW:** Prevents npm permission errors

### Step 5: Install Dependencies
- Fresh `npm ci` or `npm install`
- Runs as correct user
- Handles permission errors gracefully
- **NEW:** Retries with permission fix if needed

### Step 6: Build Application
- Clears build cache
- Runs production build
- Generates all routes
- **NEW:** Includes Release Notes page

### Step 7: Set Final Permissions
- Sets correct ownership
- Creates storage directories
- Sets secure permissions (700 for .secure-storage)
- **NEW:** Ensures all files are accessible

### Step 8: Create systemd Service
- Creates service file
- Configures auto-restart
- Sets environment variables
- Enables on boot

### Step 9: Start Service
- Enables service
- Starts application
- Verifies service is running

### Step 10: Verification
- Checks service status
- Tests health endpoint
- Tests version endpoint
- **NEW:** Tests all pages (including Release Notes)

## ✅ What's Included in v1.0.7

### New Features
- **Release Notes Page** - Accessible from Settings and navigation
- **ModelSelector Fix** - Works with server-side storage automatically
- **API Key Validation** - Prevents placeholder keys
- **Checkpoint TE Improvements** - Better error handling

### Fixes
- Permission handling from the start
- npm install permission errors resolved
- Better error messages
- Improved status synchronization

## 🔧 Configuration

### Default Settings
- **Repository:** `/home/adminuser/secure-ai-chat`
- **Branch:** `main`
- **Node Version:** `25.2.1`
- **Service Name:** `secure-ai-chat`
- **Service User:** `adminuser`
- **Port:** `3000`

### Custom Configuration

You can override defaults with environment variables:

```bash
# Custom branch
BRANCH=main sudo bash deploy-ubuntu-vm.sh

# Custom repository directory
REPO_DIR=/custom/path sudo bash deploy-ubuntu-vm.sh
```

## 📝 Post-Installation Steps

### 1. Configure API Keys

Go to Settings page and configure:
- OpenAI API key (required for chat)
- Lakera AI key (optional, for security scanning)
- Checkpoint TE key (optional, for file sandboxing)

### 2. Set Up PIN (Optional)

- Go to Settings → PIN Protection
- Set a 4-8 digit PIN
- This protects API key deletion operations

### 3. Test Features

- **Chat:** Test sending messages
- **Model Selector:** Should work automatically
- **File Upload:** Test file scanning
- **Release Notes:** Navigate to `/release-notes`

### 4. Verify Installation

```bash
# Check service
sudo systemctl status secure-ai-chat

# Check health
curl http://localhost:3000/api/health

# Check version
curl http://localhost:3000/api/version

# Test pages
curl -I http://localhost:3000/release-notes
```

## 🔍 Verification Checklist

After installation, verify:

- [ ] Service is running (`systemctl status secure-ai-chat`)
- [ ] Health endpoint responds (`/api/health`)
- [ ] Version is 1.0.7 (`/api/version`)
- [ ] Release Notes page accessible (`/release-notes`)
- [ ] Settings page accessible (`/settings`)
- [ ] Chat page accessible (`/`)
- [ ] Files page accessible (`/files`)
- [ ] Model Selector works (if API key configured)
- [ ] API keys can be saved in Settings
- [ ] No permission errors in logs

## 🚨 Troubleshooting

### Issue: Permission denied during npm install

**Solution:** The script now handles this automatically, but if it persists:

```bash
cd /home/adminuser/secure-ai-chat
sudo chown -R adminuser:adminuser .
sudo chmod -R u+w .
sudo -u adminuser npm install --production=false
```

### Issue: Service fails to start

**Solution:**
```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 50 --no-pager

# Check build
ls -la /home/adminuser/secure-ai-chat/.next

# Rebuild if needed
cd /home/adminuser/secure-ai-chat
sudo -u adminuser npm run build
sudo systemctl restart secure-ai-chat
```

### Issue: Pages not accessible

**Solution:**
```bash
# Check if service is running
sudo systemctl status secure-ai-chat

# Check if port is listening
sudo ss -tlnp | grep 3000

# Check firewall
sudo ufw status
```

## 📊 Expected Output

When successful, you should see:

```
╔═══════════════════════════════════════════════════════════════╗
║              ✅ DEPLOYMENT COMPLETE                           ║
║                                                               ║
║  Application: http://localhost:3000                           ║
║  Service:     secure-ai-chat                                 ║
║  Branch:       main                                            ║
║  Version:      v1.0.7                                          ║
║                                                               ║
║  Features:                                                     ║
║  ✅ Release Notes page                                          ║
║  ✅ ModelSelector server-side storage                           ║
║  ✅ API key validation (placeholder detection)                ║
║  ✅ Checkpoint TE improved error handling                      ║
╚═══════════════════════════════════════════════════════════════╝
```

## 🔄 Comparison with Previous Versions

### v1.0.7 vs v1.0.6

| Feature | v1.0.6 | v1.0.7 |
|---------|--------|--------|
| Release Notes | ❌ | ✅ |
| Permission Fixes | ⚠️ Basic | ✅ Comprehensive |
| API Key Validation | ⚠️ Basic | ✅ Placeholder detection |
| ModelSelector | ⚠️ Client-side key | ✅ Server-side storage |
| Error Handling | ⚠️ Basic | ✅ Improved |

## 📚 Related Scripts

- `deploy-ubuntu-vm.sh` - Main deployment script (updated)
- `scripts/install-ubuntu.sh` - Alternative install script (updated)
- `scripts/clean-reinstall-production.sh` - Clean reinstall for existing installations
- `scripts/fix-permissions.sh` - Quick permission fix

## ⚠️ Important Notes

1. **Fresh Install:** This is for fresh installations. For existing installations, use `clean-reinstall-production.sh`
2. **Permissions:** Script handles permissions automatically
3. **Service User:** Default is `adminuser`, ensure this user exists
4. **Node Version:** Requires Node.js 25.2.1 (installed automatically)
5. **Firewall:** Script doesn't configure firewall - you may need to do this manually

## 🎯 Quick Reference

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/deploy-ubuntu-vm.sh | sudo bash

# Verify
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/version

# Access
http://your-server-ip:3000
```

---

**Last Updated:** January 12, 2026  
**Script:** `deploy-ubuntu-vm.sh`  
**Version:** 1.0.7  
**Status:** ✅ Ready for Production
