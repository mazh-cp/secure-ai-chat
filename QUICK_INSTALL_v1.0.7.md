# Quick Installation Guide - Version 1.0.7

**Version**: 1.0.7  
**Target**: Fresh Ubuntu VM  
**Time**: ~10-15 minutes

---

## Prerequisites

- Fresh Ubuntu 18.04+ VM
- sudo privileges
- Internet connection
- GitHub repository pushed with v1.0.7

---

## Single-Command Installation

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

**Note**: Replace `mazh-cp/secure-ai-chat` with your GitHub username and repository name.

---

## Post-Installation Steps

### 1. Configure Environment

```bash
cd ~/secure-ai-chat
nano .env.local
```

**Add required API keys**:
```bash
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Configure systemd Service (Production)

```bash
# Find Node.js path
which npm
# Example: /home/ubuntu/.nvm/versions/node/v25.2.1/bin/npm

# Get current user
CURRENT_USER=$(whoami)
HOME_DIR=$(eval echo ~$CURRENT_USER)

# Create systemd service
sudo tee /etc/systemd/system/secure-ai-chat.service > /dev/null << EOF
[Unit]
Description=Secure AI Chat Application v1.0.7
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$HOME_DIR/secure-ai-chat
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOSTNAME=0.0.0.0"
ExecStart=$HOME_DIR/.nvm/versions/node/v25.2.1/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat
```

### 3. Verify Installation

```bash
# Check service
sudo systemctl status secure-ai-chat

# Check health
curl http://localhost:3000/api/health

# Check version
curl http://localhost:3000/api/version

# Get VM IP
hostname -I | awk '{print $1}'
```

### 4. Access Application

- **Local**: http://localhost:3000
- **Network**: http://YOUR_VM_IP:3000

---

## Release Gate Verification (Optional but Recommended)

```bash
cd ~/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 25.2.1
npm run release-gate
```

**Expected**: All checks PASS ✅

---

## Troubleshooting

### Service Not Starting

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 50

# Verify Node.js path
which npm
# Update ExecStart path in service file if different
```

### Cannot Access from Outside VM

```bash
# Check if listening on 0.0.0.0
sudo ss -tlnp | grep :3000
# Should show: 0.0.0.0:3000

# Check firewall
sudo ufw status
sudo ufw allow 3000/tcp

# Check cloud provider firewall (AWS Security Groups, GCP Firewall Rules, etc.)
```

---

## Full Documentation

For detailed instructions, see:
- **FRESH_UBUNTU_INSTALLATION_v1.0.7.md** - Complete installation guide
- **DEPLOYMENT_CHECKLIST_v1.0.7.md** - Deployment checklist
- **INSTALL.md** - General installation guide

---

**Version**: 1.0.7  
**Status**: ✅ Production Ready
