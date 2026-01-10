# Production Server Update Guide

This guide explains how to update the Secure AI Chat application on your production server with the latest changes from GitHub.

---

## Quick Update (Recommended)

**Single command to update your production server:**

```bash
cd /home/adminuser/secure-ai-chat
sudo bash update-production.sh
```

This script will:
1. ✅ Backup current state
2. ✅ Fix repository permissions
3. ✅ Fetch latest changes from GitHub
4. ✅ Update to latest version
5. ✅ Install dependencies
6. ✅ Build the application
7. ✅ Restart the service
8. ✅ Verify deployment

---

## Manual Update Steps

If you prefer to update manually:

### 1. SSH into your production server

```bash
ssh adminuser@your-production-server
```

### 2. Navigate to the repository directory

```bash
cd /home/adminuser/secure-ai-chat
```

### 3. Fix permissions (if needed)

```bash
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat
sudo chmod -R u+w /home/adminuser/secure-ai-chat/.git
```

### 4. Fetch latest changes from GitHub

```bash
git fetch origin
```

### 5. Checkout the release branch

```bash
git checkout release/v1.0.2
```

### 6. Pull latest changes

```bash
git pull origin release/v1.0.2
```

### 7. Install dependencies

```bash
npm ci
```

### 8. Build the application

```bash
npm run build
```

### 9. Restart the service

```bash
sudo systemctl restart secure-ai-chat
```

### 10. Verify the update

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health endpoint
curl http://localhost:3000/api/health

# Check logs
sudo journalctl -u secure-ai-chat -f
```

---

## Update Script Details

### Script Location

The update script is located at:
```
/home/adminuser/secure-ai-chat/update-production.sh
```

### Custom Configuration

You can customize the update script using environment variables:

```bash
# Custom repository directory
REPO_DIR=/custom/path sudo bash update-production.sh

# Custom branch
BRANCH=release/v1.0.1 sudo bash update-production.sh

# Custom service name
SERVICE_NAME=my-service sudo bash update-production.sh

# Combined
REPO_DIR=/home/adminuser/secure-ai-chat \
BRANCH=release/v1.0.2 \
SERVICE_NAME=secure-ai-chat \
sudo bash update-production.sh
```

### Default Values

- **REPO_DIR**: `/home/adminuser/secure-ai-chat`
- **BRANCH**: `release/v1.0.2`
- **SERVICE_NAME**: `secure-ai-chat`
- **REPO_URL**: `https://github.com/mazh-cp/secure-ai-chat.git`

---

## What Gets Updated

The update script updates:

1. ✅ **Application Code** - Latest code from GitHub
2. ✅ **Dependencies** - Fresh installation from lockfile
3. ✅ **Build Artifacts** - New production build
4. ✅ **Service** - Restart with new build

**What Doesn't Change:**

- ❌ **Environment Variables** - `.env` file is preserved (backed up)
- ❌ **Secure Storage** - `.secure-storage/` directory is preserved
- ❌ **Service Configuration** - Systemd service file unchanged
- ❌ **Data** - All user data and settings preserved

---

## Backup and Rollback

### Automatic Backup

The update script automatically backs up your `.env` file before updating:
```
.env.backup.YYYYMMDD_HHMMSS
```

### Manual Rollback

If you need to rollback to a previous version:

```bash
cd /home/adminuser/secure-ai-chat

# Check previous commits
git log --oneline -10

# Rollback to a specific commit
git checkout <commit-hash>
npm ci
npm run build
sudo systemctl restart secure-ai-chat
```

### Restore Environment File

If you need to restore a backed up `.env` file:

```bash
cd /home/adminuser/secure-ai-chat
cp .env.backup.YYYYMMDD_HHMMSS .env
sudo systemctl restart secure-ai-chat
```

---

## Troubleshooting

### Permission Errors

If you encounter permission errors:

```bash
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat
sudo chmod -R u+w /home/adminuser/secure-ai-chat/.git
```

### Git Pull Fails

If `git pull` fails, the script will automatically try to reset:

```bash
cd /home/adminuser/secure-ai-chat
git fetch origin
git reset --hard origin/release/v1.0.2
```

### Build Fails

If the build fails:

1. Check Node.js version:
   ```bash
   node -v  # Should be 25.2.1
   ```

2. Clear build cache:
   ```bash
   rm -rf .next node_modules
   npm ci
   npm run build
   ```

3. Check for errors:
   ```bash
   npm run build 2>&1 | tee build.log
   ```

### Service Fails to Start

If the service fails to start:

1. Check service status:
   ```bash
   sudo systemctl status secure-ai-chat
   ```

2. Check logs:
   ```bash
   sudo journalctl -u secure-ai-chat -n 100
   ```

3. Check environment file:
   ```bash
   cat /home/adminuser/secure-ai-chat/.env
   ```

4. Verify Node.js path in service file:
   ```bash
   sudo systemctl cat secure-ai-chat
   ```

---

## Pre-Update Checklist

Before updating production, verify:

- [ ] **Backup** - Ensure you have a backup of important data
- [ ] **Environment Variables** - Verify `.env` file is correct
- [ ] **Disk Space** - Ensure sufficient disk space for build
- [ ] **Network** - Verify internet connection for fetching updates
- [ ] **Service Status** - Check current service is running
- [ ] **Health Check** - Verify current deployment is healthy
- [ ] **Maintenance Window** - Schedule update during low traffic period (optional)

---

## Post-Update Verification

After updating, verify:

- [ ] **Service Status** - Service is running (`sudo systemctl status secure-ai-chat`)
- [ ] **Health Endpoint** - Responds correctly (`curl http://localhost:3000/api/health`)
- [ ] **Application Access** - Website is accessible
- [ ] **API Keys** - Settings page shows correct API key status
- [ ] **Logs** - No errors in service logs (`sudo journalctl -u secure-ai-chat -f`)
- [ ] **Features** - Key features are working (chat, file upload, etc.)

---

## Automated Updates (Optional)

For automated updates, you can set up a cron job:

```bash
# Edit crontab
crontab -e

# Add daily update at 2 AM (example)
0 2 * * * cd /home/adminuser/secure-ai-chat && /usr/bin/sudo /bin/bash update-production.sh >> /var/log/secure-ai-chat-update.log 2>&1
```

**Note:** Automated updates are not recommended for production without testing.

---

## Support

If you encounter issues:

1. Check the logs: `sudo journalctl -u secure-ai-chat -f`
2. Review this guide
3. Check GitHub issues: https://github.com/mazh-cp/secure-ai-chat/issues
4. Review deployment documentation: `DEPLOYMENT_PERMISSIONS_FIX.md`

---

## Security Notes

- ✅ Always run updates with `sudo` for proper permissions
- ✅ Environment variables are preserved during updates
- ✅ Secure storage (`.secure-storage/`) is never touched
- ✅ API keys in environment variables remain secure
- ✅ Service runs as `adminuser` (non-root)

---

**Last Updated**: 2026-01-XX  
**Version**: 1.0.2  
**Script**: `update-production.sh`
