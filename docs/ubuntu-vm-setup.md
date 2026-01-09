# Ubuntu VM Setup Guide - Node.js v25.2.1

This guide provides step-by-step instructions for setting up Secure AI Chat on a fresh Ubuntu VM with Node.js v25.2.1.

## Prerequisites

- Ubuntu 18.04+ or Debian 10+
- Internet connection
- sudo privileges

## Step 1: Install Prerequisites

```bash
sudo apt update
sudo apt install -y curl git build-essential
```

## Step 2: Install nvm (Node Version Manager)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

## Step 3: Load nvm

For the current shell session:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

To make nvm available in all new shell sessions, add the above lines to your `~/.bashrc` or `~/.zshrc`:
```bash
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> ~/.bashrc
source ~/.bashrc
```

## Step 4: Install and Use Node.js v25.2.1

```bash
# Install Node.js v25.2.1
nvm install 25.2.1

# Use Node.js v25.2.1
nvm use 25.2.1

# Set as default version
nvm alias default 25.2.1
```

## Step 5: Verify Installation

```bash
# Verify Node.js version (must print v25.2.1)
node -v

# Verify npm is available
npm -v
```

Expected output:
```
v25.2.1
10.x.x (or similar)
```

## Step 6: Clone and Build Application

```bash
# Clone the repository
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat

# Ensure Node.js v25.2.1 is active (uses .nvmrc)
nvm use 25.2.1

# Install dependencies
npm ci

# Build the application
npm run build
```

## Step 7: Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit environment file (add your API keys)
nano .env.local
# OR use your preferred editor: vim, code, etc.

# Minimum required: Add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-key-here
# HOSTNAME=0.0.0.0
# PORT=3000
```

## Step 8: Start the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Step 9: Verify Application is Running

```bash
# Check if app is listening on port 3000
sudo ss -tlnp | grep :3000
# Should show: tcp LISTEN 0 511 0.0.0.0:3000

# Test health endpoint
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"...","service":"secure-ai-chat"}
```

## Step 10: Configure systemd Service (Production)

### Find Node.js Path

After installing Node.js v25.2.1 via nvm, find the absolute path:

```bash
which node
# Example output: /home/ubuntu/.nvm/versions/node/v25.2.1/bin/node

# Get npm path
which npm
# Example output: /home/ubuntu/.nvm/versions/node/v25.2.1/bin/npm
```

### Create systemd Service File

```bash
sudo nano /etc/systemd/system/secure-ai-chat.service
```

Paste the following (update paths if your user is not `ubuntu`):

```ini
[Unit]
Description=Secure AI Chat Application
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/secure-ai-chat
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOSTNAME=0.0.0.0"

# Ensure nvm-installed Node v25.2.1 is used
# IMPORTANT: Update the path below to match your actual nvm Node installation path
ExecStart=/home/ubuntu/.nvm/versions/node/v25.2.1/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

[Install]
WantedBy=multi-user.target
```

**Important**: Replace `/home/ubuntu` with your actual home directory path if different.

### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable secure-ai-chat

# Start service
sudo systemctl start secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat
```

### Verify systemd Configuration

```bash
# Verify ExecStart path
sudo systemctl show secure-ai-chat --property=ExecStart

# View logs
sudo journalctl -u secure-ai-chat -f
```

## Troubleshooting

### Node.js Version Mismatch

If you see a different Node.js version:

```bash
# Check current version
node -v

# Use correct version
nvm use 25.2.1

# Verify
node -v  # Should show v25.2.1
```

### systemd Can't Find Node

If systemd service fails with "node: command not found":

1. Find the correct path:
   ```bash
   which node
   ```

2. Update the systemd service file with the absolute path:
   ```bash
   sudo nano /etc/systemd/system/secure-ai-chat.service
   ```

3. Update `ExecStart` line with the correct path

4. Reload and restart:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart secure-ai-chat
   ```

### nvm Not Available in New Shell

Add to `~/.bashrc`:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

Then reload:
```bash
source ~/.bashrc
```

## Quick Reference

**Install Node.js v25.2.1:**
```bash
nvm install 25.2.1
nvm use 25.2.1
nvm alias default 25.2.1
```

**Verify Node.js version:**
```bash
node -v  # Must show v25.2.1
```

**Check systemd service:**
```bash
sudo systemctl status secure-ai-chat
sudo journalctl -u secure-ai-chat -f
```
