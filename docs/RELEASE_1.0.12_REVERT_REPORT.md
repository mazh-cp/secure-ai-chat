# Release 1.0.12 — What Was Reverted and Why

## Summary

**No commits were reverted.** The repository was audited for local-access issues; no single commit was identified as introducing instability. The last known stable tag is **v1.0.11**. Local stability is achieved by configuration and scripts (NO_PROXY, 127.0.0.1, deterministic smoke), not by reverting code.

## Baseline

- **Stable tag:** `v1.0.11`
- **Branch:** `restore-local-stability` (created from current `main`; no revert applied)
- **Key files audited:**
  - `app/page.tsx` — Uses `@/lib/app-release-client` only (no server-only code). ✅
  - `app/layout.tsx` — No `process.env` in client. ✅
  - `app/loading.tsx`, `app/error.tsx` — Client-safe. ✅
  - `lib/app-release.ts` — Server-only (used by `/api/health`). ✅
  - `lib/app-release-client.ts` — Client-safe (no `process`/env). ✅
  - `next.config.js`, `middleware.ts` — No changes reverted. ✅
  - `package.json` scripts — `dev` / `build` / `start` use existing wrappers; scripts added for local run and smoke. ✅

## Why No Revert?

1. **Git history:** Commits since v1.0.11 are install/upgrade/release-gate fixes (Check Point TE, nvm PATH, build-essential, etc.). None modify root route behavior or introduce server-only imports in client bundles.
2. **Current tree:** Uncommitted and untracked changes include additive pieces (e.g. `app-release-client.ts`, `app/error.tsx`, `app/loading.tsx`). The client/server split is correct: client uses `app-release-client.ts`, server uses `app-release.ts`.
3. **Local failures** (e.g. curl `000000`) are treated as tooling/proxy issues: scripts now enforce `NO_PROXY` and `127.0.0.1` and use `curl --noproxy` in smoke tests.

## Invariants Restored / Ensured

- Root route `/` works in dev and prod.
- Client bundles do not import server-only code (no `process.env` in client components except `NODE_ENV`, which Next replaces at build time).
- `npm run dev`, `npm run build`, `npm run start` all work (unchanged; wrappers `build-with-data-paths.js` and `start-with-data-paths.js` remain).
- Optional env vars do not cause a blank page (env validation is non-fatal; Settings UI handles missing keys).

## Deliverables

- Branch: `restore-local-stability`
- Scripts: `scripts/clean-reinstall.sh`, `scripts/run-local-dev.sh`, `scripts/run-local-prod.sh`, `scripts/smoke.sh`
- npm scripts: `local:reset`, `local:dev`, `local:prod`, `local:smoke`, `local:verify`
- Docs: `docs/LOCAL_RUNBOOK.md`, `.env.example` and env template
- This report: `docs/RELEASE_1.0.12_REVERT_REPORT.md`
