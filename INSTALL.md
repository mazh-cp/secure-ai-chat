# Installation Guide

## Ubuntu/Debian Single-Step Installation

The easiest way to install Secure AI Chat on a fresh Ubuntu VM is using our automated installation script.

### Prerequisites

- Ubuntu 18.04+ or Debian 10+
- Internet connection
- sudo privileges

### Prerequisites

⚠️ **IMPORTANT**: The repository must be pushed to GitHub first. If you haven't done this yet:

```bash
# From the project root
./scripts/push-to-github.sh "Initial release"
```

### Quick Install

Once the repository is on GitHub, run this single command in your Ubuntu VM:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

Or using wget:

```bash
wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

### Local Installation (Without GitHub)

If you want to test the script locally without pushing to GitHub first:

```bash
# Copy the script to your Ubuntu VM
# Then run:
bash scripts/install-ubuntu.sh
```

### What the Script Does

1. **Updates System Packages** - Updates apt package list
2. **Installs System Dependencies** - Installs curl, git, build-essential, etc.
3. **Installs Node.js 20.x** - Installs Node.js from NodeSource repository
4. **Clones Repository** - Downloads the latest code from GitHub
5. **Installs Dependencies** - Runs `npm ci` to install all npm packages
6. **Configures Environment** - Creates `.env.local` from `.env.example`
7. **Builds Application** - Runs type check and production build
8. **Verifies Installation** - Confirms all components are working

### Installation Options

You can customize the installation using environment variables:

```bash
# Custom installation directory (default: ~/secure-ai-chat)
INSTALL_DIR=/opt/apps curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Custom Node.js version (default: 20)
NODE_VERSION=18 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Custom port (default: 3000)
PORT=8080 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Custom branch (default: main)
BRANCH=develop curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

### Post-Installation Steps

1. **Configure Environment Variables:**
   ```bash
   cd ~/secure-ai-chat
   nano .env.local
   ```

2. **Add Required API Keys:**
   - `OPENAI_API_KEY` - Required for chat functionality
   - `LAKERA_AI_KEY` - Optional, for security scanning
   - `LAKERA_ENDPOINT` - Default: https://api.lakera.ai/v2/guard
   - `LAKERA_PROJECT_ID` - Optional Lakera project ID

3. **Start the Application:**
   
   **Development Mode:**
   ```bash
   npm run dev
   ```
   
   **Production Mode:**
   ```bash
   npm start
   ```

4. **Access the Application:**
   - Local: http://localhost:3000
   - Network: http://YOUR_VM_IP:3000

### Production Deployment

For production environments, consider:

1. **Process Manager (PM2):**
   ```bash
   npm install -g pm2
   pm2 start npm --name "secure-ai-chat" -- start
   pm2 save
   pm2 startup
   ```

2. **Reverse Proxy (Nginx):**
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

3. **SSL/TLS Certificate:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

4. **Firewall Configuration:**
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```

### Troubleshooting

**Issue: Script fails at Node.js installation**
- Solution: Check internet connection and NodeSource repository accessibility
- Manual: Install Node.js manually from https://nodejs.org/

**Issue: npm ci fails**
- Solution: Ensure you have sufficient disk space (at least 500MB free)
- Check: `df -h` to see disk space

**Issue: Build fails**
- Solution: Check Node.js version (requires 18+): `node -v`
- Solution: Clear cache and rebuild: `rm -rf .next node_modules && npm ci && npm run build`

**Issue: Port already in use**
- Solution: Change PORT in .env.local: `PORT=3001`
- Or: Kill the process using the port: `sudo lsof -ti:3000 | xargs kill -9`

**Issue: Permission denied errors**
- Solution: Don't run as root. The script uses sudo when needed
- Solution: Ensure your user has sudo privileges

### Manual Installation

If you prefer manual installation, see the main [README.md](README.md) for step-by-step instructions.

### Uninstall

To remove the application:

```bash
# Stop the application (if running)
pm2 stop secure-ai-chat 2>/dev/null || true
pm2 delete secure-ai-chat 2>/dev/null || true

# Remove installation directory
rm -rf ~/secure-ai-chat

# Optional: Remove Node.js (if not used elsewhere)
sudo apt remove nodejs npm
sudo apt autoremove
```
