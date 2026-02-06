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

The install script **installs and verifies all prerequisites before fetching any code** from the repo. Order of operations:

1. **Phase 1 – System prerequisites:** `apt-get update`, install and verify: `curl`, `git`, `build-essential`, `ca-certificates`, `gnupg`, `lsb-release`, `iproute2`. Exits with an error if any required package fails.
2. **Phase 2 – App user:** Create user `secureai` and install directory `/opt/secure-ai-chat`.
3. **Phase 3 – Node.js and npm:** Install nvm and Node.js v24.13.0 (LTS); verify `node` and `npm` are available before proceeding.
4. **Phase 4 – Code fetch:** Clone (or update) the repository from GitHub.
5. **Phase 5 – App install:** `npm ci`, create `.env.local`, `npm run build`, systemd service, nginx, UFW.

**One-liner (run on the remote Ubuntu VM via SSH):**

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
