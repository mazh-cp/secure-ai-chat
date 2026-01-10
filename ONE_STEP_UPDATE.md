# One-Step Production Server Update

This document provides the simplest way to update your production server with the latest changes.

---

## 🚀 One-Step Update Command

### Option 1: Direct Download and Execute (Recommended)

**Run this single command on your production server:**

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.2/update-production.sh | sudo bash
```

This command will:
1. ✅ Download the update script from GitHub
2. ✅ Fix repository permissions
3. ✅ Fetch latest changes
4. ✅ Update to latest version
5. ✅ Install dependencies
6. ✅ Build the application
7. ✅ Restart the service
8. ✅ Verify deployment

---

### Option 2: Download Script First, Then Run

```bash
# Download the script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.2/update-production.sh -o update.sh

# Make it executable
chmod +x update.sh

# Run it
sudo bash update.sh
```

---

### Option 3: Use Existing Script (If Already on Server)

If you already have the repository cloned on your production server:

```bash
cd /home/adminuser/secure-ai-chat
sudo bash update-production.sh
```

---

## 📋 What the Update Does

The update script performs the following steps:

1. **Fix Permissions** - Ensures proper ownership and permissions
2. **Fetch Changes** - Downloads latest changes from GitHub
3. **Update Code** - Checks out and updates to the latest version
4. **Install Dependencies** - Fresh installation from lockfile
5. **Build Application** - Production build
6. **Restart Service** - Restarts systemd service
7. **Verify Deployment** - Checks health endpoint

---

## ⚙️ Custom Configuration

You can customize the update using environment variables:

```bash
# Custom repository directory
REPO_DIR=/custom/path sudo bash update.sh

# Custom branch
BRANCH=release/v1.0.3 sudo bash update.sh

# Custom service name
SERVICE_NAME=my-service sudo bash update.sh

# Combined
REPO_DIR=/home/adminuser/secure-ai-chat \
BRANCH=release/v1.0.2 \
SERVICE_NAME=secure-ai-chat \
sudo bash update.sh
```

### Default Values

- **REPO_DIR**: `/home/adminuser/secure-ai-chat`
- **BRANCH**: `release/v1.0.2`
- **SERVICE_NAME**: `secure-ai-chat`

---

## 🔒 Security Notes

- ✅ Script is downloaded directly from GitHub (verified source)
- ✅ All operations run with proper permissions
- ✅ Environment variables and secure storage preserved
- ✅ No sensitive data exposed during update

---

## 📝 Prerequisites

Before running the update, ensure:

- ✅ You have `sudo` access on the production server
- ✅ The repository is already set up (via `deploy-ubuntu-vm.sh`)
- ✅ Node.js is installed and accessible
- ✅ Git is installed
- ✅ Internet connection is available

---

## 🐛 Troubleshooting

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

### Service Fails to Start

Check service status and logs:

```bash
sudo systemctl status secure-ai-chat
sudo journalctl -u secure-ai-chat -n 50
```

### Build Fails

Check Node.js version and clear cache:

```bash
node -v  # Should be 25.2.1
rm -rf .next node_modules
npm ci
npm run build
```

---

## ✅ Verification

After the update completes, verify:

1. **Service Status**:
   ```bash
   sudo systemctl status secure-ai-chat
   ```

2. **Health Endpoint**:
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Application Access**:
   - Open your application URL in a browser
   - Check that the version shows "1.0.3" in the footer

---

## 📚 Related Documentation

- `PRODUCTION_UPDATE_GUIDE.md` - Detailed update guide
- `update-production.sh` - Full update script with detailed output
- `DEPLOYMENT_PERMISSIONS_FIX.md` - Troubleshooting permissions issues

---

## 🎯 Quick Reference

**One-Step Update Command:**
```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/v1.0.2/update-production.sh | sudo bash
```

**Check Status After Update:**
```bash
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/health
```

---

**Last Updated**: 2026-01-XX  
**Version**: 1.0.3  
**Branch**: `release/v1.0.2`
