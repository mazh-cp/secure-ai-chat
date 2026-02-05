# Production Deployment — Secure AI Chat v1.0.12

## Prerequisites

- **Node.js:** v24.13.0 (LTS). Check with `node -v`. Use [nvm](https://github.com/nvm-sh/nvm) or [volta](https://volta.sh/) to pin.
- **npm** (or pnpm/yarn) with lockfile: `package-lock.json` (or `pnpm-lock.yaml` / `yarn.lock`).
- **LibreOffice** (optional): Required only for **Apple Numbers (`.numbers`)** RAG ingestion. Without it, CSV, MD, PDF, TXT, etc. still work.
  - Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y libreoffice`
  - macOS: `brew install libreoffice`
  - Confirm: `soffice --version` or `libreoffice --version`

## Environment template

Create `.env.local` (or use systemd `EnvironmentFile`). Copy from `.env.example`. Never commit secrets.

```bash
# Application
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Data paths (recommended: absolute paths in production)
# REGISTRY_DB_PATH=/opt/secure-ai-chat/data/app.db
# UPLOADS_DIR=/opt/secure-ai-chat/data/uploads
# DATA_DIR=/opt/secure-ai-chat/data

# API keys (or configure via Settings UI)
# OPENAI_API_KEY=
# LAKERA_API_KEY=   # or LAKERA_AI_KEY
# LAKERA_PROJECT_ID=
# LAKERA_FAIL_CLOSED=false
# LAKERA_TIMEOUT_MS=10000

# Optional
# BASE_URL=https://your-domain.com
# STORAGE_DIR=./.storage
```

Only `NEXT_PUBLIC_*` vars are exposed to the client; do not put API keys there.

## systemd service example

```ini
[Unit]
Description=Secure AI Chat
After=network.target

[Service]
Type=simple
User=secureai
WorkingDirectory=/opt/secure-ai-chat
Environment=NODE_ENV=production
EnvironmentFile=/opt/secure-ai-chat/.env.local
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Install:

```bash
sudo cp /opt/secure-ai-chat/secure-ai-chat.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat
```

## Rollout procedure

### Repeatable build (same as release gate)

```bash
cd /opt/secure-ai-chat
git fetch origin tag v1.0.12
git checkout v1.0.12
npm ci
npm run build
sudo systemctl restart secure-ai-chat
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/rag/status
```

### One-command upgrade (tag v1.0.12)

```bash
cd /opt/secure-ai-chat
chmod +x scripts/upgrade-to-1.0.12.sh
./scripts/upgrade-to-1.0.12.sh
```

Optional: skip release-gate during upgrade: `SKIP_RELEASE_GATE=1 ./scripts/upgrade-to-1.0.12.sh`.

### Blue/green (optional)

If you run two instances behind a load balancer:

1. Build new version in a separate directory or container.
2. Run release-gate and smoke tests against the new build.
3. Switch traffic to the new instance; keep the old instance running for quick rollback.
4. After verification, decommission the old instance.

## Rollback to previous tag

See [ROLLBACK.md](../ROLLBACK.md) in the repo root for quick steps. Summary:

1. Checkout previous tag (e.g. `v1.0.11`).
2. `npm ci && npm run build`
3. Restart service: `sudo systemctl restart secure-ai-chat` (or pm2).
4. Verify `/api/health` and `/api/rag/status`.

Backups from the upgrade script (if used) are under `APP_DIR/.backups/upgrade-*`.

---

## Exact upgrade command sequence (Ubuntu VM)

Run from the app directory (e.g. `/opt/secure-ai-chat`):

```bash
cd /opt/secure-ai-chat
git fetch origin tag v1.0.12
git checkout v1.0.12
npm ci
npm run build
npm run start
# Or with systemd:
sudo systemctl restart secure-ai-chat
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/rag/status
```

One-liner upgrade script (after cloning/copying the repo):

```bash
chmod +x scripts/upgrade-to-1.0.12.sh && ./scripts/upgrade-to-1.0.12.sh
```
