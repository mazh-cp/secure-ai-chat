# Production Rollback Guide

**Purpose:** Safely revert production system to a previous known good version

## 🎯 Overview

This guide provides instructions for rolling back the production system to a previous version when issues occur after an upgrade.

## ⚠️ Important Notes

- **Backup First:** The rollback script automatically backs up critical data
- **API Keys Preserved:** All API keys in `.secure-storage` are preserved
- **Uploaded Files Preserved:** All files in `.storage` are preserved
- **Service Restart:** The service will be restarted after rollback

## 🚀 Quick Rollback

### Option 1: Interactive Rollback (Recommended)

```bash
cd /home/adminuser/secure-ai-chat
sudo bash scripts/rollback-production.sh
```

The script will:
1. Show available versions
2. Prompt you to select a version
3. Confirm before proceeding
4. Perform the rollback automatically

### Option 2: Direct Version Rollback

```bash
# Rollback to v1.0.6
sudo bash scripts/rollback-production.sh v1.0.6

# Rollback to v1.0.5
sudo bash scripts/rollback-production.sh v1.0.5

# Rollback to main branch
sudo bash scripts/rollback-production.sh main
```

### Option 3: Download and Run

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/rollback-production.sh | sudo bash
```

## 📋 What Gets Backed Up

The rollback script automatically backs up:

- ✅ `.secure-storage/` - All API keys (encrypted)
- ✅ `.storage/` - All uploaded files
- ✅ `.env` - Environment configuration
- ✅ Current commit hash and version info

Backup location: `/home/adminuser/secure-ai-chat-backups/rollback_backup_TIMESTAMP/`

## 🔄 Rollback Process

The script performs these steps:

1. **Stop Service** - Safely stops the running service
2. **Create Backup** - Backs up all critical data
3. **Fetch Remote** - Gets latest tags/branches from GitHub
4. **Checkout Version** - Switches to target version
5. **Restore Backups** - Restores API keys and files
6. **Install Dependencies** - Installs npm packages for that version
7. **Rebuild Application** - Builds the application
8. **Fix Permissions** - Sets correct ownership and permissions
9. **Update Service** - Ensures systemd service is correct
10. **Start Service** - Starts the service
11. **Verify** - Checks that everything is working

## 📦 Available Versions

Common rollback targets:

- **v1.0.6** - Previous stable version
- **v1.0.5** - Earlier version
- **v1.0.4** - Earlier version
- **main** - Current main branch

To see all available versions:

```bash
cd /home/adminuser/secure-ai-chat
git fetch --tags
git tag
```

## 🔍 Verification After Rollback

After rollback, verify:

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check version
cd /home/adminuser/secure-ai-chat
grep '"version"' package.json

# Check network binding
sudo ss -tlnp | grep :3000
# Should show: 0.0.0.0:3000

# Test health endpoint
curl http://localhost:3000/api/health

# Check logs
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

## 🚨 Troubleshooting

### Issue: Rollback fails during checkout

**Solution:**
```bash
# Check available tags/branches
cd /home/adminuser/secure-ai-chat
git fetch --tags
git tag
git branch -a

# Try specific commit
git log --oneline | head -20
git checkout <commit-hash>
```

### Issue: Dependencies fail to install

**Solution:**
```bash
# Clear node_modules and reinstall
cd /home/adminuser/secure-ai-chat
sudo rm -rf node_modules package-lock.json
sudo -u adminuser npm install --production=false
```

### Issue: Build fails

**Solution:**
```bash
# Clear build cache and rebuild
cd /home/adminuser/secure-ai-chat
rm -rf .next
sudo -u adminuser npm run build
```

### Issue: Service won't start

**Solution:**
```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 100 --no-pager

# Recreate service if needed
sudo bash scripts/create-systemd-service.sh

# Check permissions
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat
```

## 🔄 Manual Rollback

If the script doesn't work, you can rollback manually:

```bash
# 1. Stop service
sudo systemctl stop secure-ai-chat

# 2. Backup critical data
sudo cp -r /home/adminuser/secure-ai-chat/.secure-storage /tmp/backup-secure-storage
sudo cp -r /home/adminuser/secure-ai-chat/.storage /tmp/backup-storage
sudo cp /home/adminuser/secure-ai-chat/.env /tmp/backup-env

# 3. Checkout previous version
cd /home/adminuser/secure-ai-chat
git fetch --tags
git checkout v1.0.6  # or your target version

# 4. Restore backups
sudo cp -r /tmp/backup-secure-storage /home/adminuser/secure-ai-chat/.secure-storage
sudo cp -r /tmp/backup-storage /home/adminuser/secure-ai-chat/.storage
sudo cp /tmp/backup-env /home/adminuser/secure-ai-chat/.env
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat

# 5. Install dependencies
sudo -u adminuser npm ci --production=false

# 6. Rebuild
sudo -u adminuser npm run build

# 7. Start service
sudo systemctl start secure-ai-chat
```

## 📝 Rollback Checklist

Before rolling back:

- [ ] Identify the target version
- [ ] Verify backup location has space
- [ ] Note current version and commit
- [ ] Ensure you have sudo access
- [ ] Have rollback script ready

After rolling back:

- [ ] Verify service is running
- [ ] Check application is accessible
- [ ] Verify API keys are intact
- [ ] Test critical functionality
- [ ] Check logs for errors
- [ ] Document rollback reason

## 🔗 Related Scripts

- `scripts/rollback-production.sh` - Automated rollback script
- `scripts/create-systemd-service.sh` - Recreate service if needed
- `scripts/fix-public-access.sh` - Fix access issues after rollback

## ⚠️ Important Warnings

1. **Data Safety:** The script backs up everything, but always verify backups
2. **API Keys:** Keys are preserved, but verify they work after rollback
3. **Service:** Service will be restarted, causing brief downtime
4. **Dependencies:** Old versions may have different dependencies
5. **Build:** Application will be rebuilt, which takes time

## 📚 Recovery

If rollback causes issues:

1. Check the backup location for previous state
2. Review logs: `sudo journalctl -u secure-ai-chat -n 100`
3. Try rolling back to an even earlier version
4. Consider restoring from backup manually

---

**Last Updated:** January 12, 2026  
**Status:** ✅ Ready for Production Use
