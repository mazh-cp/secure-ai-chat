# Remote upgrade one-liners

**Repo:** https://github.com/mazh-cp/secure-ai-chat — **`main`** = latest code.

**Canonical helper (from repo clone):** after `git push origin main`, run `./scripts/remote-production-upgrade.sh user@your-vm` (see script header for env vars), or pass no args to print the curl one-liners below.

Use these from your production VM (or any machine that can reach the app directory).

**Fetching all changes:** All upgrade scripts now ensure the latest remote code is applied. If `git pull` fails (e.g. divergent history or conflicts), they automatically run `git fetch origin` and `git reset --hard origin/<branch>` so the installation matches the remote and gets every update. Config (`.env.local`, `.secure-storage`) is backed up and restored so you don’t lose settings.

## Production VM (`/home/adminuser/secure-ai-chat`)

Default ref: `main`. If the build fails, the script **retries with `main`** automatically.

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
```

With overrides:

```bash
APP_DIR=/home/adminuser/secure-ai-chat GIT_REF=main curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
GIT_REF=v1.0.15 curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | bash
```

## Standard install (`/opt/secure-ai-chat`)

For installs created with `install_ubuntu_public.sh`. If the build fails, the script **retries with `main`** automatically.

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

Override install dir:

```bash
INSTALL_DIR=/opt/secure-ai-chat curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

## Retry-with-main behavior

Both scripts:

- Back up `.env.local` and `.secure-storage` (and `.storage` where used).
- If **build fails** and the current ref/branch is not `main`, they automatically **check out `main`**, reinstall dependencies, and build again so upgrades stay seamless.

See [README](../README.md#upgrade-remote-installation) and [docs/UPGRADE_REMOTE.md](../docs/UPGRADE_REMOTE.md) for more.

## Version still shows an old number (e.g. 1.0.17) after upgrade

The sidebar **App version** comes from the **compiled** `lib/app-release-client.ts` in the **`.next`** build. If it is wrong, the VM is still running an **old build** or the browser is using **cached `_next/static` chunks**.

1. On the VM: `cd "$APP_DIR" && git rev-parse HEAD && git log -1 --oneline` — confirm you are on the expected commit / tag.
2. Rebuild and restart: `npm ci && npm run build` (or `USE_BUILD_FRESH=1` upgrade path), then `sudo systemctl restart secure-ai-chat`.
3. Check API: `curl -sS "http://127.0.0.1:${PORT:-3000}/api/version"` — `version` must match `package.json` / release.
4. Hard refresh the browser (`Ctrl+Shift+R`) or clear site data for that host so old JS chunks are not reused.
