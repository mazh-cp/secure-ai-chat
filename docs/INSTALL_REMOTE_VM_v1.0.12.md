# Install v1.0.12 on a new remote VM (from GitHub)

Use these commands **on a brand new Ubuntu/Debian VM** (SSH in as a non-root user) to install Secure AI Chat **v1.0.12** directly from the [GitHub repo](https://github.com/mazh-cp/secure-ai-chat).

---

## Option 1: Install by tag (recommended for v1.0.12)

Installs the exact **v1.0.12** release (Node.js, clone repo at tag, npm install, build, systemd service). App runs in `$HOME/secure-ai-chat` by default.

```bash
TAG=v1.0.12 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

**With custom install directory (e.g. /opt):**

```bash
TAG=v1.0.12 INSTALL_DIR=/opt curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

Then:

1. Add API keys: edit `~/.env.local` (or `/opt/secure-ai-chat/.env.local` if you used `INSTALL_DIR=/opt`) or use the app Settings page after first start.
2. Start (if not auto-started): `sudo systemctl start secure-ai-chat`
3. Open in browser: `http://YOUR_VM_IP:3000`

---

## Option 2: Install from branch (latest from restore-local-stability)

Use this if you want the latest commits on the v1.0.12 branch instead of the tagged release:

```bash
BRANCH=restore-local-stability curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh | bash
```

---

## Option 3: Full production (nginx + systemd, /opt, port 80)

Uses the public install script. It installs from **main** only, so v1.0.12 must be merged to **main** first. If main already has v1.0.12:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
```

This script:

- Installs to `/opt/secure-ai-chat`
- Creates user `secureai`
- Configures nginx reverse proxy on port 80
- Configures systemd and UFW

After install: add API keys in `/opt/secure-ai-chat/.env.local`, then `sudo systemctl restart secure-ai-chat`. Access at `http://YOUR_VM_IP`.

---

## Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Non-root user with sudo
- Outbound internet (for GitHub, npm)

## Troubleshooting

- **Tag not found:** Ensure you pushed the tag: `git push origin v1.0.12`. Then re-run the install command.
- **Script not found:** The install script is served from the **main** branch. Ensure the repo has `scripts/install-ubuntu.sh` on main.
- **Port 3000 in use:** Set a different port: `PORT=3001 TAG=v1.0.12 curl -fsSL ... | bash`
