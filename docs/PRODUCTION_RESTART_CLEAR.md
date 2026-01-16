# Production Restart with Cache & Logs Clearing

This guide explains how to restart the Secure AI Chat application on a remote production host and clear all cache and logs.

## Overview

The `restart-production-clear-all.sh` script:
- ✅ Stops the application (systemd or Docker)
- ✅ Clears Next.js build cache (`.next/`)
- ✅ Clears Node modules cache (`node_modules/.cache`)
- ✅ Clears uploaded files (`.storage/files/`)
- ✅ Clears files metadata (`.storage/files-metadata.json`)
- ✅ Clears system logs (`.secure-storage/system-logs.json`)
- ✅ Clears client-side logs (via API)
- ✅ Preserves API keys (`.secure-storage/api-keys.enc`)
- ✅ Rebuilds and restarts the application

## Prerequisites

- SSH access to the production server
- Application already installed and configured
- Either systemd service or Docker deployment
- Sudo privileges (script will use sudo when needed)

## Method 1: SSH into Server and Run Locally

### Step 1: SSH into Production Server

```bash
ssh user@production-host
# Example:
# ssh adminuser@your-server.com
```

### Step 2: Navigate to Application Directory

```bash
cd /opt/secure-ai-chat
# Or if installed in home directory:
# cd /home/adminuser/secure-ai-chat
```

### Step 3: Make Script Executable (if not already)

```bash
chmod +x scripts/restart-production-clear-all.sh
```

### Step 4: Configure Environment Variables (Optional)

```bash
# Set these if your setup differs from defaults:
export INSTALL_DIR=/opt/secure-ai-chat  # or /home/adminuser/secure-ai-chat
export APP_USER=secureai                # or adminuser
export SERVICE_NAME=secure-ai-chat      # systemd service name
export DEPLOYMENT_TYPE=systemd          # or 'docker'
export PORT=3000                        # application port
```

### Step 5: Run the Script

```bash
bash scripts/restart-production-clear-all.sh
```

## Method 2: One-Liner from Local Machine

Run directly from your local machine via SSH:

### Basic Usage

```bash
ssh user@production-host "cd /opt/secure-ai-chat && bash scripts/restart-production-clear-all.sh"
```

### With Custom Configuration

```bash
ssh user@production-host \
  "INSTALL_DIR=/opt/secure-ai-chat \
   APP_USER=secureai \
   SERVICE_NAME=secure-ai-chat \
   DEPLOYMENT_TYPE=systemd \
   cd \$INSTALL_DIR && bash scripts/restart-production-clear-all.sh"
```

## Method 3: Using Deployment Type Auto-Detection

If you're not sure about the deployment type, the script can auto-detect it:

```bash
export DEPLOYMENT_TYPE=auto
bash scripts/restart-production-clear-all.sh
```

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `INSTALL_DIR` | `/opt/secure-ai-chat` | Application installation directory |
| `APP_USER` | `secureai` | System user that runs the application |
| `SERVICE_NAME` | `secure-ai-chat` | systemd service name |
| `DEPLOYMENT_TYPE` | `systemd` | Deployment type: `systemd`, `docker`, or `auto` |
| `PORT` | `3000` | Application port number |

## Deployment Types

### systemd Service

For applications managed by systemd (most common on Ubuntu VMs):

```bash
export DEPLOYMENT_TYPE=systemd
bash scripts/restart-production-clear-all.sh
```

The script will:
- Stop: `sudo systemctl stop secure-ai-chat`
- Start: `sudo systemctl start secure-ai-chat`
- Check status: `sudo systemctl status secure-ai-chat`

### Docker / Docker Compose

For applications deployed with Docker:

```bash
export DEPLOYMENT_TYPE=docker
bash scripts/restart-production-clear-all.sh
```

The script will:
- Stop: `docker stop secure-ai-chat` or `docker-compose down`
- Start: `docker-compose up -d` or `docker start secure-ai-chat`

## What Gets Cleared

### ✅ Cleared (Safe to Remove)

- **Next.js Build Cache** (`.next/`)
  - Compiled pages and API routes
  - Will be regenerated on next build

- **Node Modules Cache** (`node_modules/.cache/`)
  - Build tool caches
  - Will be regenerated on next build

- **Uploaded Files** (`.storage/files/`)
  - All user-uploaded files for RAG
  - File metadata (`.storage/files-metadata.json`)

- **System Logs** (`.secure-storage/system-logs.json`)
  - Application system logs
  - API request logs
  - Error logs

- **Client-Side Logs** (localStorage)
  - Dashboard logs
  - Activity logs
  - Cleared via API endpoint

### 🔒 Preserved (Important Data)

- **API Keys** (`.secure-storage/api-keys.enc`)
  - Encrypted API keys
  - **Never deleted** by this script

