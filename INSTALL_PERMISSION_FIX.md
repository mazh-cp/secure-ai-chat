# Installation Permission Fix - v1.0.11

**Issue**: Permission denied when cloning repository  
**Status**: ✅ FIXED

---

## 🔍 Problem

The installation script was trying to clone to `/opt/secure-ai-chat` which requires root permissions, causing:

```
fatal: could not create work tree dir 'secure-ai-chat': Permission denied
```

---

## ✅ Fix Applied

### 1. Smart Directory Selection

The script now:

- **Defaults to `$HOME`** (user's home directory) - no permission issues
- **Auto-detects** if `/opt` is writable
- **Falls back** to `$HOME` if `/opt` is not accessible
- **Allows override** via `INSTALL_DIR` environment variable

### 2. Permission Verification

Before cloning, the script:

- Checks if directory is writable
- Creates directories with proper ownership
- Fixes permissions if needed
- Exits early with clear error if permissions can't be fixed

### 3. Better Error Messages

If permissions fail, the script provides:

- Clear error message
- Suggestion to use `$HOME` instead
- Instructions for manual fix

---

## 🚀 Usage

### Default (Recommended - No Permission Issues)

```bash
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
```

**Installs to**: `~/secure-ai-chat` (your home directory)

### Custom Directory

```bash
# Install to /opt (script will handle permissions)
INSTALL_DIR=/opt TAG=v1.0.11 curl -fsSL ... | bash

# Install to custom location
INSTALL_DIR=/home/myuser/apps TAG=v1.0.11 curl -fsSL ... | bash
```

---

## 🔧 What Changed

### Before

- Default: `/opt/secure-ai-chat` (requires root)
- No permission checks before clone
- Failed with permission denied

### After

- Default: `~/secure-ai-chat` (user-writable)
- Permission checks before clone
- Auto-fallback if /opt not writable
- Clear error messages

---

## 📋 Installation Locations

### Option 1: Home Directory (Default - Recommended)

```
~/secure-ai-chat
```

- ✅ No permission issues
- ✅ User has full control
- ✅ Easy to manage

### Option 2: /opt (System Directory)

```
/opt/secure-ai-chat
```

- Requires sudo for creation
- Script handles permissions automatically
- More "system-like" location

---

## 🛠️ Manual Fix (If Still Having Issues)

If you still get permission errors:

### Option 1: Use Home Directory

```bash
# Force home directory
INSTALL_DIR=$HOME TAG=v1.0.11 curl -fsSL ... | bash
```

### Option 2: Fix /opt Permissions First

```bash
# Create directory with proper permissions
sudo mkdir -p /opt/secure-ai-chat
sudo chown $USER:$USER /opt/secure-ai-chat
chmod u+w /opt/secure-ai-chat

# Then run installation
INSTALL_DIR=/opt TAG=v1.0.11 curl -fsSL ... | bash
```

### Option 3: Clone Manually

```bash
# Clone to home directory
cd ~
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat
git checkout v1.0.11

# Then run installation script locally
bash scripts/install-ubuntu-v1.0.11.sh
```

---

## ✅ Verification

After installation, verify:

```bash
# Check installation location
ls -la ~/secure-ai-chat
# OR
ls -la /opt/secure-ai-chat

# Check service (if installed to /opt, path will be different)
sudo systemctl status secure-ai-chat

# Check service file location
sudo cat /etc/systemd/system/secure-ai-chat.service | grep WorkingDirectory
```

---

## 🎯 Quick Fix Command

If you're getting permission errors right now:

```bash
# Install to home directory (no permission issues)
INSTALL_DIR=$HOME TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
```

This will install to `~/secure-ai-chat` where you have full write permissions.

---

**Fix Version**: 1.0.11  
**Last Updated**: January 16, 2026
