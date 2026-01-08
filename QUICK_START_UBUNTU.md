# Quick Start Guide - Fresh Ubuntu Installation

## Complete Command Sequence (Copy/Paste Ready)

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat

# Install Node.js 20.x (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js version (should be 20.x)
node --version
npm --version

# Install dependencies
npm install
```

### Step 2: Configure Environment

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

### Step 3: Build and Start

```bash
# Build for production
npm run build

# Start the application
npm start
```

**Expected output:**
```
> secure-ai-chat@0.1.0 start
> next start

   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   - Network:      http://0.0.0.0:3000
```

### Step 4: Verify App is Running

**In a new terminal window:**

```bash
# Check if app is listening on port 3000
sudo ss -tlnp | grep :3000
# Should show: tcp LISTEN 0 511 0.0.0.0:3000

# Test health endpoint
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"...","service":"secure-ai-chat"}

# Test in browser (if GUI available)
# Open: http://localhost:3000
# OR if accessing from another machine: http://YOUR_VM_IP:3000
```

### Step 5: Verify Restart Behavior

**Option A: Manual Process Restart Test**

```bash
# Find the Node.js process
ps aux | grep "next start"
# Note the PID (second column)

# Kill the process
kill -9 <PID>
# Replace <PID> with actual process ID from above

# Process will NOT auto-restart without a process manager
# You'll need to manually restart: npm start
```

**Option B: Docker (Auto-Restart Enabled)**

```bash
# Stop current npm process (Ctrl+C in the terminal running npm start)

# Start with Docker Compose
docker-compose up -d

# Verify it's running
docker-compose ps

# Check health
curl http://localhost:3000/api/health

# Kill container process to test restart
docker exec secure-ai-chat kill -9 1

# Wait a few seconds, then check status
sleep 5
docker-compose ps
# Should show container restarted automatically

# View logs
docker-compose logs -f secure-ai-chat
```

**Option C: systemd (Auto-Restart Enabled)**

```bash
# Stop current npm process (Ctrl+C)

# Copy service file
sudo cp secure-ai-chat.service /etc/systemd/system/

# Edit service file to set correct installation path
sudo nano /etc/systemd/system/secure-ai-chat.service
# Update WorkingDirectory=/opt/secure-ai-chat to your actual path
# Example: WorkingDirectory=/home/ubuntu/secure-ai-chat

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat

# Verify health
curl http://localhost:3000/api/health

# Find process ID
ps aux | grep "npm start"
# Note the PID

# Kill process to test restart
sudo kill -9 <PID>

# Wait a few seconds
sleep 5

# Check status (should show restarted)
sudo systemctl status secure-ai-chat

# View logs
sudo journalctl -u secure-ai-chat -f
```

**Option D: PM2 (Auto-Restart Enabled)**

```bash
# Stop current npm process (Ctrl+C)

# Install PM2 globally
sudo npm install -g pm2

# Start app with PM2
pm2 start npm --name "secure-ai-chat" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions shown (usually: sudo env PATH=... pm2 startup systemd -u ubuntu --hp /home/ubuntu)

# Check status
pm2 status

# View logs
pm2 logs secure-ai-chat

# Verify health
curl http://localhost:3000/api/health

# Kill process to test restart
pm2 delete secure-ai-chat
# Then restart
pm2 start npm --name "secure-ai-chat" -- start

# PM2 will auto-restart on crashes
# To simulate crash:
pm2 restart secure-ai-chat
```

### Step 6: Verify Theme Switching

```bash
# Access the app in browser
# http://localhost:3000 (or your VM's public IP:3000)

# Click the theme toggle button (usually in header/sidebar)
# Verify:
# - Dark mode: Navy blue backgrounds with light text
# - Light mode: Light gray/white backgrounds with dark text
# - Theme persists after page refresh
```

### Step 7: Firewall Configuration (For External Access)

```bash
# Allow port 3000 through UFW firewall
sudo ufw allow 3000/tcp

# Check firewall status
sudo ufw status

# If firewall is inactive, enable it
sudo ufw enable
```

### Complete One-Line Installation (Alternative)

If you prefer the automated script:

```bash
# Single command installation
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash

# Then configure environment
cd secure-ai-chat
cp .env.example .env.local
nano .env.local  # Add your API keys

# Build and start
npm run build
npm start
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000
# OR
sudo ss -tlnp | grep :3000

# Kill the process or use a different port
PORT=3001 npm start
```

### Build Errors

```bash
# Clear cache and rebuild
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### Permission Errors

```bash
# Fix npm permissions (if needed)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Health Check Fails

```bash
# Check if app is actually running
ps aux | grep "next start"

# Check logs
# If using npm start: Check terminal output
# If using Docker: docker-compose logs
# If using systemd: sudo journalctl -u secure-ai-chat
# If using PM2: pm2 logs secure-ai-chat
```

## Summary

**Quick Start (3 commands):**
```bash
git clone https://github.com/mazh-cp/secure-ai-chat.git && cd secure-ai-chat
npm install && cp .env.example .env.local && nano .env.local
npm run build && npm start
```

**Verify Running:**
```bash
curl http://localhost:3000/api/health
```

**Verify Restart (Docker):**
```bash
docker-compose up -d
docker exec secure-ai-chat kill -9 1
sleep 5 && docker-compose ps  # Should show restarted
```

**Verify Restart (systemd):**
```bash
sudo systemctl start secure-ai-chat
sudo kill -9 $(pgrep -f "npm start")
sleep 5 && sudo systemctl status secure-ai-chat  # Should show restarted
```