- **Environment Variables** (`.env.local`)
  - Configuration files
  - Not touched by this script

- **Git Repository**
  - Source code and git history
  - Not affected

## Verification After Restart

After the script completes, verify the application is working:

### 1. Check Health Endpoint

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"...","service":"secure-ai-chat"}
```

### 2. Check Version

```bash
curl http://localhost:3000/api/version
# Expected: {"version":"1.0.10"}
```

### 3. Check Service Status (systemd)

```bash
sudo systemctl status secure-ai-chat
```

### 4. Check Container Status (Docker)

```bash
docker ps | grep secure-ai-chat
docker logs secure-ai-chat -f
```

### 5. View Logs

**systemd:**
```bash
sudo journalctl -u secure-ai-chat -f
```

**Docker:**
```bash
docker logs secure-ai-chat -f
```

## Troubleshooting

### Script Fails with "Do not run as root"

**Solution:** Run as a regular user with sudo privileges, not as root:
```bash
# ❌ Don't do this:
sudo bash scripts/restart-production-clear-all.sh

# ✅ Do this instead:
bash scripts/restart-production-clear-all.sh
```

### Service Won't Start

**Check logs:**
```bash
# systemd
sudo journalctl -u secure-ai-chat -n 50

# Docker
docker logs secure-ai-chat
```

**Common issues:**
- Port already in use
- Node.js version mismatch
- Missing dependencies
- Permission issues

### API Keys Missing After Restart

**This should never happen** - the script preserves API keys. If keys are missing:

1. Check if `.secure-storage/api-keys.enc` exists:
   ```bash
   ls -la .secure-storage/api-keys.enc
   ```

2. If missing, restore from backup or reconfigure:
   ```bash
   # Restore keys (if you have a backup)
   cp /path/to/backup/.secure-storage/api-keys.enc .secure-storage/
   
   # Or reconfigure via settings page
   ```

### Build Fails

**Check Node.js version:**
```bash
node -v  # Should be v25.2.1
```

**Check dependencies:**
```bash
npm install
npm run build
```

## Safety Features

The script includes several safety features:

1. **No Root Execution:** Refuses to run as root user
2. **API Key Preservation:** Never deletes encrypted API keys
3. **Service Verification:** Checks if service started successfully
4. **Health Checks:** Verifies endpoints before completing
5. **Error Handling:** Provides clear error messages and troubleshooting steps

## Example Output

```
╔═══════════════════════════════════════════════════════════════╗
║  Production Restart - Clear All Cache & Logs                ║
╚═══════════════════════════════════════════════════════════════╝

ℹ Install directory: /opt/secure-ai-chat
ℹ App user: secureai
ℹ Service name: secure-ai-chat
ℹ Deployment type: systemd

▶ Step 1: Stopping application...
✓ systemd service stopped

▶ Step 2: Clearing Next.js build cache...
✓ .next directory cleared

▶ Step 3: Clearing Node modules cache...
✓ node_modules/.cache cleared

▶ Step 4: Clearing uploaded files and metadata...
✓ Deleted 15 uploaded files and cleared metadata

▶ Step 5: Clearing system logs...
✓ Cleared system logs (85624 bytes)

▶ Step 6: Verifying API keys are preserved...
✓ API keys file exists (737 bytes) - preserved

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Production Restart Complete - All Cache & Logs Cleared!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Application restarted successfully

🧹 Cleared:
   - Next.js build cache (.next/)
   - Node modules cache (node_modules/.cache)
   - Uploaded files (.storage/files/)
   - Files metadata (.storage/files-metadata.json)
   - System logs (.secure-storage/system-logs.json)
   - Client-side logs (localStorage via API)

🔒 Preserved:
   - API keys (.secure-storage/api-keys.enc)

🌐 Application is running at:
   http://localhost:3000
```

## Quick Reference

### Most Common Usage

```bash
# SSH into server and run
ssh user@production-host
cd /opt/secure-ai-chat
bash scripts/restart-production-clear-all.sh
```

### One-Liner

```bash
ssh user@production-host "cd /opt/secure-ai-chat && bash scripts/restart-production-clear-all.sh"
```

### With Custom Path

```bash
ssh user@production-host \
  "INSTALL_DIR=/home/adminuser/secure-ai-chat \
   APP_USER=adminuser \
   cd \$INSTALL_DIR && bash scripts/restart-production-clear-all.sh"
```

## See Also

- [Deployment Guide](./deploy.md) - General deployment instructions
- [Installation Guide](../INSTALL.md) - Initial installation
- [Upgrade Guide](../UPGRADE.md) - Application upgrades
- [Production Hardening](../PRODUCTION_HARDENING.md) - Security hardening
