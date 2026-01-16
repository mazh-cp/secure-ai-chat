# Fresh Ubuntu Installation and Validation Guide

This guide provides instructions for performing a clean, fresh installation of Secure AI Chat v1.0.11 on Ubuntu and validating the installation.

## Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Internet connection
- Sudo/root access
- At least 2GB RAM and 5GB disk space

## Clean Installation

### Option 1: Automated Installation Script

```bash
# Standard installation
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash

# Clean installation (removes existing installation)
CLEAN_INSTALL=true TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash

# Custom installation directory
INSTALL_DIR=/opt TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
```

### Option 2: Manual Installation

1. **Clone the repository:**
   ```bash
   cd ~
   git clone https://github.com/mazh-cp/secure-ai-chat.git
   cd secure-ai-chat
   git checkout v1.0.11
   ```

2. **Run the installation script:**
   ```bash
   bash scripts/install-ubuntu-v1.0.11.sh
   ```

## Installation Steps

The script performs the following steps:

1. **System Dependencies**: Installs required packages (curl, git, build-essential, etc.)
2. **Node.js Installation**: Installs Node.js v25.2.1 via nvm
3. **Repository Setup**: Clones or updates the repository
4. **Dependencies**: Installs npm packages
5. **Environment Configuration**: Creates `.env.local` file
6. **Secure Storage**: Creates `.secure-storage` directory with proper permissions
7. **Build**: Compiles the Next.js application
8. **Systemd Service**: Sets up automatic startup
9. **Firewall**: Configures UFW firewall rules
10. **Start**: Starts the application

## Validation

After installation, run the validation script to verify everything is working:

```bash
cd ~/secure-ai-chat
bash scripts/validate-fresh-install.sh
```

### Custom Validation

```bash
# Custom installation directory
APP_DIR=/opt/secure-ai-chat bash scripts/validate-fresh-install.sh

# Custom port
PORT=3001 APP_DIR=~/secure-ai-chat bash scripts/validate-fresh-install.sh
```

## Validation Checks

The validation script performs the following checks:

### 1. Installation Directory
- ✅ Directory exists
- ✅ Directory is writable
- ✅ Correct permissions

### 2. Node.js and npm
- ✅ Node.js installed (v25.x)
- ✅ npm installed
- ✅ Correct versions

### 3. Application Files
- ✅ `package.json` exists
- ✅ Version is 1.0.11
- ✅ `package-lock.json` exists
- ✅ `node_modules` directory exists and populated

### 4. Build Artifacts
- ✅ `.next` directory exists
- ✅ Build artifacts present

### 5. Secure Storage
- ✅ `.secure-storage` directory exists
- ✅ Permissions are 700 (restricted)

### 6. Environment Configuration
- ✅ `.env.local` file exists
- ✅ `HOSTNAME` set to 0.0.0.0
- ✅ `PORT` configured

### 7. Systemd Service
- ✅ Service file exists
- ✅ Service is enabled
- ✅ Service is running

### 8. Application Health
- ✅ Port is listening
- ✅ Health endpoint responding
- ✅ Version endpoint responding

### 9. Firewall Configuration
- ✅ UFW is active
- ✅ Port is allowed

### 10. Git Repository
- ✅ Git repository exists
- ✅ On correct tag/branch

## Expected Validation Results

### Successful Installation
```
✅ All checks passed! Installation is complete and ready.
```

### Installation with Warnings
```
⚠️  Installation is functional but has some warnings.
Review the warnings above and address them if needed.
```

### Failed Installation
```
❌ Some checks failed. Please review the errors above.
```

## Common Issues and Fixes

### Issue: Build artifacts missing
**Fix:**
```bash
cd ~/secure-ai-chat
npm run build
```

### Issue: Service not running
**Fix:**
```bash
sudo systemctl start secure-ai-chat
sudo systemctl status secure-ai-chat
```

### Issue: Port not listening
**Fix:**
```bash
# Check if service is running
sudo systemctl status secure-ai-chat

# Check logs
sudo journalctl -u secure-ai-chat -n 50

# Restart service
sudo systemctl restart secure-ai-chat
```

### Issue: Secure storage permissions
**Fix:**
```bash
cd ~/secure-ai-chat
chmod 700 .secure-storage
```

### Issue: Firewall blocking port
**Fix:**
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

## Post-Installation Configuration

### 1. Configure API Keys

**Via Settings Page (Recommended):**
1. Access: `http://your-server:3000/settings`
2. Enter API keys in the form
3. Click "Save Settings"
4. Keys are stored securely in `.secure-storage/api-keys.enc`

**Via Environment Variables:**
```bash
cd ~/secure-ai-chat
nano .env.local
```

Add your keys:
```env
OPENAI_API_KEY=sk-...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...
```

### 2. Verify Application

```bash
# Health check
curl http://localhost:3000/api/health

# Version check
curl http://localhost:3000/api/version

# Keys status
curl http://localhost:3000/api/keys
```

### 3. Access the Application

- **Local**: `http://localhost:3000`
- **Network**: `http://your-server-ip:3000`

## Troubleshooting

### View Logs
```bash
# Systemd logs
sudo journalctl -u secure-ai-chat -f

# Application logs
cd ~/secure-ai-chat
npm start  # View console output
```

### Restart Service
```bash
sudo systemctl restart secure-ai-chat
```

### Rebuild Application
```bash
cd ~/secure-ai-chat
npm run build
sudo systemctl restart secure-ai-chat
```

### Check Service Status
```bash
sudo systemctl status secure-ai-chat
```

### Verify Port
```bash
sudo ss -tlnp | grep :3000
```

## Validation Script Output Example

```
========================================
Secure AI Chat v1.0.11 - Fresh Install Validation
========================================

Installation Directory: /home/user/secure-ai-chat
Application Port: 3000
Base URL: http://localhost:3000

========================================
Step 1: Installation Directory Check
========================================

✅ Installation directory exists: /home/user/secure-ai-chat
✅ Installation directory is writable

[... more checks ...]

========================================
Validation Summary
========================================

Total Checks: 25
Passed: 23
Failed: 0
Warnings: 2

✅ All checks passed! Installation is complete and ready.
```

## Next Steps

1. ✅ Run validation script
2. ✅ Configure API keys via Settings page
3. ✅ Test chat functionality
4. ✅ Verify provider switching works
5. ✅ Test file upload and RAG

## Support

If validation fails:
1. Review the error messages
2. Check the troubleshooting section
3. Review server logs: `sudo journalctl -u secure-ai-chat -n 100`
4. Check application logs in the console

## Related Documentation

- [Installation Fix Guide](./INSTALLATION_FIX_v1.0.11.md)
- [API Keys Save Fix](./API_KEYS_SAVE_FIX.md)
- [User Guide](./USER_GUIDE.md)
- [Changelog](./CHANGELOG.md)
