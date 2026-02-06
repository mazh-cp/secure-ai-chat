# Production Build on Ubuntu VM in Azure

This guide replicates the **current working build** (including **file storage fixes**) on a fresh Ubuntu VM in Azure.

## What’s included in this build

- **File storage persistence**: Owner ID from `X-Client-ID` (lowercase header), establish-owner call on Files page, cookie sync so list/store use the same owner. Files persist after switching to Chat and back.
- **Chat**: OpenAI models usable when only OpenAI + Lakera keys are configured; provider defaults to the configured key.

---

## Prerequisites

- **Ubuntu VM in Azure** (e.g. Ubuntu 20.04 or 22.04 LTS).
- **SSH access** (port 22).
- **Ports open in Azure NSG**:
  - **22** (SSH)
  - **80** (HTTP, for nginx)
  - Optional: **3000** if you want to hit the app directly without nginx.

---

## Option A: One-command install (recommended)

Use this when the **code with the fixes is already on your Git repo** (e.g. pushed from your local branch).

On the Ubuntu VM (over SSH):

```bash
# Install (idempotent; safe to re-run for upgrades)
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
```

**If your repo is different**, clone your repo first and run the install script from it, or use **Option B** and point `git clone` at your repo.

---

## Option B: Fresh build from your repo (manual)

Use this when you have the **fixed code** in a repo (e.g. your fork or a branch) and want full control.

### 1. SSH into the VM

```bash
ssh your-user@<VM_PUBLIC_IP>
```

### 2. Install system dependencies

```bash
sudo apt-get update
sudo apt-get install -y curl git build-essential nginx ufw
```

### 3. Install Node.js (nvm + LTS)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 24.13.0
nvm use 24.13.0
nvm alias default 24.13.0
node --version   # should show v24.13.0
```

### 4. Clone and build (use your repo URL if different)

```bash
# Clone (replace with your repo URL/branch if needed)
git clone https://github.com/mazh-cp/secure-ai-chat.git
cd secure-ai-chat

# Or if you use a branch with the fixes:
# git clone -b your-branch https://github.com/YOUR_ORG/secure-ai-chat.git
# cd secure-ai-chat

npm ci
npm run build
```

### 5. Environment

```bash
cp .env.example .env.local
nano .env.local
```

Set at least:

- `NODE_ENV=production`
- `PORT=3000`
- `HOSTNAME=0.0.0.0`
- `OPENAI_API_KEY=...`
- Optional: `LAKERA_AI_KEY`, `LAKERA_PROJECT_ID`, `LAKERA_ENDPOINT`, `DATA_DIR` (see below).

**Optional – persistent data on a separate disk (Azure data disk):**

If you attached a data disk (e.g. at `/mnt/data`):

```bash
sudo mkdir -p /mnt/data/secure-ai-chat
sudo chown -R $USER:$USER /mnt/data/secure-ai-chat
```

In `.env.local`:

```bash
DATA_DIR=/mnt/data/secure-ai-chat
```

### 6. Run with systemd (so it survives reboot)

Create the service (adjust paths if you installed elsewhere):

```bash
sudo tee /etc/systemd/system/secure-ai-chat.service << 'EOF'
[Unit]
Description=Secure AI Chat
After=network.target

[Service]
Type=simple
User=YOUR_LINUX_USER
WorkingDirectory=/home/YOUR_LINUX_USER/secure-ai-chat
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=/home/YOUR_LINUX_USER/.nvm/versions/node/v24.13.0/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

Replace `YOUR_LINUX_USER` and the path to `npm` if needed (get it with `which npm` after `nvm use 24.13.0`).

```bash
sudo systemctl daemon-reload
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat
sudo systemctl status secure-ai-chat
```

### 7. Nginx reverse proxy (optional but recommended)

```bash
sudo tee /etc/nginx/sites-available/secure-ai-chat << 'EOF'
server {
    listen 80 default_server;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/secure-ai-chat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 8. Firewall (UFW)

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw --force enable
```

---

## Azure NSG (Network Security Group)

In Azure Portal (or CLI):

1. Open the VM’s **Network** → **Networking** (or the NSG attached to the VM).
2. Add **Inbound rules**:
   - **SSH**: port 22, source Any (or your IP).
   - **HTTP**: port 80, source Any (or your IP).

---

## Post-deploy: API keys and verification

1. **API keys** (if not in `.env.local`): open the app in a browser → **Settings** → add OpenAI (and optionally Lakera). Keys are stored under `.secure-storage/` on the server.

2. **Health**
   - Direct: `curl http://localhost:3000/api/health`
   - Via nginx: `curl http://localhost/api/health` or `curl http://<VM_PUBLIC_IP>/api/health`

3. **File storage**
   - Open **Files** → upload a file → switch to **Chat** → switch back to **Files**.
   - The file should still be there (same behavior as your local build).

---

## Upgrading (after future code changes)

**If using Option A (install script):**

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_public.sh | bash
```

**If using Option B (manual):**

```bash
cd /home/YOUR_LINUX_USER/secure-ai-chat
git pull origin main   # or your branch
npm ci
npm run build
sudo systemctl restart secure-ai-chat
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Create Ubuntu VM in Azure, open ports 22 and 80 (and optionally 3000). |
| 2 | Use **Option A** (install script from repo) or **Option B** (manual clone + build). |
| 3 | Set `.env.local` (and optional `DATA_DIR` for a data disk). |
| 4 | Run app with systemd; optionally put nginx in front on port 80. |
| 5 | Add API keys (Settings or `.env.local`), then verify health and file storage. |

This replicates your **local working build** (including file storage fixes) on a **fresh production build** on an Ubuntu VM in Azure.
