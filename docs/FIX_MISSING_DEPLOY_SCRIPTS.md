# Troubleshooting: Deploy Scripts Not Found on VM

If you encounter `No such file or directory` when trying to run `scripts/deploy/upgrade.sh` on your remote VM, it means the deploy scripts are not present on the VM. This can happen if:

1. Your VM's repository clone is not up-to-date with the latest changes on GitHub.
2. The VM installation was done before the deploy scripts were added.
3. The VM doesn't have a git repository set up.

## Solution Options

### Option 1 (Recommended): Pull Latest Changes from GitHub

If your VM has a git repository set up:

```bash
cd /opt/secure-ai-chat
git pull origin main

# Verify the scripts exist
ls -la scripts/deploy/
```

If you get `fatal: not a git repository`, see Option 2 below.

---

### Option 2: Download Scripts Directly from GitHub

If your VM doesn't have git set up or you prefer not to update the entire repository:

```bash
cd /opt/secure-ai-chat
mkdir -p scripts/deploy

# Download all deploy scripts
curl -o scripts/deploy/upgrade.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/upgrade.sh

curl -o scripts/deploy/common.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/common.sh

curl -o scripts/deploy/clean-install.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/clean-install.sh

# Note: Use sudo for all downloads to avoid permission issues
sudo curl -o scripts/deploy/secure-ai-chat.service \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/secure-ai-chat.service

# Make scripts executable (use sudo if files were created with sudo)
sudo chmod +x scripts/deploy/*.sh

# Fix ownership if needed (replace adminuser with your actual app user)
# sudo chown adminuser:adminuser scripts/deploy/*

# Verify scripts exist and are executable
ls -la scripts/deploy/
```

---

### Option 3: One-Command Download (All Scripts at Once)

```bash
cd /opt/secure-ai-chat
mkdir -p scripts/deploy && \
curl -o scripts/deploy/upgrade.sh https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/upgrade.sh && \
curl -o scripts/deploy/common.sh https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/common.sh && \
curl -o scripts/deploy/clean-install.sh https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/clean-install.sh && \
curl -o scripts/deploy/secure-ai-chat.service https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/secure-ai-chat.service && \
chmod +x scripts/deploy/*.sh && \
ls -la scripts/deploy/
```

---

## Verify Installation

After downloading the scripts, verify they exist and are executable:

```bash
cd /opt/secure-ai-chat
ls -la scripts/deploy/
```

Expected output should show:
```
-rwxr-xr-x 1 user user  ... upgrade.sh
-rwxr-xr-x 1 user user  ... common.sh
-rwxr-xr-x 1 user user  ... clean-install.sh
-rw-r--r-- 1 user user  ... secure-ai-chat.service
```

---

## Run the Upgrade Script

Once the scripts are in place, you can run the upgrade:

```bash
cd /opt/secure-ai-chat
sudo bash scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main
```

---

### Error: "Permission denied" when downloading files

If you get "Permission denied" when using `curl -o`, use `sudo`:

```bash
# Create directory first
sudo mkdir -p scripts/deploy

# Download with sudo
sudo curl -o scripts/deploy/upgrade.sh \
  https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/upgrade.sh

# Make executable with sudo
sudo chmod +x scripts/deploy/*.sh

# Fix ownership if needed (replace adminuser with your app user)
sudo chown adminuser:adminuser scripts/deploy/*
```

---

## Troubleshooting

### Error: "common.sh: No such file or directory"

The `upgrade.sh` script requires `common.sh` to be in the same directory. Make sure both files are downloaded:

```bash
cd /opt/secure-ai-chat/scripts/deploy
ls -la common.sh upgrade.sh
```

### Error: "Permission denied"

Make sure the scripts are executable:

```bash
chmod +x scripts/deploy/*.sh
```

### Error: "scripts/deploy: No such file or directory"

Create the directory first:

```bash
cd /opt/secure-ai-chat
mkdir -p scripts/deploy
```

---

## Quick Reference

- **Upgrade script**: `scripts/deploy/upgrade.sh`
- **Common utilities**: `scripts/deploy/common.sh` (required)
- **Clean install**: `scripts/deploy/clean-install.sh`
- **Service template**: `scripts/deploy/secure-ai-chat.service`
- **GitHub URL**: `https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/deploy/`
