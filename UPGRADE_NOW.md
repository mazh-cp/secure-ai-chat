# Upgrade Now - Remote Installation v1.0.7 → v1.0.8

## Quick Fix: Use Branch-Specific URL

Since the upgrade script is on `release/1.0.8` branch, use this URL:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/1.0.8/scripts/upgrade_remote.sh | bash
```

## Alternative: Manual Upgrade (Works Immediately)

Run these commands on your remote VM:

```bash
# 1. Create backup
BACKUP_DIR="/opt/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a /opt/secure-ai-chat/.env.local "$BACKUP_DIR/.env.local" 2>/dev/null || true
sudo cp -a /opt/secure-ai-chat/.secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true
echo "Backup created at: $BACKUP_DIR"

# 2. Stop service
sudo systemctl stop secure-ai-chat

# 3. Pull latest code
cd /opt/secure-ai-chat
BRANCH=$(sudo -u secureai git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
sudo -u secureai git fetch origin
sudo -u secureai git pull origin "$BRANCH"

# 4. Restore settings (if .env.local was overwritten)
if [ -f "$BACKUP_DIR/.env.local" ]; then
    sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
    sudo chown secureai:secureai /opt/secure-ai-chat/.env.local
fi
if [ -d "$BACKUP_DIR/.secure-storage" ]; then
    sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
    sudo chown -R secureai:secureai /opt/secure-ai-chat/.secure-storage
fi

# 5. Install dependencies
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci
EOF

# 6. Build
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build
EOF

# 7. Start service
sudo systemctl start secure-ai-chat

# 8. Verify
sleep 3
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/version
```

## Verify Upgrade

After upgrade, check version:

```bash
curl http://localhost:3000/api/version
# Should show: {"version":"1.0.8","name":"secure-ai-chat"}
```

## If Service Fails

Check logs:

```bash
sudo journalctl -u secure-ai-chat -n 50
```

If you need to rollback, restore from backup:

```bash
BACKUP_DIR="/opt/secure-ai-chat-backup-YYYYMMDD-HHMMSS"  # Use your backup directory
sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
cd /opt/secure-ai-chat
sudo -u secureai git checkout v1.0.7  # Or previous version
# Rebuild and restart as above
```
