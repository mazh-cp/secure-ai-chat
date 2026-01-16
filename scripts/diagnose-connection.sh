#!/bin/bash
# Connection Diagnosis Script

echo "=== Diagnosing Connection Issue ==="
echo ""

# Check service status
echo "1. Checking systemd service status..."
if systemctl is-active --quiet secure-ai-chat 2>/dev/null; then
    echo "   ✅ Service is running"
    sudo systemctl status secure-ai-chat --no-pager | head -5
else
    echo "   ❌ Service is NOT running"
    echo "   Try: sudo systemctl start secure-ai-chat"
fi
echo ""

# Check port
echo "2. Checking port 3000..."
if sudo ss -tlnp 2>/dev/null | grep -q ":3000"; then
    echo "   ✅ Port 3000 is listening"
    sudo ss -tlnp | grep :3000
else
    echo "   ❌ Port 3000 is NOT listening"
    echo "   Application may not be running"
fi
echo ""

# Check logs
echo "3. Recent service logs (last 10 lines)..."
sudo journalctl -u secure-ai-chat -n 10 --no-pager 2>/dev/null || echo "   No logs found or service doesn't exist"
echo ""

# Check app directory
echo "4. Checking application directory..."
APP_DIR=""
if [ -d ~/secure-ai-chat ]; then
    APP_DIR=~/secure-ai-chat
elif [ -d /opt/secure-ai-chat ]; then
    APP_DIR=/opt/secure-ai-chat
fi

if [ -n "$APP_DIR" ]; then
    echo "   Found: $APP_DIR"
    if [ -d "$APP_DIR/.next" ]; then
        echo "   ✅ Application is built (.next directory exists)"
    else
        echo "   ❌ Application is NOT built (.next directory missing)"
        echo "   Run: cd $APP_DIR && npm run build"
    fi
    if [ -f "$APP_DIR/.env.local" ]; then
        echo "   ✅ Configuration file exists"
        grep -E "HOSTNAME|PORT" "$APP_DIR/.env.local" 2>/dev/null || echo "   ⚠️  HOSTNAME/PORT not set in .env.local"
    else
        echo "   ⚠️  .env.local not found"
    fi
else
    echo "   ❌ Application directory not found"
fi
echo ""

# Test connection
echo "5. Testing connection..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ✅ Connection successful!"
    curl -s http://localhost:3000/api/health | head -1
else
    echo "   ❌ Connection failed"
    echo "   Error: $(curl -s http://localhost:3000/api/health 2>&1 | head -1)"
fi
echo ""

echo "=== Diagnosis Complete ==="
echo ""
echo "Quick fixes:"
echo "  - Start service: sudo systemctl start secure-ai-chat"
echo "  - Check logs: sudo journalctl -u secure-ai-chat -f"
echo "  - Manual start: cd $APP_DIR && npm start"
