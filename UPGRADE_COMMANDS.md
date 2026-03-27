# One-Step Production Upgrade Commands

**Latest**: v1.0.20 (main)  
**Last Updated**: 2026-03-28

## 🚀 Upgrade remote VM to v1.0.20 (recommended)

### Option A — Stricter upgrade (type-check + health probe) — **v2**

The wrapper URL below returns **404** until `scripts/upgrade-remote-production-v2.sh` is **pushed to `main`**. Use **Option A1** (same behavior, one file) — it only needs `upgrade-curl-production.sh` on GitHub.

#### Option A1 — Works even when the v2 wrapper is missing (recommended)

`GIT_REF`, `RUN_TYPECHECK`, and `HEALTH_RETRIES` must apply to **`bash`**, not `curl` (prefix `bash`, not the URL):

**Latest code on `main` (use this if you have not pushed a release tag):**

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | GIT_REF=main RUN_TYPECHECK=1 bash
```

**Pin a release tag** (only works after `git tag v1.0.20 && git push origin v1.0.20`). If the tag is missing on GitHub, the script **falls back to `main`** and prints a warning:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | GIT_REF=v1.0.20 RUN_TYPECHECK=1 bash
```

With `RUN_TYPECHECK=1`, the script runs **`npm run type-check`** before build and (on current `main` of this repo) retries **`/api/health`** up to **12** times after start. Older copies of `upgrade-curl-production.sh` on GitHub ignore those options but still checkout and build.

#### Option A2 — Thin wrapper (after you push it to GitHub)

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v2.sh | bash
```

Same defaults as A1 once the file exists on `main`.

**Follow `main` with the wrapper:**

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-remote-production-v2.sh | GIT_REF=main bash
```

**From your laptop** (repo checkout; sets SSH and runs the same remote flow):

```bash
export SSH_TARGET=adminuser@YOUR_VM_IP
bash scripts/run-remote-production-upgrade.sh
```

### Option B — Standard one-liner (`main`, no type-check)

SSH into your production VM (e.g. `ssh adminuser@57.151.99.6`) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
```

This script:
- Uses app dir `/home/adminuser/secure-ai-chat` by default (or pass path: `curl ... | bash -s -- /opt/secure-ai-chat`)
- Backs up `.env.local`, `.secure-storage`, and `.storage` to `/tmp`
- Fetches `main` by default (override with `GIT_REF`), runs `npm install`, builds, restarts `secure-ai-chat`
- Optional: `RUN_TYPECHECK=1` runs `npm run type-check` before build; `HEALTH_RETRIES=N` retries `/api/health` (if unset but `RUN_TYPECHECK=1`, defaults to 12)

**Custom app directory:**

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | APP_DIR=/opt/secure-ai-chat bash
# or
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash -s -- /opt/secure-ai-chat
```

---

## 📋 Legacy / Alternative

**Version**: 1.0.4  
**Branch**: `release/unifi-theme-safe-final`

SSH into your production VM and run:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh | bash
```

That's it! The script will automatically:
- ✅ Backup current deployment
- ✅ Pull latest code from GitHub
- ✅ Install dependencies
- ✅ Build the application
- ✅ Restart the service
- ✅ Verify deployment

---

## 📋 Alternative Commands

### Option 1: Download and Run Locally

```bash
# Download the script
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/release/unifi-theme-safe-final/scripts/upgrade-production.sh -o upgrade.sh

# Make it executable
chmod +x upgrade.sh

# Run it
./upgrade.sh
```

### Option 2: If Repository Already Exists

```bash
cd /home/adminuser/secure-ai-chat
git pull origin release/unifi-theme-safe-final
bash scripts/upgrade-production.sh
```

### Option 3: Custom Configuration

```bash
# Custom repository directory
REPO_DIR=/opt/secure-ai-chat bash scripts/upgrade-production.sh

# Custom branch
BRANCH=main bash scripts/upgrade-production.sh

# All custom
REPO_DIR=/opt/secure-ai-chat \
BRANCH=main \
SERVICE_NAME=my-app \
bash scripts/upgrade-production.sh
```

---

## ✅ Verification Commands

After upgrade, verify everything works:

```bash
# Check service status
sudo systemctl status secure-ai-chat

# Check health endpoint
curl http://localhost:3000/api/health

# Check service logs
sudo journalctl -u secure-ai-chat -n 50
```

---

## 🔧 Default Configuration

| Variable | Default Value |
|----------|---------------|
| `REPO_DIR` | `/home/adminuser/secure-ai-chat` |
| `BRANCH` | `release/unifi-theme-safe-final` |
| `SERVICE_USER` | `adminuser` |
| `SERVICE_NAME` | `secure-ai-chat` |

---

## 📚 Detailed Documentation

For more information, see:
- `PRODUCTION_UPGRADE.md` - Complete upgrade guide with troubleshooting
- `RELEASE_NOTES_v1.0.4.md` - Release notes for version 1.0.4
- `RELEASE_CHECKLIST_v1.0.4.md` - Pre-deployment checklist

---

## 🆘 Quick Troubleshooting

### `curl: (22) ... 404` on `upgrade-remote-production-v2.sh`

That file is not on GitHub `main` yet. Use **Option A1** above, or push `scripts/upgrade-remote-production-v2.sh` to `mazh-cp/secure-ai-chat` on `main`.

### `Ref v1.0.20 not found` (or any `v*` tag)

The tag is not on GitHub yet. Either push it (`git tag v1.0.20 && git push origin v1.0.20`) or use **`GIT_REF=main`**. Recent `upgrade-curl-production.sh` falls back to **`main`** automatically when a `v*` tag is missing.

### Permission Errors
```bash
sudo chown -R adminuser:adminuser /home/adminuser/secure-ai-chat
```

### Service Not Starting
```bash
sudo journalctl -u secure-ai-chat -n 100
sudo systemctl restart secure-ai-chat
```

### Build Fails
```bash
cd /home/adminuser/secure-ai-chat
rm -rf .next node_modules
npm ci
npm run build
```

---

**Need Help?** Check `PRODUCTION_UPGRADE.md` for detailed troubleshooting.
