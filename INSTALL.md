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
3. **Installs Node.js v25.2.1** - Installs Node.js v25.2.1 via nvm (Node Version Manager)
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

# Custom Node.js version (default: 25.2.1)
# Note: The script uses nvm to install Node.js v25.2.1
# To use a different version, modify NODE_VERSION in the script or use nvm directly

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
   
   The installation script automatically configures UFW firewall:
   - SSH (port 22) is allowed to prevent lockout
   - Application port (default 3000) is allowed for both localhost and public access
   
   If you need to manually configure additional ports:
   ```bash
   sudo ufw allow 22/tcp   # SSH (already configured by script)
   sudo ufw allow 3000/tcp # Application port (already configured by script)
   sudo ufw allow 80/tcp   # HTTP (if using reverse proxy)
   sudo ufw allow 443/tcp  # HTTPS (if using SSL)
   sudo ufw status         # View current rules
   ```

### Troubleshooting

**Issue: Script fails at Node.js installation**
- Solution: Check internet connection and nvm installation
- Manual: Install nvm and Node.js v25.2.1 manually:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 25.2.1
  nvm use 25.2.1
  ```

**Issue: npm ci fails**
- Solution: Ensure you have sufficient disk space (at least 500MB free)
- Check: `df -h` to see disk space

**Issue: Build fails**
- Solution: Check Node.js version (requires 25.2.1): `node -v`
- Solution: Use correct Node.js version: `nvm use 25.2.1` (if using nvm)
- Solution: Clear cache and rebuild: `rm -rf .next node_modules && npm ci && npm run build`

**Issue: Deprecated package warnings during npm install**
- If you see `npm warn deprecated eslint@8.57.1` - This is **expected and safe to ignore**
- ESLint 8.x is required for Next.js 14 compatibility
- All other deprecated packages have been resolved via npm overrides
- See [DEPRECATED_PACKAGES_FIX.md](./DEPRECATED_PACKAGES_FIX.md) for complete details

**Issue: Port already in use**
- Solution: Change PORT in .env.local: `PORT=3001`
- Or: Kill the process using the port: `sudo lsof -ti:3000 | xargs kill -9`

**Issue: Permission denied errors**
- Solution: Don't run as root. The script uses sudo when needed
- Solution: Ensure your user has sudo privileges

**Issue: Application not accessible via public IP**

This is a common issue with multiple possible causes:

1. **Application not binding to 0.0.0.0:**
   - Verify HOSTNAME is set to `0.0.0.0` in `.env.local`
   - Use the provided start script: `./start-app.sh` (created by install script)
   - Or manually: `HOSTNAME=0.0.0.0 npm start`
   - Check if app is listening: 
     ```bash
     # Modern systems (ss is preferred, available by default)
     sudo ss -tlnp | grep :3000
     # OR if netstat is installed (may need: sudo apt install net-tools)
     sudo netstat -tlnp | grep :3000
     ```
   - Should show `0.0.0.0:3000`, not `127.0.0.1:3000`

2. **UFW Firewall blocking:**
   - Check UFW status: `sudo ufw status verbose`
   - Verify port is allowed: `sudo ufw allow 3000/tcp`
   - Check UFW logs: `sudo tail -f /var/log/ufw.log`
   - Temporarily test without firewall: `sudo ufw disable` (re-enable after testing!)

3. **Cloud Provider Firewall Rules:**
   
   **AWS EC2:**
   - Go to EC2 Dashboard → Security Groups
   - Select your instance's security group
   - Inbound rules: Add rule for port 3000 (TCP) from 0.0.0.0/0 (or specific IP)
   
   **Google Cloud Platform (GCP):**
   - Go to VPC Network → Firewall
   - Create new rule: Allow TCP port 3000 from 0.0.0.0/0
   - Apply to all targets or specific VM tags
   
   **Microsoft Azure:**
   - Go to VM → Networking → Inbound port rules
   - Add inbound rule: Allow TCP port 3000 from Any source IP
   - Or configure Network Security Group (NSG) rules
   
   **DigitalOcean:**
   - Go to Networking → Firewalls
   - Add inbound rule: TCP port 3000 from all IPv4/IPv6
   
   **Linode:**
   - Go to Firewalls → Create Firewall
   - Add inbound rule: TCP port 3000 from all IPv4/IPv6

4. **Network Interface Check:**
   - List interfaces: `ip addr show` or `ifconfig`
   - Find your public IP: `curl ifconfig.me` or `curl ipinfo.io/ip`
   - Verify app is on correct interface

5. **Testing Steps:**
   ```bash
   # 1. Check if app is listening on all interfaces (preferred method)
   sudo ss -tlnp | grep :3000
   # Should show: tcp LISTEN 0 511 0.0.0.0:3000 ... (NOT 127.0.0.1:3000)
   # Alternative (if net-tools installed): sudo netstat -tlnp | grep :3000
   # Install net-tools if needed: sudo apt install net-tools
   
   # 2. Test locally on VM
   curl http://localhost:3000
   
   # 3. Test from VM using public IP
   PUBLIC_IP=$(curl -s ifconfig.me)
   echo "Testing public IP: $PUBLIC_IP"
   curl http://$PUBLIC_IP:3000
   
   # 4. Test from external machine
   curl http://YOUR_VM_PUBLIC_IP:3000
   
   # 5. Check firewall rules
   sudo ufw status numbered
   
   # 6. Check if port is open externally (from external machine)
   # Install nmap if needed: sudo apt install nmap
   nmap -p 3000 YOUR_VM_PUBLIC_IP
   
   # 7. Alternative: Test port connectivity (from external machine)
   telnet YOUR_VM_PUBLIC_IP 3000
   # OR
   nc -zv YOUR_VM_PUBLIC_IP 3000
   ```

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
