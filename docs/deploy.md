# Deployment Guide - Secure AI Chat

This guide provides step-by-step instructions for deploying Secure AI Chat updates on an Ubuntu VM with Node.js v25.2.1.

## Prerequisites

- Ubuntu VM with Secure AI Chat already installed
- Node.js v25.2.1 installed via nvm
- systemd service configured and running
- Git repository cloned at `/opt/secure-ai-chat` (or your installation directory)
- sudo privileges

## Deployment Steps

### Step 1: Navigate to Application Directory

```bash
cd /opt/secure-ai-chat
```

**Note**: If your installation is in a different location, update the path accordingly.

### Step 2: Pull Latest Changes

```bash
git pull origin main
```

Or if using a different branch:
```bash
git pull origin <branch-name>
```

### Step 3: Load nvm and Use Node.js v25.2.1

**Critical**: This step ensures the correct Node.js version is used during deployment.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 25.2.1
```

**Verify Node.js version**:
```bash
node -v
# Must output: v25.2.1
```

If the version is incorrect, install it:
```bash
nvm install 25.2.1
nvm use 25.2.1
nvm alias default 25.2.1
```

### Step 4: Install Dependencies

```bash
npm ci
```

**Note**: `npm ci` is preferred over `npm install` for production deployments as it:
- Installs exact versions from `package-lock.json`
- Removes `node_modules` before installing (clean install)
- Fails if `package-lock.json` is out of sync

### Step 5: Build Application

```bash
npm run build
```

This will:
- Run TypeScript type checking
- Run ESLint
- Build the production bundle
- Generate static pages

**Expected output**: Build should complete successfully with no errors.

### Step 6: Restart Service

```bash
sudo systemctl restart secure-ai-chat
```

### Step 7: Verify Deployment

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"...","service":"secure-ai-chat"}
```

## Complete Deployment Script

For convenience, you can create a deployment script:

```bash
#!/bin/bash
set -euo pipefail

cd /opt/secure-ai-chat

echo "📥 Pulling latest changes..."
git pull origin main

echo "🔧 Loading nvm and Node.js v25.2.1..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 25.2.1

echo "✅ Verifying Node.js version..."
node -v

echo "📦 Installing dependencies..."
npm ci

echo "🔨 Building application..."
npm run build

echo "🔄 Restarting service..."
sudo systemctl restart secure-ai-chat

echo "⏳ Waiting for service to start..."
sleep 3

echo "✅ Checking service status..."
sudo systemctl status secure-ai-chat --no-pager

echo "🏥 Testing health endpoint..."
curl -s http://localhost:3000/api/health | jq . || curl -s http://localhost:3000/api/health

echo "✨ Deployment complete!"
```

Save this as `deploy.sh` in your home directory and make it executable:
```bash
chmod +x ~/deploy.sh
```

Then run:
```bash
~/deploy.sh
```

## Restart-Proof Verification

After deployment, verify the application is restart-proof:

### 1. Test Service Restart

```bash
# Restart the service
sudo systemctl restart secure-ai-chat

# Wait a few seconds
sleep 5

# Check status
sudo systemctl status secure-ai-chat

# Verify health endpoint
curl http://localhost:3000/api/health
```

### 2. Test System Restart (if possible)

```bash
# Reboot the system (only if safe to do so)
sudo reboot

# After reboot, verify:
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/health
```

### 3. Verify Theme Persistence

1. Access the application in a browser: `http://YOUR_VM_IP:3000`
2. Toggle theme (Day/Night mode)
3. Refresh the page - theme should persist
4. Restart the service: `sudo systemctl restart secure-ai-chat`
5. Refresh the page again - theme should still persist

## Troubleshooting

### Issue: Node.js version incorrect after git pull

**Solution**:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 25.2.1
node -v  # Verify it shows v25.2.1
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
# Update ExecStart path to: /home/YOUR_USER/.nvm/versions/node/v25.2.1/bin/npm
sudo systemctl daemon-reload
sudo systemctl restart secure-ai-chat
```

### Issue: Theme not persisting after restart

**Solution**:
- Verify `ThemeScript` is in `app/layout.tsx` `<head>` section
- Check browser console for hydration errors
- Verify `localStorage` is working (check browser DevTools)
- Ensure `ThemeInit` component is in `app/layout.tsx`

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All changes committed and pushed to repository
- [ ] `node -v` outputs `v25.2.1` (or will be set during deployment)
- [ ] `npm run lint` passes locally
- [ ] `npm run build` passes locally
- [ ] Theme toggle works locally
- [ ] No console errors in browser
- [ ] All tests pass (if applicable)

## Post-Deployment Checklist

After deployment, verify:

- [ ] Service is running: `sudo systemctl status secure-ai-chat`
- [ ] Health endpoint responds: `curl http://localhost:3000/api/health`
- [ ] Application is accessible: Browser can load `http://YOUR_VM_IP:3000`
- [ ] Theme toggle works
- [ ] Theme persists after page refresh
- [ ] Theme persists after service restart
- [ ] No errors in service logs: `sudo journalctl -u secure-ai-chat -n 50`

## Quick Reference

**Deploy command sequence**:
```bash
cd /opt/secure-ai-chat && \
git pull && \
export NVM_DIR="$HOME/.nvm" && \
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && \
nvm use 25.2.1 && \
npm ci && \
npm run build && \
sudo systemctl restart secure-ai-chat
```

**Check service**:
```bash
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/health
```

**View logs**:
```bash
sudo journalctl -u secure-ai-chat -f
```
