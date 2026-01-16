# Finding Your Installation

If you get "App directory does not exist: /opt/secure-ai-chat", use one of these options:

## Option 1: Find Installation Automatically

The upgrade script will now automatically search for the installation. Just run:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

It will search common locations and ask you to confirm.

## Option 2: Manual Search

Run these commands to find where the application is installed:

```bash
# Check common locations
ls -la /opt/secure-ai-chat 2>/dev/null || echo "Not in /opt"
ls -la ~/secure-ai-chat 2>/dev/null || echo "Not in home directory"

# Check systemd service for path
sudo cat /etc/systemd/system/secure-ai-chat.service 2>/dev/null | grep WorkingDirectory || echo "Service file not found"

# Check running processes
ps aux | grep -i "next\|node.*secure" | grep -v grep

# Find installation (look for package.json)
sudo find /home /opt -name "package.json" -path "*/secure-ai-chat/package.json" 2>/dev/null

# Find .next directory (indicates Next.js installation)
sudo find /home /opt -type d -name ".next" -path "*/secure-ai-chat/.next" 2>/dev/null
```

## Option 3: Specify Correct Path

If you found the installation path, specify it:

```bash
APP_DIR=/home/adminuser/secure-ai-chat curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-production.sh | bash
```

Or for the upgrade script directly:

```bash
cd /home/adminuser/secure-ai-chat
bash scripts/deploy/upgrade.sh --app-dir /home/adminuser/secure-ai-chat --ref main
```

## Option 4: Fresh Install (If Not Installed)

If the application is not installed, run a fresh install:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-remote.sh | bash
```

## Quick Diagnosis Commands

Run these commands on your VM to diagnose:

```bash
# 1. Check current directory
pwd
ls -la

# 2. Check systemd service (if exists)
sudo systemctl status secure-ai-chat 2>/dev/null || echo "Service not found"

# 3. Find package.json
find ~ /opt /var/www -name "package.json" -path "*/secure-ai-chat/*" 2>/dev/null | head -5

# 4. Check for .next directory
find ~ /opt /var/www -type d -name ".next" -path "*/secure-ai-chat/*" 2>/dev/null | head -5
```

## Common Installation Paths

- `/opt/secure-ai-chat` - Default production path
- `~/secure-ai-chat` - Home directory installation
- `/home/<user>/secure-ai-chat` - User-specific installation
- `/var/www/secure-ai-chat` - Web server path

## Troubleshooting

### If you can't find the installation:

1. **Check if it was installed at all:**
   ```bash
   sudo systemctl list-units | grep secure-ai-chat
   ```

2. **Check for git repositories:**
   ```bash
   find ~ /opt -type d -name ".git" -path "*secure-ai-chat*" 2>/dev/null
   ```

3. **Check for environment files:**
   ```bash
   find ~ /opt -name ".env.local" -path "*secure-ai-chat*" 2>/dev/null
   ```

### If installation doesn't exist:

Run a fresh install:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu-remote.sh | bash
```

---

**Need Help?** Check `docs/PRODUCTION_UPGRADE_SAFE.md` for detailed upgrade instructions.
