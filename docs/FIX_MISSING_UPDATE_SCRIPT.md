# Fix: update-api-keys.sh Script Not Found on VM

If you get "No such file or directory" when running the update script on your VM, follow these steps:

## Quick Fix

The script might not be on your VM yet. Here's how to fix it:

### Option 1: Pull Latest Code from GitHub (Recommended)

If your VM installation is connected to GitHub, pull the latest code:

```bash
# SSH to your VM
ssh username@your-vm-ip

# Navigate to application directory
cd /opt/secure-ai-chat

# Pull latest code from GitHub
git pull origin main

# Make script executable
chmod +x scripts/update-api-keys.sh

# Now try running it
./scripts/update-api-keys.sh
```

### Option 2: Download Script Directly from GitHub

If git pull doesn't work, download the script directly:

```bash
# SSH to your VM
ssh username@your-vm-ip

# Navigate to application directory
cd /opt/secure-ai-chat

# Create scripts directory if it doesn't exist
mkdir -p scripts

# Download the script from GitHub
curl -o scripts/update-api-keys.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/update-api-keys.sh

# Make it executable
chmod +x scripts/update-api-keys.sh

# Verify it exists
ls -la scripts/update-api-keys.sh

# Now try running it
./scripts/update-api-keys.sh
```

### Option 3: Manual Update Using Node.js (If Script Not Available)

If you can't get the script, you can update keys manually using Node.js:

```bash
# SSH to your VM
ssh username@your-vm-ip

# Navigate to application directory
cd /opt/secure-ai-chat

# Create a temporary Node.js script
cat > /tmp/update-keys-manual.js << 'EOF'
const { saveApiKeys } = require('./lib/api-keys-storage');
const { setTeApiKey } = require('./lib/checkpoint-te');

// Get keys from command line arguments
const args = process.argv.slice(2);
const keys = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];
  if (key && value) {
    keys[key] = value;
  }
}

(async () => {
  try {
    const apiKeys = {};
    if (keys.openaiApiKey) apiKeys.openaiApiKey = keys.openaiApiKey;
    if (keys.lakeraApiKey) apiKeys.lakeraApiKey = keys.lakeraApiKey;
    
    if (Object.keys(apiKeys).length > 0) {
      await saveApiKeys(apiKeys);
      console.log('✅ API keys updated');
    }
    
    if (keys.threatCloudApiKey) {
      await setTeApiKey(keys.threatCloudApiKey);
      console.log('✅ Check Point key updated');
    }
    
    console.log('✅ All keys updated successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
EOF

# Use the script to update keys
# Example: Update OpenAI key
node /tmp/update-keys-manual.js openaiApiKey "sk-your-key-here"

# Example: Update multiple keys
node /tmp/update-keys-manual.js \
  openaiApiKey "sk-your-key-here" \
  lakeraApiKey "lak-your-key-here" \
  threatCloudApiKey "cp-your-key-here"

# Restart service
sudo systemctl restart secure-ai-chat

# Clean up
rm /tmp/update-keys-manual.js
```

## Verify Script Exists

After pulling or downloading, verify the script exists:

```bash
cd /opt/secure-ai-chat
ls -la scripts/update-api-keys.sh

# Should show something like:
# -rwxr-xr-x 1 user user 12345 Dec 31 12:00 scripts/update-api-keys.sh
```

## Check Current Repository Status

Check if your VM is connected to the GitHub repository:

```bash
cd /opt/secure-ai-chat

# Check git remote
git remote -v

# Check git status
git status

# Check if you're on the latest commit
git log --oneline -5
```

## Alternative: Use API Endpoint (If Server is Running)

If the script is missing but the server is running, you can update keys via the API:

```bash
# Update OpenAI key via API
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"keys": {"openAiKey": "sk-your-key-here"}}'

# Update Lakera key
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"keys": {"lakeraAiKey": "lak-your-key-here"}}'

# Update Check Point key (separate endpoint)
curl -X POST http://localhost:3000/api/te/config \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "cp-your-key-here"}'
```

## Prevention: Keep VM Updated

To prevent this issue in the future, regularly pull the latest code:

```bash
# Add to cron or run periodically
cd /opt/secure-ai-chat
git pull origin main
```

Or set up automatic updates.

## See Also

- [Update Keys Guide](./UPDATE_KEYS_ON_VM.md)
- [Full API Keys Documentation](./UPDATE_API_KEYS.md)
