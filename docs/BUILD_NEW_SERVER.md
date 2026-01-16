# Build Brand New App Server - Quick Start Guide

Single-step script to build a brand new server with the latest code release.

## Quick Start

### Option 1: Direct Download and Run (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-server.sh | sudo bash
```

### Option 2: Using wget

```bash
wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-server.sh | sudo bash
```

### Option 3: Local Script (if you have the repository)

```bash
sudo bash scripts/build-new-server.sh
```

## What the Script Does

The script automates the complete setup of a new server:

1. **Installs OS Prerequisites**
   - Updates package lists
   - Installs: curl, git, build-essential, ca-certificates, gnupg, lsb-release, iproute2

2. **Creates Application User**
   - Creates dedicated user: `secureai` (default)
   - Sets up home directory: `/opt/secure-ai-chat` (default)

3. **Installs Node.js**
   - Installs nvm (Node Version Manager)
   - Installs Node.js v24.13.0 (LTS)
   - Sets as default version

4. **Clones Repository**
   - Clones from GitHub: `https://github.com/mazh-cp/secure-ai-chat.git`
   - Checks out `main` branch (or specified ref)

5. **Installs Dependencies**
   - Detects package manager (npm/yarn/pnpm)
   - Runs frozen/immutable install (`npm ci`, `yarn install --immutable`, etc.)

6. **Runs Release Gate**
   - Validates code quality and security
   - Runs TypeScript compilation
   - Runs ESLint checks
   - Validates no secret leakage

7. **Builds Production Bundle**
   - Runs `npm run build`
   - Verifies build output (`.next/` directory)

8. **Creates Environment File**
   - Creates `/etc/secure-ai-chat.env`
   - Sets up template with placeholders
   - Sets proper permissions (600)

9. **Creates Systemd Service**
   - Creates service file: `/etc/systemd/system/secure-ai-chat.service`
   - Configures auto-restart
   - Sets up security settings

10. **Enables and Starts Service**
    - Enables service to start on boot
    - Starts the service
    - Verifies service is running

11. **Runs Smoke Tests**
    - Validates all endpoints are responding
    - Checks for secret leakage
    - Verifies application health

## Configuration Options

You can customize the installation by setting environment variables before running:

```bash
# Customize installation
export REPO_URL="https://github.com/mazh-cp/secure-ai-chat.git"
export GIT_REF="main"              # Branch or tag (default: main)
export APP_DIR="/opt/secure-ai-chat"  # App directory (default: /opt/secure-ai-chat)
export APP_USER="secureai"         # App user (default: secureai)
export NODE_VERSION="24.13.0"      # Node.js version (default: 24.13.0)

# Run script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-server.sh | sudo bash
```

## Example: Install Specific Version

```bash
export GIT_REF="v1.0.11"
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/build-new-server.sh | sudo bash
```

## Requirements

### Operating System
- **Ubuntu 18.04+** or **Debian 10+** (automatically detected)
- Other Linux distributions may work but are not tested

### Resources
- **CPU**: 1+ cores
- **RAM**: 512MB+ (1GB recommended)
- **Disk**: 2GB+ free space
- **Network**: Internet connection for downloads

### Permissions
- Script must be run as **root** (use `sudo`)
- Requires `sudo` access on the target server

## Post-Installation

### 1. Configure API Keys

**Via Settings UI (Recommended):**
```
http://YOUR_SERVER_IP:3000/settings
```

**Via Environment File:**
```bash
sudo nano /etc/secure-ai-chat.env
# Add your API keys:
# OPENAI_API_KEY=sk-...
# LAKERA_AI_KEY=...
# CHECKPOINT_TE_API_KEY=...
```

### 2. Configure Firewall

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Or if running on custom port
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

### 3. Set Up Reverse Proxy (Optional)

For production, set up nginx as reverse proxy:

```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/secure-ai-chat
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/secure-ai-chat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Service Management

```bash
# Check status
sudo systemctl status secure-ai-chat

# Start service
sudo systemctl start secure-ai-chat

# Stop service
sudo systemctl stop secure-ai-chat

# Restart service
sudo systemctl restart secure-ai-chat

# View logs
sudo journalctl -u secure-ai-chat -f

# Enable auto-start on boot
sudo systemctl enable secure-ai-chat
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u secure-ai-chat -n 50

# Check Node.js
sudo -u secureai bash -c 'source ~/.nvm/nvm.sh && node -v'

# Check permissions
ls -la /opt/secure-ai-chat
sudo chown -R secureai:secureai /opt/secure-ai-chat
```

### Build Fails

```bash
# Check Node.js version
sudo -u secureai bash -c 'source ~/.nvm/nvm.sh && node -v'

# Clean and rebuild
cd /opt/secure-ai-chat
sudo -u secureai rm -rf node_modules .next package-lock.json
sudo -u secureai bash -c 'source ~/.nvm/nvm.sh && npm ci && npm run build'
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process or change PORT in /etc/secure-ai-chat.env
sudo nano /etc/secure-ai-chat.env
# Change: PORT=3001
sudo systemctl restart secure-ai-chat
```

### Smoke Tests Fail

```bash
# Check if service is running
sudo systemctl status secure-ai-chat

# Check if port is accessible
curl http://localhost:3000/api/health

# View service logs
sudo journalctl -u secure-ai-chat -n 50
```

## Uninstallation

To completely remove the installation:

```bash
# Stop and disable service
sudo systemctl stop secure-ai-chat
sudo systemctl disable secure-ai-chat
sudo rm /etc/systemd/system/secure-ai-chat.service
sudo systemctl daemon-reload

# Remove application
sudo rm -rf /opt/secure-ai-chat

# Remove environment file
sudo rm /etc/secure-ai-chat.env

# Remove user (optional)
sudo userdel -r secureai
```

## Security Considerations

1. **API Keys**: Configure via Settings UI (stored in `.secure-storage/`) or environment file
2. **File Permissions**: `.secure-storage/` is 700, env file is 600
3. **Service User**: Runs as dedicated user (`secureai`), not root
4. **Firewall**: Configure UFW/iptables to restrict access
5. **SSL/TLS**: Use reverse proxy (nginx) with Let's Encrypt for HTTPS

## Next Steps

After installation:
1. Configure API keys via Settings UI
2. Test the application: `http://YOUR_SERVER_IP:3000`
3. Set up monitoring and backups
4. Configure SSL/TLS for production
5. Review security settings

---

**Last Updated**: 2026-01-16  
**Version**: 1.0.11
