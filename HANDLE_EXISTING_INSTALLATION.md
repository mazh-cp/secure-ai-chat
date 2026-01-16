# Handling Existing Installation

When you see the error:
```
fatal: destination path 'secure-ai-chat' already exists and is not an empty directory.
```

You have several options:

## Option 1: Use Clean Install Script (Recommended)

```bash
cd ~
bash <(curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/clean-install.sh)
```

Or if you already have the repo:
```bash
cd ~/secure-ai-chat
bash scripts/clean-install.sh
```

This will:
- Stop the service (if running)
- Remove existing installation
- Perform fresh installation

## Option 2: Manual Clean Install

```bash
# Stop service
sudo systemctl stop secure-ai-chat

# Remove existing directory
rm -rf ~/secure-ai-chat

# Run installation with CLEAN_INSTALL flag
CLEAN_INSTALL=true TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
```

## Option 3: Update Existing Installation

If you want to keep your existing installation and just update:

```bash
cd ~/secure-ai-chat

# Stop service
sudo systemctl stop secure-ai-chat

# Update repository
git fetch origin --tags
git checkout v1.0.11

# Update dependencies
npm ci

# Rebuild
npm run build

# Restart service
sudo systemctl start secure-ai-chat
```

## Option 4: Install to Different Directory

```bash
# Install to /opt instead
INSTALL_DIR=/opt TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash

# Or custom directory
INSTALL_DIR=/home/adminuser/apps TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash
```

## Quick Commands

### Check Current Installation
```bash
# Check if directory exists
ls -la ~/secure-ai-chat

# Check service status
sudo systemctl status secure-ai-chat

# Check current version
cd ~/secure-ai-chat && git describe --tags 2>/dev/null || echo "Not a git repo"
```

### Backup Before Clean Install
```bash
# Backup API keys (if you want to preserve them)
sudo cp -r ~/secure-ai-chat/.secure-storage ~/secure-storage-backup

# Backup .env.local
cp ~/secure-ai-chat/.env.local ~/env-local-backup 2>/dev/null || true
```

### Restore After Clean Install
```bash
# Restore API keys
sudo cp -r ~/secure-storage-backup ~/secure-ai-chat/.secure-storage
sudo chmod 700 ~/secure-ai-chat/.secure-storage
sudo chmod 600 ~/secure-ai-chat/.secure-storage/*.enc

# Restore .env.local
cp ~/env-local-backup ~/secure-ai-chat/.env.local
```

## Recommended Approach

For a **fresh, clean installation**:

```bash
# 1. Stop service
sudo systemctl stop secure-ai-chat

# 2. Remove existing
rm -rf ~/secure-ai-chat

# 3. Fresh install
TAG=v1.0.11 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-v1.0.11.sh | bash

# 4. Validate
cd ~/secure-ai-chat
bash scripts/validate-fresh-install.sh
```

## Troubleshooting

### Permission Denied
```bash
# If you get permission errors, use sudo for removal
sudo rm -rf ~/secure-ai-chat
```

### Service Won't Stop
```bash
# Force stop
sudo systemctl stop secure-ai-chat
sudo pkill -f "secure-ai-chat" || true
```

### Directory Locked
```bash
# Check what's using it
lsof +D ~/secure-ai-chat

# Kill processes if needed
sudo pkill -f "node.*secure-ai-chat" || true
```
