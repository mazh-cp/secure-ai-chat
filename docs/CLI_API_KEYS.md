# Setting API Keys via CLI

This guide explains how to set API keys (OpenAI, Lakera AI, Lakera Project ID, Check Point TE) via command line instead of using the web UI.

**Note:** This script uses the existing API endpoints and does not change application functionality or key handling. Keys are stored server-side in encrypted format, just like when using the web UI.

---

## Quick Start

### Basic Usage

```bash
# Set all keys at once
bash scripts/set-api-keys.sh \
  --openai-key "sk-..." \
  --lakera-key "lkr_..." \
  --lakera-project-id "proj_..."

# Set only OpenAI key
bash scripts/set-api-keys.sh --openai-key "sk-..."

# Interactive mode (prompts for each key)
bash scripts/set-api-keys.sh
```

---

## Command Line Options

| Option | Description | Required |
|--------|-------------|----------|
| `--openai-key KEY` | OpenAI API key (must start with `sk-`) | No |
| `--lakera-key KEY` | Lakera AI API key | No |
| `--lakera-project-id ID` | Lakera Project ID | No |
| `--lakera-endpoint URL` | Lakera API endpoint (default: `https://api.lakera.ai/v2/guard`) | No |
| `--checkpoint-te-key KEY` | Check Point Threat Emulation API key | No |
| `--api-url URL` | API base URL (default: `http://localhost:3000`) | No |
| `--help` | Show help message | No |

---

## Examples

### Local Development

```bash
# Set OpenAI key only
bash scripts/set-api-keys.sh --openai-key "sk-proj-..."

# Set all keys
bash scripts/set-api-keys.sh \
  --openai-key "sk-proj-..." \
  --lakera-key "lkr_..." \
  --lakera-project-id "proj_12345" \
  --checkpoint-te-key "TE_API_KEY_..."
```

### Remote Server

```bash
# Set keys on remote server
bash scripts/set-api-keys.sh \
  --api-url "https://your-domain.com" \
  --openai-key "sk-proj-..." \
  --lakera-key "lkr_..." \
  --lakera-project-id "proj_12345" \
  --checkpoint-te-key "TE_API_KEY_..."
```

### Check Point TE Key Only

```bash
# Set only Check Point TE key
bash scripts/set-api-keys.sh --checkpoint-te-key "TE_API_KEY_..."
```

### Using Environment Variable

```bash
# Set API URL via environment variable
export API_BASE_URL="https://your-domain.com"
bash scripts/set-api-keys.sh --openai-key "sk-..."
```

### Interactive Mode

```bash
# Run without arguments for interactive prompts
bash scripts/set-api-keys.sh
```

**Interactive prompts:**
```
ℹ Interactive mode - Enter API keys (press Enter to skip)

OpenAI API Key (sk-...): sk-proj-...
Lakera AI Key: lkr_...
Lakera Project ID: proj_12345
Lakera Endpoint [https://api.lakera.ai/v2/guard]: 
Check Point TE API Key: TE_API_KEY_...
```

---

## Validation

The script validates:

- **OpenAI Key**: Must start with `sk-` and be at least 20 characters
- **Lakera Key**: Must be at least 20 characters
- **Lakera Project ID**: Must be at least 5 characters
- **Lakera Endpoint**: Must be a valid URL (http:// or https://)
- **Check Point TE Key**: Must be at least 10 characters (prefix `TE_API_KEY_` is optional, will be handled by server)

---

## How It Works

1. **Connects to Server**: Checks if the server is running at the specified URL
2. **Validates Keys**: Performs basic format validation
3. **Sends Requests**: 
   - POSTs OpenAI/Lakera keys to `/api/keys` endpoint
   - POSTs Check Point TE key to `/api/te/config` endpoint
4. **Server Storage**: Keys are encrypted and stored server-side:
   - OpenAI/Lakera keys: `.secure-storage/api-keys.enc`
   - Check Point TE key: `.secure-storage/checkpoint-te-key.enc`
5. **Verification**: Displays which keys were successfully configured

**Important:** This script uses the same API endpoints as the web UI, so it does not change application functionality or key handling mechanisms.

---

## Security Notes

- ✅ Keys are encrypted at rest (AES-256-CBC)
- ✅ Keys are stored server-side only (not in browser)
- ✅ Keys are never exposed in logs or responses
- ✅ Keys persist across server restarts
- ⚠️ Keys are sent over HTTP/HTTPS (use HTTPS in production)

---

## Troubleshooting

### Server Not Running

```
❌ Cannot connect to server at http://localhost:3000
```

**Solution:**
- Start the server: `npm run dev` or `npm start`
- Or set `API_BASE_URL` to your remote server

### Invalid Key Format

```
❌ OpenAI key appears too short (minimum 20 characters)
```

**Solution:**
- Verify your API key is correct
- OpenAI keys should start with `sk-`
- Check for extra spaces or quotes

### HTTP 500 Error

```
❌ Failed to save API keys (HTTP 500)
```

**Solution:**
- Check server logs: `npm run dev` or `journalctl -u secure-ai-chat -f`
- Verify `.secure-storage` directory has write permissions
- Ensure server has disk space

---

## Alternative: Environment Variables

You can also set keys via environment variables (takes priority over stored keys):

```bash
# In .env.local or system environment
export OPENAI_API_KEY="sk-..."
export LAKERA_AI_KEY="lkr_..."
export LAKERA_PROJECT_ID="proj_12345"
export LAKERA_ENDPOINT="https://api.lakera.ai/v2/guard"
```

**Note:** Environment variables take priority over stored keys. If you set keys via CLI but also have environment variables, the environment variables will be used.

---

## Checking Configured Keys

### Via API

```bash
# Check OpenAI/Lakera keys
curl http://localhost:3000/api/keys

# Check Check Point TE key
curl http://localhost:3000/api/te/config
```

### Via Script

```bash
# The script shows configured keys after saving
✅ API keys saved successfully!

ℹ Configured keys:
  openAiKey: true
  lakeraAiKey: true
  lakeraProjectId: true
```

---

## Updating Keys

To update a key, simply run the script again with the new value:

```bash
# Update OpenAI key
bash scripts/set-api-keys.sh --openai-key "sk-new-key-..."
```

The script merges new keys with existing ones, so you only need to provide the keys you want to update.

---

## Removing Keys

Keys cannot be removed via this CLI script. To remove keys:

1. **Via Web UI**: Go to Settings page → Remove keys
2. **Via API**: `DELETE /api/keys?key=openAiKey` (requires PIN if configured)
3. **Manually**: Delete `.secure-storage/api-keys.enc` file (not recommended)

---

## Integration with Installation Scripts

The CLI script can be used in installation/upgrade scripts:

```bash
# After installation, set keys
bash scripts/set-api-keys.sh \
  --api-url "http://localhost:3000" \
  --openai-key "$OPENAI_API_KEY" \
  --lakera-key "$LAKERA_AI_KEY" \
  --lakera-project-id "$LAKERA_PROJECT_ID"
```

---

## See Also

- [API Endpoints Documentation](API_ENDPOINTS_FOR_SECURITY.md)
- [Installation Guide](INSTALL_UBUNTU_VM.md)
- [Upgrade Guide](UPGRADE_REMOTE.md)
