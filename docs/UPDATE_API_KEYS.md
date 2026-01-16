# Updating API Keys via CLI on Server Side

This guide explains how to update API keys (OpenAI, Lakera AI, and Check Point ThreatCloud) via command line on the server after remote installation.

## Quick Start

### Interactive Mode

Run the script without arguments to enter keys interactively:

```bash
cd /opt/secure-ai-chat  # or your installation directory
./scripts/update-api-keys.sh
```

The script will prompt you to enter each key (input is hidden for security).

### Command Line Mode

Update keys directly via command line arguments:

```bash
# Update OpenAI key only
./scripts/update-api-keys.sh --openai-key "sk-..."

# Update multiple keys
./scripts/update-api-keys.sh \
  --openai-key "sk-..." \
  --lakera-key "lak-..." \
  --checkpoint-key "cp-..."

# Update Lakera and Check Point keys
./scripts/update-api-keys.sh \
  --lakera-key "lak-..." \
  --checkpoint-key "cp-..."
```

## Prerequisites

1. The application must be installed (via `install-ubuntu-remote.sh`)
2. Node.js and npm must be available in PATH
3. You must have read/write access to the application directory

## Script Location

The script automatically detects the application directory by checking:
1. Current directory (if `package.json` exists)
2. Parent directory (if `../package.json` exists)
3. `/opt/secure-ai-chat` (default installation location)
4. `$HOME/secure-ai-chat` (user installation)

## Options

- `--openai-key KEY` - Set OpenAI API key
- `--lakera-key KEY` - Set Lakera AI API key
- `--checkpoint-key KEY` - Set Check Point ThreatCloud API key
- `--help, -h` - Show help message

## Examples

### Example 1: Update OpenAI Key

```bash
cd /opt/secure-ai-chat
./scripts/update-api-keys.sh --openai-key "sk-proj-abc123..."
```

### Example 2: Update All Keys

```bash
cd /opt/secure-ai-chat
./scripts/update-api-keys.sh \
  --openai-key "sk-proj-abc123..." \
  --lakera-key "lak_abc123..." \
  --checkpoint-key "cp_abc123..."
```

### Example 3: Interactive Mode

```bash
cd /opt/secure-ai-chat
./scripts/update-api-keys.sh
# Follow prompts to enter keys
```

## Service Restart

If the application is running as a systemd service (`secure-ai-chat`), the script will automatically restart the service after updating keys to apply the changes.

## Key Storage

Keys are stored in encrypted format at:
- `.secure-storage/api-keys.enc` (OpenAI and Lakera keys)
- `.secure-storage/threatcloud-key.enc` (Check Point key)

The encryption uses AES-256-CBC with a key derived from the `ENCRYPTION_KEY` environment variable (or a default key if not set).

## Troubleshooting

### Script Not Found

If you get "script not found", ensure you're in the correct directory:

```bash
# Find installation directory
find /opt /home -name "package.json" -path "*/secure-ai-chat/package.json" 2>/dev/null

# Or check systemd service
systemctl status secure-ai-chat | grep WorkingDirectory
```

### Permission Denied

If you get permission errors:

```bash
# Check ownership
ls -la /opt/secure-ai-chat/.secure-storage

# Fix ownership if needed (replace 'user' with actual user)
sudo chown -R user:user /opt/secure-ai-chat/.secure-storage
```

### Service Not Restarting

If the service doesn't restart automatically:

```bash
# Manually restart service
sudo systemctl restart secure-ai-chat

# Check service status
sudo systemctl status secure-ai-chat

# View logs
sudo journalctl -u secure-ai-chat -f
```

### Keys Not Working

After updating keys, verify they're saved correctly:

```bash
# Check if keys are configured (via API if server is running)
curl http://localhost:3000/api/keys/retrieve

# Or check service logs
sudo journalctl -u secure-ai-chat | tail -20
```

## Security Notes

1. **Never commit keys to git** - Keys are stored in `.secure-storage/` which should be in `.gitignore`
2. **Use secure input** - The interactive mode hides input (no echo)
3. **Protect script access** - Ensure only authorized users can run the script
4. **Rotate keys regularly** - Update keys periodically for security

## Alternative: Using API Endpoint

If the server is running, you can also update keys via the API endpoint:

```bash
# Update OpenAI key via API
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"openaiApiKey": "sk-..."}'

# Update multiple keys
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "openaiApiKey": "sk-...",
    "lakeraApiKey": "lak-...",
    "threatCloudApiKey": "cp-..."
  }'
```

However, the CLI script is recommended as it:
- Works even when the server is not running
- Uses the same encryption mechanism as the application
- Automatically restarts the service
- Provides better error handling

## See Also

- [Installation Guide](../INSTALL.md)
- [Remote Installation Guide](./INSTALL_UBUNTU_VM.md)
- [API Documentation](../README.md)
