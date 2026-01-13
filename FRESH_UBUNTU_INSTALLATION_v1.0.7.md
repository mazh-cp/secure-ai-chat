# Fresh Ubuntu VM Installation Guide - Version 1.0.7

**Version**: 1.0.7  
**Date**: January 2025  
**Status**: Production Ready

---

## Overview

This guide provides step-by-step instructions for installing Secure AI Chat v1.0.7 on a fresh Ubuntu VM. The installation follows all release gate requirements and ensures the application is fully functional.

---

## Prerequisites

- **Ubuntu 18.04+** or Debian 10+ (fresh installation)
- **Internet connection** for downloading dependencies
- **sudo privileges** on the VM
- **GitHub repository access** (repository must be pushed to GitHub)

---

## Quick Installation (Single Command)

⚠️ **IMPORTANT**: Before using the remote installation script, ensure the repository is pushed to GitHub with version 1.0.7:

```bash
# From your local development machine:
cd secure-ai-chat
git tag v1.0.7
git push origin v1.0.7
git push origin main
```

**On your Ubuntu VM**, run:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

Or using wget:

```bash
wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

---

## Manual Installation Steps

If you prefer manual installation or need to customize the process:

### Step 1: Update System Packages

```bash
sudo apt-get update
sudo apt-get install -y curl git build-essential ca-certificates gnupg lsb-release iproute2
```

### Step 2: Install Node.js v25.2.1 via nvm

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use Node.js v25.2.1
nvm install 25.2.1
nvm use 25.2.1
nvm alias default 25.2.1

# Verify installation
node -v  # Should output: v25.2.1
npm -v
```

### Step 3: Clone Repository

```bash
# Clone the repository (default: ~/secure-ai-chat)
cd ~
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat

# Verify version 1.0.7
git checkout v1.0.7  # Or use: git checkout main (if v1.0.7 is latest)
cat package.json | grep '"version"'
# Should show: "version": "1.0.7"
```

### Step 4: Install Dependencies

```bash
# Ensure Node.js v25.2.1 is active
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 25.2.1

# Install dependencies
npm ci

# Verify installation
npm list --depth=0
```

### Step 5: Configure Environment

```bash
# Create .env.local from template (if .env.example exists)
if [ -f .env.example ]; then
    cp .env.example .env.local
    echo "✅ Created .env.local from .env.example"
else
    # Create basic .env.local
    cat > .env.local << 'EOF'
# Secure AI Chat Environment Configuration
# Version 1.0.7

# Server Configuration
HOSTNAME=0.0.0.0
PORT=3000
NODE_ENV=production

# Required: OpenAI API Key
OPENAI_API_KEY=your-openai-api-key-here

# Optional: Lakera AI (for file scanning)
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=

# Optional: Check Point ThreatEmulation
# CHECKPOINT_TE_API_KEY=your-checkpoint-te-api-key-here
EOF
    echo "✅ Created .env.local"
fi

# Edit environment file
nano .env.local
# Add your API keys (at minimum: OPENAI_API_KEY)
```

### Step 6: Run Release Gate Verification

Before building, verify the installation meets release gate requirements:

```bash
# Run release gate script
npm run release-gate
```

**Expected Output**: All checks should PASS. If any check fails, fix the issues before proceeding.

The release gate script verifies:
- ✅ Clean install (npm ci)
- ✅ TypeScript compilation
- ✅ ESLint validation
- ✅ Security checks (no API keys in client code)
- ✅ Production build
- ✅ Build output security scan
- ✅ Git secret scan

### Step 7: Build Application

```bash
# Ensure Node.js v25.2.1 is active
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 25.2.1

# Build production bundle
npm run build

# Verify build
ls -la .next/
# Should show build artifacts
```

### Step 8: Configure Firewall (UFW)

```bash
# Allow SSH (to prevent lockout)
sudo ufw allow 22/tcp

# Allow application port
sudo ufw allow 3000/tcp

# Enable firewall (if not already enabled)
echo "y" | sudo ufw enable

# Verify rules
sudo ufw status numbered
```

