# One-Step Production Upgrade

This document provides simple, one-step commands to upgrade the Secure AI Chat application on a remote production VM.

## Quick Start

### Option 1: Direct Remote Execution (Recommended)

SSH into your production server and run:

```bash
# Upgrade to latest release/unifi-theme-safe-final
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh | bash

# Or with custom branch
BRANCH=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

### Option 2: Download and Run Locally

SSH into your production server and run:

```bash
# Download the script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh -o upgrade-production.sh

# Make it executable
chmod +x upgrade-production.sh

# Run it
./upgrade-production.sh
```

### Option 3: Clone and Run

If you already have the repository cloned:

```bash
cd /home/adminuser/secure-ai-chat
git pull origin release/unifi-theme-safe-final
bash scripts/upgrade-production.sh
```

## What the Script Does

The upgrade script automatically:

1. ✅ **Pre-flight Checks**
   - Verifies repository directory exists
   - Checks Git, npm, and Node.js are installed
   - Validates Node.js version (warns if mismatch)

2. ✅ **Backup Current Deployment**
   - Creates a backup of `.next`, `.secure-storage`, and package files
   - Backup stored in `.backups/` directory with timestamp and commit hash

3. ✅ **Pull Latest Code**
   - Switches to the specified branch (default: `release/unifi-theme-safe-final`)
   - Pulls latest changes from origin

4. ✅ **Install Dependencies**
   - Runs `npm ci` for clean, reproducible install

5. ✅ **Build Application**
   - Validates environment variables (warns only)
   - Runs TypeScript type check (warns only)
   - Builds Next.js application

6. ✅ **Restart Service**
   - Restarts systemd service (`secure-ai-chat`)
   - Waits for service to start
   - Verifies service is running

7. ✅ **Verify Deployment**
   - Checks health endpoint (`/api/health`)
   - Displays service status

## Configuration

You can customize the upgrade by setting environment variables:

```bash
# Custom repository directory
REPO_DIR=/opt/secure-ai-chat bash scripts/upgrade-production.sh

# Custom branch
BRANCH=main bash scripts/upgrade-production.sh

# Custom service name
SERVICE_NAME=my-secure-ai-chat bash scripts/upgrade-production.sh

# All at once
REPO_DIR=/opt/secure-ai-chat \
BRANCH=main \
SERVICE_NAME=my-app \
bash scripts/upgrade-production.sh
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REPO_DIR` | `/home/adminuser/secure-ai-chat` | Repository directory path |
| `BRANCH` | `release/unifi-theme-safe-final` | Git branch to upgrade to |
| `SERVICE_USER` | `adminuser` | System user running the service |
| `SERVICE_NAME` | `secure-ai-chat` | systemd service name |
| `BACKUP_DIR` | `$REPO_DIR/.backups` | Backup storage directory |

## Requirements

### Server Requirements
- **Node.js**: v25.2.1 (recommended) or v22.x+ (works but may have warnings)
- **npm**: v10.x+
- **Git**: Latest version
- **systemd**: For service management (optional - script will work without it)

### Permissions
- Script should be run as the service user (default: `adminuser`)
- Or run with appropriate sudo permissions for systemd service restart

### Network Access
- Server must be able to access GitHub (for `git pull`)
- Server must be able to access npm registry (for `npm ci`)

## Troubleshooting

### Script Fails at "Pull Latest Code"
```bash
# Manually pull and retry
cd /home/adminuser/secure-ai-chat
git fetch origin
git checkout release/unifi-theme-safe-final
git pull origin release/unifi-theme-safe-final
```

### Build Fails
```bash
# Check Node.js version
node -v  # Should be v25.2.1

# Clear build cache and retry
cd /home/adminuser/secure-ai-chat
rm -rf .next node_modules
npm ci
npm run build
```

### Service Fails to Start
```bash
# Check service logs
sudo journalctl -u secure-ai-chat -n 50

# Check service status
sudo systemctl status secure-ai-chat

# Restart manually
sudo systemctl restart secure-ai-chat
```

### Health Endpoint Not Responding
```bash
# Wait a bit longer (server may still be starting)
sleep 10
curl http://localhost:3000/api/health

# Check if server is running
lsof -ti:3000

# Check firewall
sudo ufw status
```

### Permission Errors
```bash
# Fix repository ownership
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat

# Ensure service user can write to .next and .secure-storage
sudo chmod -R 755 /home/adminuser/secure-ai-chat
```

## Rollback

If something goes wrong, you can rollback using the backup:

```bash
# List backups
ls -lh /home/adminuser/secure-ai-chat/.backups/

# Restore from backup (replace with actual backup file)
cd /home/adminuser/secure-ai-chat
tar -xzf .backups/backup-YYYYMMDD-HHMMSS-COMMIT.tar.gz

# Restart service
sudo systemctl restart secure-ai-chat
```

## Manual Upgrade Steps

If you prefer to upgrade manually:

```bash
# 1. SSH into production server
ssh adminuser@your-production-server

# 2. Navigate to repository
cd /home/adminuser/secure-ai-chat

# 3. Pull latest code
git fetch origin
git checkout release/unifi-theme-safe-final
git pull origin release/unifi-theme-safe-final

# 4. Install dependencies
npm ci

# 5. Build application
npm run build

# 6. Restart service
sudo systemctl restart secure-ai-chat

# 7. Verify deployment
sleep 5
curl http://localhost:3000/api/health
sudo systemctl status secure-ai-chat
```

## Security Notes

- ✅ Script backs up current deployment before upgrading
- ✅ Script verifies health endpoint after upgrade
- ✅ Script does not expose sensitive data in output
- ✅ All API keys remain in `.secure-storage` (encrypted)
- ⚠️ Script requires network access to GitHub and npm registry
- ⚠️ Script requires appropriate user permissions

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review service logs: `sudo journalctl -u secure-ai-chat -n 100`
3. Check application logs in repository `.logs/` directory
4. Review GitHub issues: https://github.com/mazh-cp/secure-ai-chat/issues

---

**Last Updated**: 2026-01-XX  
**Script Version**: 1.0.4  
**Branch**: `release/unifi-theme-safe-final`
