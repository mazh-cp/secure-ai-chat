# Updating API Keys on Existing VM via Terminal Session

This guide shows you how to update API keys (OpenAI, Lakera AI, and Check Point) on an existing VM that's already running, using a terminal SSH session.

## Prerequisites

1. SSH access to the VM
2. Application already installed on the VM
3. Terminal/SSH client installed on your local machine

## Step 1: Connect to the VM

Connect to your VM via SSH:

```bash
# Connect to VM (replace with your VM's IP/hostname and username)
ssh username@vm-ip-address

# Example:
ssh admin@192.168.1.100
# or
ssh ubuntu@your-vm.example.com
```

## Step 2: Navigate to Application Directory

Once connected, navigate to the application directory:

```bash
# Default installation location
cd /opt/secure-ai-chat

# Or if installed in user's home directory
cd ~/secure-ai-chat

# Verify you're in the right place (should show package.json)
ls -la package.json
```

## Step 3: Update API Keys

You have two options: **Interactive Mode** or **Command-Line Mode**

### Option A: Interactive Mode (Recommended for First Time)

Interactive mode prompts you for each key (input is hidden for security):

```bash
./scripts/update-api-keys.sh
```

The script will prompt:
```
Interactive mode - Enter keys to update (press Enter to skip)

OpenAI API Key (sk-...): [hidden input - type your key]
Lakera AI API Key (lak-...): [hidden input - type your key]
Check Point ThreatCloud API Key: [hidden input - type your key]
```

**Press Enter** to skip a key if you don't want to update it.

### Option B: Command-Line Mode (Recommended for Automation)

Update keys directly via command-line arguments:

```bash
# Update OpenAI key only
./scripts/update-api-keys.sh --openai-key "sk-proj-abc123..."

# Update Lakera AI key only
./scripts/update-api-keys.sh --lakera-key "lak_abc123..."

# Update Check Point ThreatCloud key only
./scripts/update-api-keys.sh --checkpoint-key "cp_abc123..."

# Update multiple keys at once
./scripts/update-api-keys.sh \
  --openai-key "sk-proj-abc123..." \
  --lakera-key "lak_abc123..." \
  --checkpoint-key "cp_abc123..."

# Update OpenAI and Lakera (skip Check Point)
./scripts/update-api-keys.sh \
  --openai-key "sk-proj-abc123..." \
  --lakera-key "lak_abc123..."
```

## Step 4: Verify Keys Are Updated

After updating, verify the keys are saved correctly:

### Method 1: Check via API (if server is running)

```bash
# Check key configuration status
curl http://localhost:3000/api/keys/retrieve

# Should show which keys are configured (without exposing actual keys)
```

### Method 2: Check Service Logs

```bash
# View service logs to see if keys loaded correctly
sudo journalctl -u secure-ai-chat -f | tail -20

# Or check recent logs
sudo journalctl -u secure-ai-chat --since "5 minutes ago"
```

### Method 3: Test the Application

Open your browser and navigate to the application. Try:
- Sending a chat message (tests OpenAI key)
- The application should work if keys are correctly configured

## Complete Example Session

Here's a complete example of updating keys on a VM:

```bash
# Step 1: SSH to VM
ssh admin@192.168.1.100

# Step 2: Navigate to application directory
cd /opt/secure-ai-chat

# Step 3: Update OpenAI key via command-line
./scripts/update-api-keys.sh --openai-key "sk-proj-your-actual-key-here"

# Step 4: Verify service restarted
sudo systemctl status secure-ai-chat

# Step 5: Check service logs
sudo journalctl -u secure-ai-chat -n 50

# Step 6: Test application
curl http://localhost:3000/api/health
```

## Troubleshooting

### Script Not Found

If you get "script not found", check the installation directory:

```bash
# Find application directory
find /opt /home -name "update-api-keys.sh" 2>/dev/null

# Or check systemd service for working directory
sudo systemctl status secure-ai-chat | grep WorkingDirectory
```

### Permission Denied

If you get permission errors:

```bash
# Make script executable
chmod +x scripts/update-api-keys.sh

# Or if you need sudo
sudo chmod +x /opt/secure-ai-chat/scripts/update-api-keys.sh
```

### Keys Not Working After Update

If keys don't work after update:

```bash
# 1. Restart service manually
sudo systemctl restart secure-ai-chat

# 2. Check service status
sudo systemctl status secure-ai-chat

# 3. View service logs for errors
sudo journalctl -u secure-ai-chat -f

# 4. Verify keys are saved (check file permissions)
ls -la /opt/secure-ai-chat/.secure-storage/

# 5. Re-run the update script
./scripts/update-api-keys.sh --openai-key "sk-..."
```

### Service Not Running

If the service isn't running after key update:

```bash
# Start service
sudo systemctl start secure-ai-chat

# Enable service to start on boot
sudo systemctl enable secure-ai-chat

# Check status
sudo systemctl status secure-ai-chat
```

## Alternative: Update Keys via API (If Server is Running)

If the server is already running, you can also update keys via the API endpoint:

```bash
# Update OpenAI key via API
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"keys": {"openAiKey": "sk-..."}}'

# Update multiple keys
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "keys": {
      "openAiKey": "sk-...",
      "lakeraAiKey": "lak-...",
      "lakeraProjectId": "proj-..."
    }
  }'
```

However, **using the CLI script is recommended** as it:
- Works even when the server is not running
- Uses the same encryption mechanism as the application
- Automatically restarts the service
- Provides better error handling

## Security Notes

1. **Never share your keys** - API keys are sensitive and should be kept secret
2. **Use interactive mode** - Input is hidden when typing keys (no echo)
3. **Protect terminal history** - Clear history after entering keys:
   ```bash
   history -c  # Clear current session history
   exit        # Logout and login again to clear from memory
   ```
4. **Check file permissions** - Keys are stored with restrictive permissions (600)
   ```bash
   ls -la /opt/secure-ai-chat/.secure-storage/
   # Should show -rw------- (owner read/write only)
   ```

## Quick Reference

```bash
# Connect to VM
ssh username@vm-ip

# Navigate to app
cd /opt/secure-ai-chat

# Update keys (interactive)
./scripts/update-api-keys.sh

# Update keys (command-line)
./scripts/update-api-keys.sh --openai-key "sk-..."

# Check service status
sudo systemctl status secure-ai-chat

# View logs
sudo journalctl -u secure-ai-chat -f

# Restart service
sudo systemctl restart secure-ai-chat
```

## See Also

- [Full API Keys Update Guide](./UPDATE_API_KEYS.md)
- [Remote Installation Guide](./INSTALL_UBUNTU_VM.md)
- [Service Management](../README.md)
