# Release: Git Repo and Remote Production Upgrade

This document covers finalizing the build, preparing the code for the Git repository, and running a remote production upgrade (v1.0.12+).

---

## 1. Finalize the build

From the project root:

```bash
cd secure-ai-chat
npm run type-check
npm run lint
npm run build
```

- **type-check**: `npm run type-check` (or `tsc --noEmit`)
- **lint**: `npm run lint`
- **build**: `npm run build` → produces `.next/` (production bundle)

Optional pre-push checks:

```bash
npm run check:secrets   # Ensure no client-side secrets
bash scripts/pre-publish-verify.sh
```

---

## 2. Git repository checklist

Before pushing or tagging:

| Step | Command / check |
|------|------------------|
| **No secrets in repo** | `npm run check:secrets`; ensure `.env`, `.env.local`, `.env.*` are in `.gitignore` and never committed. |
| **Ignored paths** | `.gitignore` must include: `node_modules/`, `.next/`, `.env*`, `.secure-storage/`, `data/` (uploads + local DB). |
| **Clean status** | `git status` — commit or stash all intended changes; no accidental `.env` or `data/` in the index. |
| **Version** | `package.json` → `"version": "1.0.12"` (or your release version). |
| **Commit** | e.g. `git add -A && git commit -m "Release v1.0.12: RAG persistence, cookie/origin fix, release notes key fix"` |
| **Tag (optional)** | `git tag -a v1.0.12 -m "Release v1.0.12"` then `git push origin v1.0.12` |
| **Push** | `git push origin main` (or your default branch). |

Example one-off “release” commit and tag:

```bash
git status
git add -A
git commit -m "Release v1.0.12: persistent RAG storage, owner_id cookie fix, Release Notes key fix, refetch on tab focus"
git tag -a v1.0.12 -m "Release v1.0.12"
git push origin main
git push origin v1.0.12
```

---

## 3. Remote production upgrade

Upgrade an **existing** installation on a remote server (in-place: pull code, install deps, build, restart).

### Option A: Deploy script (recommended)

On the **production server**, from the app directory (e.g. `/opt/secure-ai-chat`):

```bash
cd /opt/secure-ai-chat   # or your APP_DIR
sudo bash scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main
```

- **`--app-dir`**: Path to the app (required).
- **`--ref main`**: Branch or tag to deploy (default: `main`). Use `--ref v1.0.12` to deploy that tag.
- **`--backup-dir /backup`**: Optional; backup of `.next`, `.secure-storage`, `.env.local` and git ref is stored under `.backups/` by default.
- **`--no-rollback`**: Disable automatic rollback on failure.

The script will:

1. Validate Git repo (stash uncommitted changes if needed).
2. Fetch and checkout the given ref (`main` or tag).
3. Back up current `.next`, `.secure-storage`, `.env.local`, and git ref.
4. Run `npm ci` (or project package manager).
5. Run release gate (e.g. `scripts/release-gate.sh`).
6. Run `npm run build`.
7. Ensure directories exist: `.secure-storage` (700), `.storage` (755), **`data/uploads`** (755).
8. Restart the service (e.g. `systemctl restart secure-ai-chat`).
9. Run smoke tests; on failure it can roll back if not `--no-rollback`.

### Option B: One-liner from your machine (SSH)

From your **local** machine, run the upgrade on the server via SSH:

```bash
ssh user@your-production-host 'cd /opt/secure-ai-chat && sudo bash scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main'
```

Replace `user` and `your-production-host` and `/opt/secure-ai-chat` with your actual user, host, and app path.

### Option C: Remote upgrade script (auto-detect app dir)

On the server, you can use the script that auto-detects the app directory (e.g. from systemd or common paths):

```bash
# From the app directory (after clone or existing install)
cd /opt/secure-ai-chat
bash scripts/upgrade-production-remote.sh
```

Or with explicit ref:

```bash
GIT_REF=v1.0.12 bash scripts/upgrade-production-remote.sh
```

### After upgrade

- Confirm the app is up: `curl -s http://localhost:3000/api/health | jq`
- Confirm version: `curl -s http://localhost:3000/api/version | jq`
- Optional: `GET /api/debug/storage` (same origin) to verify storage and cookie behavior.

---

## 4. New production install (no existing app)

For a **new** server (no existing install), use the install script, then start the app and (optionally) run the deploy upgrade to ensure `data/uploads` and permissions are correct:

```bash
# Clone and install (see INSTALL.md or install-ubuntu.sh)
git clone https://github.com/mazh-cp/secure-ai-chat.git /opt/secure-ai-chat
cd /opt/secure-ai-chat
npm ci
npm run build
# Configure .env.local, .secure-storage, systemd, then:
sudo systemctl start secure-ai-chat
```

If you later run `scripts/deploy/upgrade.sh`, it will ensure `data/uploads` exists and has the right permissions.

---

## 5. Summary

| Goal | Action |
|------|--------|
| **Finalize build** | `npm run type-check && npm run lint && npm run build` |
| **Git-ready** | No secrets; `.gitignore` includes `data/`; commit and optional tag `v1.0.12`, push. |
| **Remote upgrade** | On server: `sudo bash scripts/deploy/upgrade.sh --app-dir /opt/secure-ai-chat --ref main` (or `--ref v1.0.12`). |
| **Rollback** | Backup is under `APP_DIR/.backups/upgrade-YYYYMMDD_HHMMSS`; script prints a manual rollback command on success. |
