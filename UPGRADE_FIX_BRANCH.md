# Fix: Branch Not Found - Complete Upgrade Steps

## Step-by-Step: Upgrade from 1.0.7 to 1.0.8

Run these commands on your remote VM:

```bash
# 1. Navigate to installation
cd /opt/secure-ai-chat

# 2. Stop service
sudo systemctl stop secure-ai-chat

# 3. Create backup
BACKUP_DIR="/opt/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a /opt/secure-ai-chat/.env.local "$BACKUP_DIR/.env.local" 2>/dev/null || true
sudo cp -a /opt/secure-ai-chat/.secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true
echo "✓ Backup: $BACKUP_DIR"

# 4. Fetch ALL branches from remote
sudo -u secureai git fetch origin

# 5. Check available branches
sudo -u secureai git branch -r

# 6. Checkout release/1.0.8 branch (creates local tracking branch)
sudo -u secureai git checkout -b release/1.0.8 origin/release/1.0.8

# 7. Verify version
sudo cat package.json | grep '"version"'
# Should show: "version": "1.0.8"

# 8. Restore settings
if [ -f "$BACKUP_DIR/.env.local" ]; then
    sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
    sudo chown secureai:secureai /opt/secure-ai-chat/.env.local
fi
if [ -d "$BACKUP_DIR/.secure-storage" ]; then
    sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
    sudo chown -R secureai:secureai /opt/secure-ai-chat/.secure-storage
fi

# 9. Install dependencies
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci
EOF

# 10. Build
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build
EOF

# 11. Start service
sudo systemctl start secure-ai-chat

# 12. Verify
sleep 3
curl http://localhost:3000/api/version
sudo systemctl status secure-ai-chat
```

## Alternative: If Branch Still Not Found

If `origin/release/1.0.8` doesn't exist, merge the changes to main branch instead:

```bash
cd /opt/secure-ai-chat
sudo systemctl stop secure-ai-chat

# Backup
BACKUP_DIR="/opt/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a /opt/secure-ai-chat/.env.local "$BACKUP_DIR/.env.local" 2>/dev/null || true
sudo cp -a /opt/secure-ai-chat/.secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true

# Switch to main and pull
sudo -u secureai git checkout main
sudo -u secureai git fetch origin
sudo -u secureai git pull origin main

# Manually update package.json version
sudo sed -i 's/"version": "1.0.7"/"version": "1.0.8"/' /opt/secure-ai-chat/package.json

# Restore settings
if [ -f "$BACKUP_DIR/.env.local" ]; then
    sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
    sudo chown secureai:secureai /opt/secure-ai-chat/.env.local
fi
if [ -d "$BACKUP_DIR/.secure-storage" ]; then
    sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
    sudo chown -R secureai:secureai /opt/secure-ai-chat/.secure-storage
fi

# Install, build, restart
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci && npm run build
EOF

sudo systemctl start secure-ai-chat
sleep 3
curl http://localhost:3000/api/version
```
