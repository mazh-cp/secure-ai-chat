# Fix: "fatal: not a git repository" Error

If you're getting this error, your installation directory is not a git repository. This script fixes it without creating duplicate installations.

## Quick Fix

Run this on your remote VM:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/1.0.8/scripts/fix_git_repo.sh | bash
```

## What It Does

1. **Stops service** - Safely stops the application
2. **Creates backup** - Backs up all settings (.env.local, .secure-storage)
3. **Fixes git repository**:
   - If .git exists but is invalid → Re-initializes
   - If .git doesn't exist → Re-clones repository
   - Preserves all your settings
4. **Restores settings** - All API keys and configurations preserved
5. **Rebuilds** - Installs dependencies and rebuilds
6. **Restarts** - Starts the service

## Manual Fix (If Script Fails)

```bash
# 1. Stop service
sudo systemctl stop secure-ai-chat

# 2. Backup settings
BACKUP_DIR="/tmp/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a /opt/secure-ai-chat/.env.local "$BACKUP_DIR/.env.local" 2>/dev/null || true
sudo cp -a /opt/secure-ai-chat/.secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true

# 3. Check if .git exists
cd /opt/secure-ai-chat
if [ -d ".git" ]; then
    # Try to fix existing repo
    sudo -u secureai git remote add origin https://github.com/mazh-cp/secure-ai-chat.git 2>/dev/null || true
    sudo -u secureai git fetch origin
    sudo -u secureai git pull origin main || sudo -u secureai git pull origin release/1.0.8
else
    # Re-clone repository
    sudo rm -rf /opt/secure-ai-chat
    sudo mkdir -p /opt/secure-ai-chat
    sudo chown secureai:secureai /opt/secure-ai-chat
    sudo -u secureai git clone https://github.com/mazh-cp/secure-ai-chat.git /opt/secure-ai-chat
    
    # Restore settings
    if [ -f "$BACKUP_DIR/.env.local" ]; then
        sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
        sudo chown secureai:secureai /opt/secure-ai-chat/.env.local
    fi
    if [ -d "$BACKUP_DIR/.secure-storage" ]; then
        sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
        sudo chown -R secureai:secureai /opt/secure-ai-chat/.secure-storage
    fi
fi

# 4. Install and build
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci && npm run build
EOF

# 5. Start service
sudo systemctl start secure-ai-chat

# 6. Verify
sleep 3
curl http://localhost:3000/api/version
```

## Verify Fix

After running the fix:

```bash
# Check git repository
cd /opt/secure-ai-chat
sudo -u secureai git status

# Check version
curl http://localhost:3000/api/version

# Check service
sudo systemctl status secure-ai-chat
```

## Important Notes

- **No duplicate installations** - The script works in the same directory
- **All settings preserved** - API keys and configurations are backed up and restored
- **Single repository** - Only one git repository in `/opt/secure-ai-chat`
- **Safe operation** - Creates backups before making changes
