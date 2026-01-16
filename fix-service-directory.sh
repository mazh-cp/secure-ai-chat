#!/bin/bash
# Fix Service Directory Issue
# This script fixes the systemd service to ensure it runs from the correct directory

SERVICE_FILE="/etc/systemd/system/secure-ai-chat.service"
APP_DIR="/opt/secure-ai-chat"
USER="adminuser"

echo "=== Fixing Secure AI Chat Service ==="
echo ""

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
    echo "❌ Service file not found: $SERVICE_FILE"
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Application directory not found: $APP_DIR"
    exit 1
fi

echo "✅ Service file found: $SERVICE_FILE"
echo "✅ Application directory found: $APP_DIR"
echo ""

# Find Node.js and npm paths
echo "Finding Node.js and npm paths..."
export NVM_DIR="/home/$USER/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    nvm use 25.2.1 > /dev/null 2>&1
    NODE_PATH=$(which node)
    NPM_PATH=$(which npm)
    echo "✅ Node.js: $NODE_PATH"
    echo "✅ npm: $NPM_PATH"
else
    echo "❌ nvm not found. Please install Node.js v25.2.1 first."
    exit 1
fi

echo ""
echo "Creating updated service file..."

# Create backup
sudo cp "$SERVICE_FILE" "${SERVICE_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
echo "✅ Backup created"

# Create new service file
sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Secure AI Chat (Next.js) - v1.0.11
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOSTNAME=0.0.0.0"

# Use bash to source nvm, change directory, and run npm start
# The cd command ensures we're in the right directory before running npm
ExecStart=/usr/bin/env bash -lc 'source "/home/$USER/.nvm/nvm.sh" && nvm use 25.2.1 && cd "$APP_DIR" && npm start'

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=secure-ai-chat

# Security
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=$APP_DIR/.secure-storage $APP_DIR/.next $APP_DIR/.storage

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file updated"
echo ""

# Reload systemd
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload
echo "✅ Systemd reloaded"
echo ""

# Restart service
echo "Restarting service..."
sudo systemctl restart secure-ai-chat
sleep 2

# Check status
echo ""
echo "Service status:"
sudo systemctl status secure-ai-chat --no-pager | head -10

echo ""
echo "=== Fix Complete ==="
echo ""
echo "If service is still failing, check logs:"
echo "  sudo journalctl -u secure-ai-chat -n 50"
echo ""
