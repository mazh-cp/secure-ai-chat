# Ubuntu VM Installation Guide

Complete installation guide for Secure AI Chat on a fresh Ubuntu VM with nginx reverse proxy.

## Prerequisites

- **Ubuntu 18.04+** or Debian 10+
- **sudo privileges**
- **Internet connection**
- **Ports**: SSH (22) must be open, port 80 will be opened by the script
- **Domain** (optional): For production, configure a domain name

## Quick Install

Single-command installation:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
```

**What the script does:**
- Installs system dependencies (curl, git, build tools, nginx)
- Creates dedicated user: `secureai`
- Installs Node.js LTS 20.x via nvm
- Clones repository to `/opt/secure-ai-chat`
- Installs dependencies and builds application
- Configures systemd service for auto-start
- Configures nginx reverse proxy on port 80
- Configures UFW firewall (SSH + Nginx)
- Auto-detects free port starting from 3000 (avoids EADDRINUSE)

**Installation time**: ~10-15 minutes

## Post-Installation Configuration

### 1. Add API Keys

Edit the environment file:

```bash
sudo nano /opt/secure-ai-chat/.env.local
```

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key (required for chat)

**Optional:**
- `LAKERA_AI_KEY` - Lakera AI API key (for file scanning)
- `LAKERA_ENDPOINT` - Lakera API endpoint (default: https://api.lakera.ai/v2/guard)
- `LAKERA_PROJECT_ID` - Lakera project ID
- `CHECKPOINT_TE_API_KEY` - Check Point ThreatEmulation API key

After adding keys, restart the service:

```bash
sudo systemctl restart secure-ai-chat
```

### 2. Verify Installation

Check service status:

```bash
sudo systemctl status secure-ai-chat
```

Check logs:

```bash
sudo journalctl -u secure-ai-chat -f
```

Test endpoints:

```bash
# Health check (internal port)
curl http://localhost:3000/api/health

# Via nginx (port 80)
curl http://localhost/api/health
```

### 3. Access Application

**Local access:**
- http://localhost (via nginx)
- http://localhost:3000 (direct)

**Public access:**
```bash
# Get public IP
curl ifconfig.me

# Access via public IP
# http://YOUR_VM_IP
```

**Important**: Ensure your cloud provider firewall allows:
- **Port 22** (SSH)
- **Port 80** (HTTP/nginx)

## Managing the Service

### Start/Stop/Restart

```bash
sudo systemctl start secure-ai-chat
sudo systemctl stop secure-ai-chat
sudo systemctl restart secure-ai-chat
```

### View Logs

```bash
# Follow logs
sudo journalctl -u secure-ai-chat -f

# Last 50 lines
sudo journalctl -u secure-ai-chat -n 50

# Since boot
sudo journalctl -u secure-ai-chat -b
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

## Upgrading to New Versions

### Method 1: Re-run Install Script (Recommended)

The install script is idempotent - safe to re-run:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
```

This will:
- Pull latest code from the repository
- Reinstall dependencies
- Rebuild application
- Restart services

### Method 2: Manual Upgrade

```bash
# Switch to secureai user context
sudo -u secureai bash

# Navigate to app directory
cd /opt/secure-ai-chat

# Pull latest code
git pull origin main

# Install dependencies
export HOME=/opt/secure-ai-chat
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci

# Build
npm run build

# Exit user context
exit

# Restart service
sudo systemctl restart secure-ai-chat
```

## Reset/Cleanup

To completely remove the installation:

```bash
# Download cleanup script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/cleanup_reset_vm.sh -o /tmp/cleanup.sh
chmod +x /tmp/cleanup.sh

# Run cleanup (keeps user)
sudo bash /tmp/cleanup.sh

