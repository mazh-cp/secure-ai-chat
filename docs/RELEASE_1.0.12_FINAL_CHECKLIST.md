# Release 1.0.12 — Final Checklist

Use this after running the restore-local-stability work and scripts.

## Deliverables

- [x] **Revert report:** `docs/RELEASE_1.0.12_REVERT_REPORT.md` — No commits reverted; baseline v1.0.11; client/server split verified.
- [x] **LOCAL_RUNBOOK:** `docs/LOCAL_RUNBOOK.md` — Exact commands and expected outputs.
- [x] **Scripts:**
  - [x] `scripts/clean-reinstall.sh` — rm node_modules .next; npm ci; node/npm -v
  - [x] `scripts/run-local-dev.sh` — NO_PROXY, PORT=3000 HOSTNAME=127.0.0.1 npm run dev
  - [x] `scripts/run-local-prod.sh` — NO_PROXY, rm .next, build, start
  - [x] `scripts/smoke.sh` — BASE_URL default 127.0.0.1:3000, curl --noproxy, GET /, /api/health, /files; diagnostics on 000000
- [x] **package.json scripts:** `local:reset`, `local:dev`, `local:prod`, `local:smoke`, `local:verify`
- [x] **.env.example:** REQUIRED vs OPTIONAL listed; optional keys do not cause blank page (UI prompts).

## Validation (run locally)

1. **Dev works**
   ```bash
   npm run local:reset
   npm run local:dev
   ```
   In another terminal:
   ```bash
   npm run local:smoke
   ```
   Then open http://127.0.0.1:3000 in browser — page loads (no blank page). Stop dev with Ctrl+C.

2. **Prod works**
   ```bash
   npm run local:prod
   ```
   In another terminal:
   ```bash
   npm run local:smoke
   ```
   Open http://127.0.0.1:3000 — page loads. Stop prod with Ctrl+C.

3. **Smoke passes**
   With either dev or prod running: `npm run local:smoke` exits 0 and prints ✅ for GET /, GET /api/health, GET /files.

4. **One-command verify (optional)**
   ```bash
   npm run local:verify
   ```
   Completes without error: reset → dev smoke → build → prod smoke.

## Invariants

- Root route "/" works in dev and prod.
- Client bundles do not import server-only code (use `lib/app-release-client.ts` on client).
- `npm run dev`, `npm run build`, `npm run start` all work.
- Curl 000000 treated as tooling/proxy; scripts use NO_PROXY and --noproxy; BASE_URL defaults to 127.0.0.1.

## Branch

- `restore-local-stability` — created; no reverts applied; all new scripts and docs added.
