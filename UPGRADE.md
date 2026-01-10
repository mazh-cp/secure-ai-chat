# Production Upgrade Guide - Secure AI Chat

**Version**: 1.0.1  
**Purpose**: Single command upgrade for production systems

---

## 🚀 Quick Upgrade Command

### **Single Command (Recommended)**:

```bash
sudo bash -c "curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.1/upgrade.sh | bash -s --"
```

### **Alternative (If script is already on server)**:

```bash
sudo bash /opt/secure-ai-chat/upgrade.sh
```

---

## 📋 What the Upgrade Script Does

The upgrade script performs the following steps:

1. **Backup Current State**
   - Backs up current commit hash
   - Backs up `.env` file (if exists) with timestamp

2. **Fetch Latest Changes**
   - Fetches latest changes from origin repository

3. **Update to Latest Version**
   - Checks out the specified branch (default: `release/v1.0.1`)
   - Pulls latest changes from origin

4. **Install Dependencies**
   - Detects package manager (npm/yarn/pnpm) from lockfiles
   - Installs dependencies using lockfile-safe method (`npm ci` or equivalent)

5. **Build Application**
   - Builds the application in production mode
   - Creates optimized production bundle

6. **Restart Service**
   - Restarts systemd service gracefully
   - Verifies service starts successfully

7. **Verify Deployment**
   - Checks health endpoint
   - Confirms service is running

---

## ⚙️ Configuration

### Environment Variables

You can customize the upgrade script using environment variables:

```bash
# Set custom repository directory (default: /opt/secure-ai-chat)
export REPO_DIR=/opt/secure-ai-chat

# Set custom service name (default: secure-ai-chat)
export SERVICE_NAME=secure-ai-chat

# Set custom branch (default: release/v1.0.1)
export BRANCH=release/v1.0.1

# Run upgrade
sudo bash /opt/secure-ai-chat/upgrade.sh
```

### Example: Upgrade to Main Branch

```bash
sudo bash -c "BRANCH=main REPO_DIR=/opt/secure-ai-chat bash /opt/secure-ai-chat/upgrade.sh"
```

---

## 🔒 Security Considerations

1. **Run as Root/Sudo**: The script must be run with root privileges for systemd service management
2. **Backup**: Environment files are automatically backed up before upgrade
3. **Lockfile-Safe**: Uses `npm ci` (or equivalent) to ensure exact dependency versions
4. **Verification**: Verifies service health after upgrade

---

## 📝 Manual Upgrade Steps (If Script Fails)

If the automated script fails, you can perform manual upgrade:

```bash
# 1. Navigate to repository
cd /opt/secure-ai-chat

# 2. Backup environment file
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# 3. Fetch and pull latest changes
sudo git fetch origin
sudo git checkout release/v1.0.1
sudo git pull origin release/v1.0.1

# 4. Install dependencies
sudo npm ci

# 5. Build application
sudo npm run build

# 6. Restart service
sudo systemctl restart secure-ai-chat

# 7. Verify deployment
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/health
```

---

## 🐛 Troubleshooting

### Service Fails to Start

```bash
# Check service logs
sudo journalctl -u secure-ai-chat -n 50 --no-pager

# Check service status
sudo systemctl status secure-ai-chat --no-pager -l
```

### Build Fails

```bash
# Check Node.js version
node -v

# Verify dependencies
npm ci

# Check build logs
npm run build 2>&1 | tee build.log
```

### Rollback to Previous Version

```bash
# Navigate to repository
cd /opt/secure-ai-chat

# Check commit history
git log --oneline -10

# Reset to previous commit
sudo git reset --hard <previous-commit-hash>

# Rebuild and restart
sudo npm ci
sudo npm run build
sudo systemctl restart secure-ai-chat
```

---

## ✅ Verification After Upgrade

After running the upgrade, verify everything is working:

```bash
# 1. Check service status
sudo systemctl status secure-ai-chat

# 2. Check health endpoint
curl http://localhost:3000/api/health

# 3. Check version/commit
cd /opt/secure-ai-chat
git log --oneline -1

# 4. Check application version
curl http://localhost:3000/api/health | jq .

# 5. Full verification script
sudo bash /opt/secure-ai-chat/verify-deployment.sh
```

---

## 📚 Related Documentation

- **Deployment Guide**: See `deploy-ubuntu-vm.sh` for initial deployment
- **Verification Guide**: See `verify-deployment.sh` for post-upgrade verification
- **Release Notes**: See `CHANGELOG.md` for version changes

---

**Last Updated**: 2026-01-XX  
**Maintained By**: Development Team