# OR remove user as well
sudo bash /tmp/cleanup.sh --remove-user
```

**What cleanup does:**
- Stops and disables systemd service
- Removes systemd service file
- Kills node/next processes on ports 3000-3999
- Removes nginx site configuration
- Restores default nginx site
- Removes UFW nginx rule
- Removes application directory
- Optionally removes user

## Troubleshooting

### 502 Bad Gateway

**Symptoms**: Nginx returns 502 error

**Causes & Solutions:**

1. **Service not running:**
   ```bash
   sudo systemctl status secure-ai-chat
   sudo systemctl start secure-ai-chat
   ```

2. **Wrong port in nginx config:**
   ```bash
   # Check port in .env.local
   sudo cat /opt/secure-ai-chat/.env.local | grep PORT
   
   # Check nginx config
   sudo cat /etc/nginx/sites-available/secure-ai-chat
   
   # If mismatch, update nginx config or re-run install script
   ```

3. **Service failed to start:**
   ```bash
   sudo journalctl -u secure-ai-chat -n 50
   # Look for errors in logs
   ```

### EADDRINUSE (Port Already in Use)

**Symptoms**: Service fails to start, port already in use

**Solution**: The install script auto-detects free ports, but if you encounter this:

```bash
# Find process using port
sudo ss -tlnp | grep :3000
# OR
sudo netstat -tlnp | grep :3000

# Kill process if needed
sudo kill -9 <PID>

# Or update port in .env.local and restart
sudo nano /opt/secure-ai-chat/.env.local  # Change PORT=3000 to PORT=3001
sudo systemctl restart secure-ai-chat

# Update nginx config to match
sudo nano /etc/nginx/sites-available/secure-ai-chat
sudo nginx -t && sudo systemctl reload nginx
```

### Service Not Starting

**Symptoms**: `systemctl status` shows failed/inactive

**Check logs:**
```bash
sudo journalctl -u secure-ai-chat -n 50
```

**Common causes:**

1. **Missing API keys (non-fatal, but check logs)**
2. **Build errors** - Rebuild manually:
   ```bash
   sudo -u secureai bash
   cd /opt/secure-ai-chat
   export HOME=/opt/secure-ai-chat
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   npm run build
   exit
   sudo systemctl restart secure-ai-chat
   ```

3. **Node.js path incorrect** - Check service file:
   ```bash
   sudo systemctl show secure-ai-chat --property=ExecStart
   # Should show path to npm in /opt/secure-ai-chat/.nvm
   ```

### Permission Issues

**Symptoms**: Permission denied errors

**Solution:**
```bash
# Fix ownership
sudo chown -R secureai:secureai /opt/secure-ai-chat

# Check permissions
ls -la /opt/secure-ai-chat
```

### Nginx Not Starting

**Symptoms**: Nginx fails to start/reload

**Check nginx config:**
```bash
sudo nginx -t
```

**Check logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

**Common fixes:**
- Remove conflicting sites from `/etc/nginx/sites-enabled/`
- Ensure default site is disabled if using custom site
- Check port conflicts

### Cannot Access from Outside VM

**Check firewall:**
```bash
# UFW status
sudo ufw status

# Cloud provider firewall (AWS Security Groups, GCP Firewall Rules, etc.)
# Ensure port 80 is open
```

**Check binding:**
```bash
# Should show 0.0.0.0:3000
sudo ss -tlnp | grep :3000
```

**Check nginx:**
```bash
# Should show 0.0.0.0:80
sudo ss -tlnp | grep :80
```

## Architecture

```
Internet → Port 80 (nginx) → Port 3000+ (Secure AI Chat)
                              ↓
                         systemd service
                              ↓
                         /opt/secure-ai-chat
                         (user: secureai)
```

- **nginx**: Reverse proxy on port 80
- **Secure AI Chat**: Application on auto-detected port (3000+)
- **systemd**: Service management and auto-start
- **UFW**: Firewall (SSH + Nginx)

## Production Recommendations

1. **SSL/TLS**: Configure Let's Encrypt for HTTPS
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

2. **Domain**: Configure DNS A record pointing to VM IP

3. **Monitoring**: Set up monitoring for service health

4. **Backup**: Regularly backup `/opt/secure-ai-chat/.env.local` and `/opt/secure-ai-chat/.secure-storage`

5. **Updates**: Keep system packages updated
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

## Node.js Version

The installation uses **Node.js LTS 20.x** (Long Term Support) for production server installs. This provides stability and security updates.

For development, you may use Node.js 25.2.1 as specified in `package.json`.

## Support

For issues or questions:
- Check logs: `sudo journalctl -u secure-ai-chat -f`
- Review troubleshooting section above
- Check [README.md](../README.md) for general information
