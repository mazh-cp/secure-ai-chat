# Fix: Remote Still Showing Version 1.0.7

If your remote installation is still showing version 1.0.7 after upgrade, run these commands:

## Step 1: Check Current Branch and Version

```bash
cd /opt/secure-ai-chat
sudo -u secureai git branch
sudo cat package.json | grep '"version"'
```

## Step 2: Pull from Correct Branch

The version 1.0.8 is on `release/1.0.8` branch. You need to either:

### Option A: Checkout release/1.0.8 branch

```bash
cd /opt/secure-ai-chat

# Stop service
sudo systemctl stop secure-ai-chat

# Backup settings
BACKUP_DIR="/opt/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a /opt/secure-ai-chat/.env.local "$BACKUP_DIR/.env.local" 2>/dev/null || true
sudo cp -a /opt/secure-ai-chat/.secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true

# Fetch all branches
sudo -u secureai git fetch origin

# Checkout release/1.0.8 branch
sudo -u secureai git checkout release/1.0.8

# Restore settings
if [ -f "$BACKUP_DIR/.env.local" ]; then
    sudo cp -a "$BACKUP_DIR/.env.local" /opt/secure-ai-chat/.env.local
    sudo chown secureai:secureai /opt/secure-ai-chat/.env.local
fi
if [ -d "$BACKUP_DIR/.secure-storage" ]; then
    sudo cp -a "$BACKUP_DIR/.secure-storage" /opt/secure-ai-chat/.secure-storage
    sudo chown -R secureai:secureai /opt/secure-ai-chat/.secure-storage
fi

# Verify version
sudo cat package.json | grep '"version"'
# Should show: "version": "1.0.8"

# Install dependencies
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci
EOF

# Build
cd /opt/secure-ai-chat
sudo -u secureai bash << 'EOF'
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build
EOF

# Start service
sudo systemctl start secure-ai-chat

# Verify
sleep 3
curl http://localhost:3000/api/version
# Should show: {"version":"1.0.8","name":"secure-ai-chat"}
```

### Option B: Update main branch (if main has 1.0.8)

If version 1.0.8 is also on main branch:

```bash
cd /opt/secure-ai-chat

# Stop service
sudo systemctl stop secure-ai-chat

# Backup
BACKUP_DIR="/opt/secure-ai-chat-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a /opt/secure-ai-chat/.env.local "$BACKUP_DIR/.env.local" 2>/dev/null || true
sudo cp -a /opt/secure-ai-chat/.secure-storage "$BACKUP_DIR/.secure-storage" 2>/dev/null || true

# Pull latest from main
sudo -u secureai git fetch origin
sudo -u secureai git checkout main
sudo -u secureai git pull origin main

# Verify version
sudo cat package.json | grep '"version"'

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

## Quick Diagnostic Commands

```bash
# Check what branch you're on
cd /opt/secure-ai-chat
sudo -u secureai git branch

# Check current version in package.json
sudo cat /opt/secure-ai-chat/package.json | grep '"version"'

# Check version endpoint
curl http://localhost:3000/api/version

# Check service logs
sudo journalctl -u secure-ai-chat -n 30
```

## Why This Happened

The remote installation is likely on the `main` branch, which still has version 1.0.7. Version 1.0.8 is currently on the `release/1.0.8` branch. You need to either:
1. Checkout the `release/1.0.8` branch, OR
2. Merge `release/1.0.8` to `main` (if you have merge permissions)