### Step 9: Configure systemd Service (Recommended for Production)

Create a systemd service for automatic startup and restart:

```bash
# Find Node.js path
which node
# Example output: /home/ubuntu/.nvm/versions/node/v25.2.1/bin/node

which npm
# Example output: /home/ubuntu/.nvm/versions/node/v25.2.1/bin/npm

# Get current user and home directory
CURRENT_USER=$(whoami)
HOME_DIR=$(eval echo ~$CURRENT_USER)
INSTALL_DIR="$HOME_DIR/secure-ai-chat"

# Create systemd service file
sudo tee /etc/systemd/system/secure-ai-chat.service > /dev/null << EOF
[Unit]
Description=Secure AI Chat Application v1.0.7
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOSTNAME=0.0.0.0"

# Use nvm-installed Node.js v25.2.1
ExecStart=$HOME_DIR/.nvm/versions/node/v25.2.1/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

# Security
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=$INSTALL_DIR/.secure-storage $INSTALL_DIR/.next

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable secure-ai-chat

# Start service
sudo systemctl start secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat
```

### Step 10: Verify Installation

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check application is listening
sudo ss -tlnp | grep :3000
# Should show: 0.0.0.0:3000 (NOT 127.0.0.1:3000)

# Test health endpoint
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"...","service":"secure-ai-chat"}

# Test version endpoint
curl http://localhost:3000/api/version
# Expected: {"version":"1.0.7","name":"secure-ai-chat"}

# View logs
sudo journalctl -u secure-ai-chat -f
```

### Step 11: Access Application

```bash
# Get VM IP address
hostname -I | awk '{print $1}'
# Or: curl ifconfig.me

# Access application
# Local: http://localhost:3000
# Network: http://YOUR_VM_IP:3000
```

**Important**: If accessing from outside the VM, ensure:
- UFW firewall allows port 3000 (Step 8)
- Cloud provider firewall (AWS Security Groups, GCP Firewall Rules, Azure NSG) allows port 3000

---

## Post-Installation Verification

### Release Gate Validation

After installation, verify all release gate requirements:

```bash
cd ~/secure-ai-chat

# Run release gate script
npm run release-gate

# Expected: All checks PASS
```

### Installation Validation

Run the comprehensive installation validation script:

```bash
# If the script exists
bash scripts/validate-installation.sh

# Or manually verify:
# 1. Type check
npm run type-check

# 2. Build verification
npm run build

# 3. Service status
sudo systemctl status secure-ai-chat

# 4. Health endpoint
curl http://localhost:3000/api/health

# 5. Version endpoint
curl http://localhost:3000/api/version
```

### Functional Testing

1. **Access the application** in a browser
2. **Test chat functionality** (requires OPENAI_API_KEY)
3. **Test file upload** (if LAKERA_AI_KEY is configured)
4. **Test theme toggle** (light/dark mode)
5. **Verify theme persists** after page refresh
6. **Test settings page** and API key configuration

---

## Release Gate Checklist (v1.0.7)

All items below **MUST PASS** before considering installation complete:

| Check | Command | Status |
|-------|---------|--------|
| **Clean Install** | `npm ci` | ⬜ |
| **TypeScript Compilation** | `npm run type-check` | ⬜ |
| **ESLint Validation** | `npm run lint` | ⬜ |
| **Security: Client Key Leakage** | `npm run release-gate` | ⬜ |
| **Security: Build Output Scan** | `npm run release-gate` | ⬜ |
| **Production Build** | `npm run build` | ⬜ |
| **Service Running** | `sudo systemctl status secure-ai-chat` | ⬜ |
| **Health Endpoint** | `curl http://localhost:3000/api/health` | ⬜ |
| **Version Endpoint** | `curl http://localhost:3000/api/version` | ⬜ |
| **Application Accessible** | Browser: `http://YOUR_VM_IP:3000` | ⬜ |

