# Installation Fix for v1.0.11 - Clean Install Issues

**Version**: 1.0.11  
**Date**: January 16, 2026  
**Issue**: Unable to perform clean install on remote VM

---

## 🔍 Problem Summary

Users reported issues performing clean installations of v1.0.11 on remote VMs. The installation script had several issues:

1. **Tag Checkout Not Supported**: Script only checked out `main` branch, not specific release tags
2. **Error Handling**: Insufficient error messages when `npm ci` fails
3. **Package Lock Sync**: No validation that `package-lock.json` is in sync with `package.json`
4. **Tag Cloning**: Shallow clone with tags can fail

---

## ✅ Fixes Applied

### 1. Tag Support in Installation Script

The installation script now supports checking out specific release tags:

```bash
# Install specific version (v1.0.11)
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Or use branch (default: main)
BRANCH=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

### 2. Improved Error Handling

- Better error messages when `npm ci` fails
- Automatic fallback to `npm install` if `package-lock.json` is out of sync
- Clearer diagnostic messages for common issues

### 3. Enhanced Package Installation

- Validates `package-lock.json` exists before using `npm ci`
- Provides helpful error messages if installation fails
- Suggests manual fixes when automated recovery fails

---

## 🚀 Updated Installation Methods

### Method 1: Install Specific Version (Recommended)

```bash
# Install v1.0.11 specifically
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

### Method 2: Manual Installation with Tag

```bash
# Clone repository
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat

# Checkout specific version
git checkout v1.0.11

# Install Node.js v25.2.1 (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 25.2.1
nvm use 25.2.1

# Install dependencies
npm install

# Build application
npm run build

# Configure environment
cp .env.example .env.local
nano .env.local  # Add your API keys

# Start application
npm start
```

### Method 3: Using Installation Script (Latest Main)

```bash
# Install latest from main branch
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

---

## 🔧 Troubleshooting Common Issues

### Issue 1: Tag Not Found

**Error**: `Tag v1.0.11 not found`

**Solution**:
```bash
# List available tags
git fetch --tags
git tag -l

# Verify tag exists on remote
git ls-remote --tags origin | grep v1.0.11

# If tag doesn't exist, use main branch
BRANCH=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

### Issue 2: npm ci Fails

**Error**: `npm ci failed` or `package-lock.json out of sync`

**Solution**:
```bash
cd secure-ai-chat

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies (will regenerate package-lock.json)
npm install

# Verify installation
npm run type-check
npm run build
```

### Issue 3: Shallow Clone Fails for Tag

**Error**: `Failed to clone tag` or `shallow clone failed`

**Solution**:
```bash
# Use full clone instead
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
git checkout v1.0.11
```

### Issue 4: Node.js Version Mismatch

**Error**: `Node.js version mismatch. Expected v25.2.1`

**Solution**:
```bash
# Install correct Node.js version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 25.2.1
nvm use 25.2.1
nvm alias default 25.2.1

# Verify
node -v  # Should show v25.2.1
```

### Issue 5: Build Fails

**Error**: Build errors or TypeScript errors

**Solution**:
```bash
cd secure-ai-chat

# Clean build artifacts
rm -rf .next node_modules

# Reinstall dependencies
npm install

# Run type check
npm run type-check

# Build
npm run build
```

### Issue 6: Permission Denied

**Error**: `Permission denied` during installation

**Solution**:
```bash
# Don't run as root - script uses sudo when needed
# Ensure your user has sudo privileges

# Fix permissions if needed
sudo chown -R $USER:$USER ~/secure-ai-chat
chmod -R u+w ~/secure-ai-chat
```

---

## 📋 Pre-Installation Checklist

Before installing, ensure:

- [ ] Ubuntu 18.04+ or Debian 10+
- [ ] Internet connection available
- [ ] sudo privileges available
- [ ] At least 1GB free disk space
- [ ] Port 3000 available (or configure different port)

---

## ✅ Post-Installation Validation

After installation, verify:

```bash
cd ~/secure-ai-chat

# 1. Check Node.js version
node -v  # Should show v25.2.1

# 2. Check version from API
curl http://localhost:3000/api/version
# Expected: {"version":"1.0.11"}

# 3. Check health
curl http://localhost:3000/api/health
# Expected: {"status":"ok"}

# 4. Check WAF integration
curl http://localhost:3000/api/waf/health
# Expected: {"waf":{"integrated":true}}
```

---

## 🔄 Quick Fix Script

If installation fails, use this quick fix:

```bash
#!/bin/bash
# Quick fix for v1.0.11 installation issues

cd ~/secure-ai-chat || cd secure-ai-chat || exit 1

echo "=== Fixing Installation Issues ==="

# 1. Ensure correct Node.js version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 25.2.1 || nvm install 25.2.1

# 2. Clean everything
echo "Cleaning build artifacts..."
rm -rf .next node_modules package-lock.json

# 3. Reinstall
echo "Reinstalling dependencies..."
npm install

# 4. Verify
echo "Verifying installation..."
npm run type-check && npm run build

# 5. Check version
echo "Checking version..."
if [ -f "package.json" ]; then
    VERSION=$(grep '"version"' package.json | cut -d'"' -f4)
    echo "Installed version: $VERSION"
fi

echo "=== Fix Complete ==="
```

Save as `fix-install.sh`, make executable: `chmod +x fix-install.sh`, then run: `./fix-install.sh`

---

## 📝 Installation Script Changes

### New Environment Variables

- `TAG` - Specify release tag to checkout (e.g., `TAG=v1.0.11`)
- `BRANCH` - Specify branch (default: `main`)

### Improved Error Messages

- Clearer messages when tag not found
- Suggestions for fixing package-lock.json issues
- Network and disk space error detection

### Better Tag Handling

- Supports shallow clone for tags
- Falls back to full clone if shallow fails
- Validates tag exists before checkout

---

## 🎯 Recommended Installation Command

For clean install of v1.0.11:

```bash
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

This ensures:
- ✅ Correct version (v1.0.11) is installed
- ✅ All dependencies match the release
- ✅ Build artifacts are correct
- ✅ Configuration files are present

---

## 📞 Support

If installation still fails after trying these fixes:

1. **Check logs**: Review installation output for specific errors
2. **Verify prerequisites**: Ensure all system requirements are met
3. **Try manual installation**: Follow Method 2 above
4. **Check GitHub issues**: Look for similar issues in the repository

---

## 🔗 Related Documentation

- [INSTALL.md](./INSTALL.md) - General installation guide
- [INSTALLATION_TROUBLESHOOTING.md](./INSTALLATION_TROUBLESHOOTING.md) - General troubleshooting
- [FRESH_INSTALL_VALIDATION_v1.0.11.md](./FRESH_INSTALL_VALIDATION_v1.0.11.md) - Validation guide
- [QUICK_START_UBUNTU.md](./QUICK_START_UBUNTU.md) - Quick start guide

---

**Fix Version**: 1.0.11  
**Last Updated**: January 16, 2026
