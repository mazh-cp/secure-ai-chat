# Fix "Crypto.randomUUID is not a function" on Production

If you still see this error after running the upgrade script, the server is likely using an old build. Use a **clean rebuild** and restart.

## Option 1: One-line upgrade (clean build)

From your **local machine**, push the latest code first:

```bash
cd /path/to/secure-ai-chat
git push origin main
```

On the **production server** (SSH), run:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

The script now removes `.next` before building so the new code (including `lib/uuid.ts`) is used.

---

## Option 2: Manual clean rebuild on prod

SSH into the server, then (replace `/opt/secure-ai-chat` and `secureai` if different):

```bash
INSTALL_DIR=/opt/secure-ai-chat
APP_USER=secureai
SERVICE_NAME=secure-ai-chat

cd "$INSTALL_DIR"
sudo -u "$APP_USER" git fetch origin --tags
sudo -u "$APP_USER" git pull origin main || sudo -u "$APP_USER" git reset --hard origin/main

# Clean rebuild (required so new code is used)
sudo -u "$APP_USER" rm -rf "$INSTALL_DIR/.next"

# Verify the fix is in the repo
sudo -u "$APP_USER" test -f "$INSTALL_DIR/lib/uuid.ts" && echo "OK: lib/uuid.ts present" || echo "MISSING: lib/uuid.ts"

sudo -u "$APP_USER" bash -c "export HOME=$INSTALL_DIR && . \$HOME/.nvm/nvm.sh && cd $INSTALL_DIR && npm ci && npm run build"
sudo systemctl restart "$SERVICE_NAME"
```

Check logs:

```bash
sudo journalctl -u secure-ai-chat -n 50 --no-pager
```

You should no longer see `Crypto.randomUUID is not a function`. If you do, confirm `lib/uuid.ts` exists and that the build completed without errors.