---

## Troubleshooting

### Issue: Node.js version incorrect

**Solution**:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 25.2.1
node -v  # Verify: v25.2.1
```

### Issue: Build fails

**Solution**:
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm ci
npm run build
```

### Issue: Service fails to start

**Solution**:
```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 50

# Verify Node.js path in service file
sudo systemctl show secure-ai-chat --property=ExecStart

# Update service file if path is incorrect
sudo nano /etc/systemd/system/secure-ai-chat.service
# Update ExecStart path to correct npm path
sudo systemctl daemon-reload
sudo systemctl restart secure-ai-chat
```

### Issue: Application not accessible externally

**Check**:
1. Application binding: `sudo ss -tlnp | grep :3000` (should show `0.0.0.0:3000`)
2. UFW firewall: `sudo ufw status` (port 3000 should be allowed)
3. Cloud provider firewall (AWS Security Groups, GCP Firewall Rules, Azure NSG)

**Solution**:
- If binding to `127.0.0.1`, ensure `HOSTNAME=0.0.0.0` in `.env.local` or service file
- If UFW blocking, allow port: `sudo ufw allow 3000/tcp`
- If cloud firewall blocking, configure inbound rule for port 3000

### Issue: Release gate fails

**Solution**:
```bash
# Run release gate to see specific failures
npm run release-gate

# Common fixes:
# - TypeScript errors: Fix type issues
# - ESLint errors: Fix linting issues
# - Security issues: Remove API keys from client code
# - Build failures: Check build logs for errors
```

### Issue: Version mismatch

**Solution**:
```bash
# Verify version in package.json
cat package.json | grep '"version"'

# If not 1.0.7, checkout correct version:
git checkout v1.0.7
# Or: git pull origin main
npm ci
npm run build
sudo systemctl restart secure-ai-chat
```

---

## Cloud Provider Specific Configuration

### AWS EC2

1. **Security Groups**:
   - Go to EC2 Dashboard → Security Groups
   - Select your instance's security group
   - Add inbound rule: Port 3000 (TCP) from `0.0.0.0/0` (or specific IP)

### Google Cloud Platform (GCP)

1. **Firewall Rules**:
   - Go to VPC Network → Firewall
   - Create new rule: Allow TCP port 3000 from `0.0.0.0/0`
   - Apply to all targets or specific VM tags

### Microsoft Azure

1. **Network Security Group (NSG)**:
   - Go to VM → Networking → Inbound port rules
   - Add inbound rule: Allow TCP port 3000 from Any source IP
   - Or configure NSG rules directly

### DigitalOcean

1. **Firewall**:
   - Go to Networking → Firewalls
   - Add inbound rule: TCP port 3000 from all IPv4/IPv6

### Linode

1. **Firewall**:
   - Go to Firewalls → Create Firewall
   - Add inbound rule: TCP port 3000 from all IPv4/IPv6

---

## Uninstallation

To remove the application:

```bash
# Stop and disable service
sudo systemctl stop secure-ai-chat
sudo systemctl disable secure-ai-chat
sudo rm /etc/systemd/system/secure-ai-chat.service
sudo systemctl daemon-reload

# Remove installation directory
rm -rf ~/secure-ai-chat

# Optional: Remove Node.js (if not used elsewhere)
# Remove nvm
rm -rf ~/.nvm
# Remove from ~/.bashrc or ~/.zshrc (remove nvm lines)
```

---

## Summary

✅ **Installation Complete** when:
- Release gate script passes: `npm run release-gate`
- Service is running: `sudo systemctl status secure-ai-chat`
- Health endpoint responds: `curl http://localhost:3000/api/health`
- Version endpoint shows 1.0.7: `curl http://localhost:3000/api/version`
- Application is accessible: Browser loads `http://YOUR_VM_IP:3000`

---

**Version**: 1.0.7  
**Last Updated**: January 2025  
**Status**: ✅ Production Ready
