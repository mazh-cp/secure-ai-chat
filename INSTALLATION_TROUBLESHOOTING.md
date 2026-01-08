# Installation Troubleshooting

## Issue: Script doesn't start installation

### Problem

When running:
```bash
wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

Nothing happens or you get a "404 Not Found" error.

### Solution

The repository must be pushed to GitHub first before the remote installation script will work.

#### Option 1: Push to GitHub First (Recommended)

1. **Push the repository to GitHub:**
   ```bash
   cd /path/to/Secure-Ai-Chat
   ./scripts/push-to-github.sh "Initial release - install script ready"
   ```

2. **Verify the script is accessible:**
   ```bash
   curl -I https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh
   ```
   Should return `200 OK`

3. **Then run the installation on your Ubuntu VM:**
   ```bash
   wget -qO- https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
   ```

#### Option 2: Use Local Script

If you want to install without pushing to GitHub first:

1. **Copy the script to your Ubuntu VM:**
   ```bash
   # On your local machine, copy the script
   scp scripts/install-ubuntu.sh user@ubuntu-vm:~/
   
   # Or manually copy/paste the script content
   ```

2. **On your Ubuntu VM, make it executable and run:**
   ```bash
   chmod +x install-ubuntu.sh
   bash install-ubuntu.sh
   ```

#### Option 3: Clone and Install Locally

1. **Clone the repository locally (if you have access to the source):**
   ```bash
   # On Ubuntu VM, if you have git access to the repo
   git clone https://github.com/mazh-cp/secure-ai-chat.git
   cd secure-ai-chat
   bash scripts/install-ubuntu.sh
   ```

### Verification

To check if the script is accessible on GitHub:

```bash
# Check if repository exists
curl -I https://github.com/mazh-cp/secure-ai-chat

# Check if script file exists
curl -I https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh

# Test download (without executing)
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh
```

### Common Issues

**Issue**: `404 Not Found`
- **Cause**: Repository or file doesn't exist on GitHub
- **Fix**: Push the repository to GitHub first

**Issue**: `403 Forbidden`
- **Cause**: Repository is private
- **Fix**: Make repository public or use personal access token

**Issue**: Script downloads but doesn't execute
- **Cause**: Script might have syntax errors or the repository structure is different
- **Fix**: Check script syntax: `bash -n install-ubuntu.sh`

**Issue**: Script hangs at "Continue? (y/N)"
- **Cause**: Script detects interactive terminal
- **Fix**: This shouldn't happen when piped, but if it does, use: `echo y | bash install-ubuntu.sh`

## Quick Setup Checklist

- [ ] Repository pushed to GitHub
- [ ] Script file exists at: `scripts/install-ubuntu.sh`
- [ ] Script is executable: `chmod +x scripts/install-ubuntu.sh`
- [ ] Script syntax is valid: `bash -n scripts/install-ubuntu.sh`
- [ ] GitHub repository is public (or use token for private)
- [ ] Ubuntu VM has internet access
- [ ] Ubuntu VM has sudo privileges
