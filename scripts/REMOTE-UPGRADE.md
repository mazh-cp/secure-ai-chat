# Remote upgrade one-liners

Use these from your production VM (or any machine that can reach the app directory).

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
