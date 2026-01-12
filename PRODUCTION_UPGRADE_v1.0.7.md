# Production Upgrade Guide - v1.0.7

This guide provides instructions for upgrading your production Secure AI Chat application to version 1.0.7.

## 🎯 What's New in v1.0.7

### New Features
- **Release Notes Page**: Dedicated page for viewing version history and changelog
  - Accessible from Settings page and navigation sidebar
  - Beautiful UI with version badges and categorized changes
- **RAG (Retrieval Augmented Generation)**: Chat can now access and answer questions about uploaded files
  - Automatic file content retrieval based on user queries
  - Supports CSV, JSON, and text files
  - Smart content matching for large files

### Bug Fixes
- Fixed "Failed to execute 'json' on 'Response'" error for large files
- Fixed navigation sidebar visibility on desktop
- Fixed Checkpoint TE status synchronization
- Fixed webpack chunk errors

### Improvements
- Enhanced key deletion with proper cache invalidation
- Improved error handling and status synchronization
- Updated all packages to latest patch/minor versions

## 📋 Pre-Upgrade Checklist

Before starting the upgrade, ensure:

- [ ] You have SSH access to the production server
- [ ] You have sudo/root privileges on the server
- [ ] The application is currently running and accessible
- [ ] You have a backup of the `.env` file (the script will create one automatically)
- [ ] You have a backup of the `.secure-storage` directory (the script will create one automatically)
- [ ] You know the repository directory path (default: `/home/adminuser/secure-ai-chat`)
- [ ] You know the service name (default: `secure-ai-chat`)

## 🚀 Upgrade Methods

### Method 1: Automated Upgrade Script (Recommended)

The easiest way to upgrade is using the automated upgrade script:

```bash
# Download and run the upgrade script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/upgrade-production-v1.0.7.sh | sudo bash

# Or if you already have the repository cloned:
cd /home/adminuser/secure-ai-chat
sudo bash upgrade-production-v1.0.7.sh
```

**Custom Configuration:**
```bash
# Custom repository directory and branch
REPO_DIR=/custom/path BRANCH=main sudo bash upgrade-production-v1.0.7.sh

# Custom service name
SERVICE_NAME=my-secure-chat sudo bash upgrade-production-v1.0.7.sh
```

### Method 2: Manual Upgrade

If you prefer to upgrade manually:

```bash
# 1. Navigate to repository directory
cd /home/adminuser/secure-ai-chat

# 2. Backup current state
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
cp -r .secure-storage .secure-storage.backup.$(date +%Y%m%d_%H%M%S)

# 3. Fetch latest changes
git fetch origin

# 4. Pull latest version
git pull origin main

# 5. Install dependencies
npm ci --production=false

# 6. Clear build cache
rm -rf .next

# 7. Build application
npm run build

# 8. Restart service
sudo systemctl restart secure-ai-chat

# 9. Verify upgrade
curl http://localhost:3000/api/version
```

## 📝 Upgrade Script Details

The upgrade script (`upgrade-production-v1.0.7.sh`) performs the following steps:

1. **Backup Current State**
   - Backs up `.env` file
   - Backs up `.secure-storage` directory (API keys)
   - Records current commit and version

2. **Fix Permissions**
   - Ensures correct ownership for repository files
   - Fixes git directory permissions

3. **Fetch Latest Changes**
   - Fetches latest code from GitHub
   - Stashes any local changes

4. **Update to Latest Version**
   - Checks out the target branch (default: `main`)
   - Pulls latest changes
   - Verifies version update

5. **Install Dependencies**
   - Detects package manager (npm/yarn/pnpm)
   - Installs dependencies using lockfile

6. **Build Application**
   - Clears Next.js build cache
   - Builds production application

7. **Restart Service**
   - Restarts systemd service
   - Verifies service is running

8. **Verify Deployment**
   - Checks health endpoint
   - Checks version endpoint
   - Displays upgrade summary

## ✅ Post-Upgrade Verification

After the upgrade completes, verify:

1. **Service Status**
   ```bash
   sudo systemctl status secure-ai-chat
   ```

2. **Health Check**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Version Check**
   ```bash
   curl http://localhost:3000/api/version
   ```
   Should return: `{"version":"1.0.7",...}`

4. **Access Release Notes**
   - Navigate to: `http://your-server-ip:3000/release-notes`
   - Or go to Settings page and click "View Release Notes"

5. **Test Key Features**
   - Test file upload and scanning
   - Test chat with RAG (upload a file and ask questions about it)
   - Test navigation (sidebar should always be visible on desktop)
   - Test Checkpoint TE status updates

## 🔧 Troubleshooting

### Issue: Upgrade script fails with permission errors

**Solution:**
```bash
# Fix ownership
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat
sudo chmod -R u+w /home/adminuser/secure-ai-chat/.git

# Run upgrade again
sudo bash upgrade-production-v1.0.7.sh
```

### Issue: Service fails to start after upgrade

**Solution:**
```bash
# Check service logs
sudo journalctl -u secure-ai-chat -n 50

# Check for build errors
cd /home/adminuser/secure-ai-chat
npm run build

# Restart service
sudo systemctl restart secure-ai-chat
```

### Issue: Webpack chunk errors after upgrade

**Solution:**
```bash
# Clear build cache and rebuild
cd /home/adminuser/secure-ai-chat
rm -rf .next
npm run build
sudo systemctl restart secure-ai-chat
```

### Issue: API keys missing after upgrade

**Solution:**
```bash
# Restore from backup
cd /home/adminuser/secure-ai-chat
cp -r .secure-storage.backup.*/.secure-storage .secure-storage
sudo chmod -R 700 .secure-storage
sudo chown -R adminuser:adminuser .secure-storage
sudo systemctl restart secure-ai-chat
```

## 🔄 Rollback Procedure

If you need to rollback to a previous version:

```bash
cd /home/adminuser/secure-ai-chat

# Find previous commit
git log --oneline -10

# Reset to previous commit (replace COMMIT_HASH)
git reset --hard COMMIT_HASH

# Restore backups
cp .env.backup.* .env
cp -r .secure-storage.backup.*/.secure-storage .secure-storage

# Rebuild and restart
npm ci --production=false
rm -rf .next
npm run build
sudo systemctl restart secure-ai-chat
```

## 📞 Support

If you encounter issues during the upgrade:

1. Check the service logs: `sudo journalctl -u secure-ai-chat -f`
2. Review the upgrade script output for error messages
3. Verify all prerequisites are met
4. Check the [Troubleshooting](#-troubleshooting) section above

## 📚 Additional Resources

- [Release Notes v1.0.7](RELEASE_NOTES_v1.0.7.md)
- [CHANGELOG.md](CHANGELOG.md)
- [README.md](README.md)

---

**Upgrade Date:** January 12, 2026  
**Target Version:** 1.0.7  
**Script:** `upgrade-production-v1.0.7.sh`
