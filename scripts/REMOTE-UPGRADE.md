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

With overrides — **put env vars on the right of the pipe** (`bash` sees them). Wrong: `GIT_REF=main curl ... | bash` (only `curl` gets the vars).

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | APP_DIR=/home/adminuser/secure-ai-chat GIT_REF=main bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | APP_DIR=/opt/secure-ai-chat GIT_REF=main USE_BUILD_FRESH=1 bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade-curl-production.sh | GIT_REF=v1.0.15 bash
```

## One-liner wrapper (`/opt/secure-ai-chat`, `main`, `build:fresh`)

Same as **`upgrade-curl-production.sh`**, but defaults are applied on the **correct** side of the pipe (avoids `VAR=curl … | bash` mistakes):

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/production-upgrade.sh | bash
```

Overrides (on the **right** of the first pipe):

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/production-upgrade.sh | APP_DIR=/opt/secure-ai-chat GIT_REF=main USE_BUILD_FRESH=1 bash
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

If you ran `GIT_REF=… USE_BUILD_FRESH=1 curl … | bash`, those variables were **not** passed to `bash` (they only applied to `curl`). Re-run with vars after the pipe: `curl … | APP_DIR=/opt/secure-ai-chat GIT_REF=main USE_BUILD_FRESH=1 bash`.

1. On the VM: `cd "$APP_DIR" && git rev-parse HEAD && git log -1 --oneline` — confirm you are on the expected commit / tag.
2. Rebuild and restart: `npm ci && npm run build` (or `USE_BUILD_FRESH=1` upgrade path), then `sudo systemctl restart secure-ai-chat`.
3. Check API: `curl -sS "http://127.0.0.1:${PORT:-3000}/api/version"` — `version` must match `package.json` / release.
4. Hard refresh the browser (`Ctrl+Shift+R`) or clear site data for that host so old JS chunks are not reused.

## `npm ERR! Invalid comparator: npm:@eslint/...` or Node `EBADENGINE` (v18 on the VM)

The app targets **Node 24.13.0** (see `package.json` / `.nvmrc`). **install_ubuntu_clean** puts **nvm** under **`$INSTALL_DIR/.nvm`** by running the nvm installer with **`HOME=$INSTALL_DIR`** (e.g. `/opt/secure-ai-chat`).

If you run **`sudo -u secureai ...`** without setting **`HOME`** to that app directory, the shell uses **`/home/secureai`** → **system Node 18** and **old npm**, which breaks **`npm install`** (including `overrides` with `npm:` aliases).

Use the **upgrade curl script** (revision **20260417c+**) or run npm like this:

```bash
sudo -u secureai env HOME=/opt/secure-ai-chat bash -lc 'cd /opt/secure-ai-chat && . "$HOME/.nvm/nvm.sh" && nvm use && npm install && npm run build:fresh'
```
