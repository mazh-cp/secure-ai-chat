# Sync Changes to Main and Fresh Install on Remote Ubuntu VM

**Repo:** [https://github.com/mazh-cp/secure-ai-chat](https://github.com/mazh-cp/secure-ai-chat) — branch **`main`** is used for latest code and fresh installs.

## 1. Sync your changes into the main repo

Before anyone runs a fresh install, push all fixes and features to GitHub `main` so the install script fetches the latest code.

From your **local machine** (in the project root):

```bash
cd /path/to/secure-ai-chat
git add -A
git status
git commit -m "Your descriptive message"
git push origin main
```

If you use a different branch, merge to `main` first, then push:

```bash
git checkout main
git merge your-branch
git push origin main
```

**Ensure on GitHub:**
- The default branch is `main` (or update script URLs if you use `master`).
- The repo is **public** if you use the raw one-liner; for private repos use in-place install (clone first, then run the script from the repo).

---

## 2. Fresh install on a remote Ubuntu VM

### Recommended: Clean install script (ensures nothing is missed)

Use this on a **brand-new Ubuntu VM**. It runs all steps in order and clears build caches so the app builds from a clean state.

**One-liner (run on the VM via SSH; do not run as root):**

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh | bash
```

**What it does (full checklist):**
1. **Phase 1 – System prerequisites:** `apt-get update`, install and verify `curl`, `git`, `build-essential`, `ca-certificates`, `gnupg`, `lsb-release`, `iproute2`.
2. **Phase 2 – App user:** Create user `secureai` and directory `/opt/secure-ai-chat`.
3. **Phase 3 – Node.js and npm:** Install nvm and Node.js v24.13.0 (LTS); verify `node` and `npm` before proceeding.
4. **Phase 4 – Clone:** Clone repository from GitHub (keeps `.nvm` if re-running); verify `package.json`, `lib/uuid.ts`, `scripts/start-standalone.js`.
5. **Phase 5 – Dependencies:** `npm ci`.
6. **Phase 6 – Clean build:** Remove `.next` and `node_modules/.cache` so the build is not stale.
7. **Phase 7 – Build:** `npm run build`.
8. **Phase 8+ – Config:** `.env.local`, systemd service, nginx, UFW, start service, smoke checks.

**Override install path or branch (optional):**
```bash
INSTALL_DIR=/opt/secure-ai-chat BRANCH=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh | bash
```

**Force clean install** (wipe existing, fresh clone with latest fixes; preserves `.env.local` and `.secure-storage`):
```bash
FORCE_CLEAN=1 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh | bash
```

### Alternative: Standard install script

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
```

**Requirements on the VM:**
- Ubuntu (or Debian) with `sudo`
- Internet access
- Do **not** run as root (script uses `sudo` when needed)

**After install:**
1. Add API keys: `sudo nano /opt/secure-ai-chat/.env.local`
2. Restart: `sudo systemctl restart secure-ai-chat`
3. Access: `http://<VM_IP>` (nginx on port 80)

See [INSTALL_UBUNTU_VM.md](INSTALL_UBUNTU_VM.md) for full post-install steps and [README.md](../README.md#quick-install-ubuntu-vm) for quick reference.

---

## 3. If the install script fails

- **Prerequisites fail:** Install missing packages manually, e.g.  
  `sudo apt-get update && sudo apt-get install -y curl git build-essential ca-certificates`
- **Node/npm not found after nvm:** Check nvm install and that the app user’s `HOME` is set to the install directory.
- **Clone fails:** Check network and that the repo URL is correct and reachable (for private repos, use in-place install from a clone).

For upgrade of an **existing** installation (not fresh), use the upgrade script instead:  
[UPGRADE_REMOTE.md](UPGRADE_REMOTE.md) or `scripts/upgrade_remote.sh`.
