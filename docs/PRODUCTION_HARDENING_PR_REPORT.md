# Production Hardening — PR Report

**Baseline:** v1.0.11 (previous stable). **Target:** Production-ready, locally reliable, no breaking changes.

---

## What was wrong

- **Root route `/` in dev:** Could 404 or show blank in development (Turbopack/compilation or client importing server-only release module).
- **No single automated “clean install + build + smoke” script** matching the release checklist (lint → typecheck → build → start → curl `/` and `/api/health`).
- **Root-level errors:** No Next.js App Router `app/error.tsx`, so uncaught errors could yield a blank or generic error screen.
- **Env/version drift:** `.env.example` had `NEXT_PUBLIC_APP_VERSION=1.0.11`; app is 1.0.12. README lacked a concise “Local + Production Requirements” and a **Runbook** with exact validation commands.
- **Documentation:** No single regression checklist or lightweight smoke doc for release validation.

---

## What changed (file-by-file)

| File                         | Change                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/app-release.ts`         | Server-only release/version and `getBuildId()`; used by `/api/health`.                                                                                                                                                                      |
| `lib/app-release-client.ts`  | **New.** Client-safe APP_VERSION, RELEASE_DATE, RELEASE_NOTES (no `process`/env). Used by home page to avoid server code in client bundle.                                                                                                  |
| `app/page.tsx`               | Imports version/release from `lib/app-release-client.ts` (not `app-release.ts`).                                                                                                                                                            |
| `app/api/health/route.ts`    | Imports version/build from `lib/app-release.ts`.                                                                                                                                                                                            |
| `app/loading.tsx`            | Root loading UI (spinner) so load is not a blank screen.                                                                                                                                                                                    |
| `app/error.tsx`              | **New.** Root error boundary; “Try again” + “Go home” for uncaught errors.                                                                                                                                                                  |
| `package.json`               | `dev` uses `next dev -H 0.0.0.0 --no-turbopack`; `dev:turbo` added for optional Turbopack.                                                                                                                                                  |
| `scripts/validate-local.sh`  | **New.** Clean (.next, node_modules) → npm ci → lint → typecheck → test → build → start on VALIDATE_PORT (default 3001) → curl GET `/`, `/api/health`, `/api/version`, `/api/files/list`; exits nonzero on failure. macOS zsh / Linux bash. |
| `docs/RELEASE_VALIDATION.md` | **New.** Stability baseline (v1.0.11), regression checklist: scripts, app routes, API routes, lib release/version, flows, env vars; references `validate-local.sh`.                                                                         |
| `docs/SMOKE_TESTS.md`        | **New.** Lightweight smoke: home, chat, settings, files, API health; troubleshooting (root 404, blank page).                                                                                                                                |
| `.env.example`               | `NEXT_PUBLIC_APP_VERSION=1.0.12`; required/optional vars documented.                                                                                                                                                                        |
| `README.md`                  | “Local + Production Requirements” (required/optional/client-safe, link to RELEASE_VALIDATION); “Runbook: Local validation” with exact commands: clean install, dev run, production build+start, `validate-local.sh` and troubleshooting.    |

No changes to API contracts, route paths, or UI flows. No refactors for style-only.

---

## Why it’s safe (regression reasoning)

- **Routes/APIs:** No routes or response fields removed or renamed. New surface is additive (e.g. `app/error.tsx`, `app/loading.tsx`, `app-release-client.ts`, `validate-local.sh`).
- **Behavior:** Home page still shows version and release notes; source of truth is client-safe module. Health API still returns version/build from server-only module. Dev default is webpack for reliable `/`; Turbopack remains optional.
- **Scripts:** `npm run dev`, `build`, `start`, `lint`, `typecheck`, `smoke` unchanged in behavior; only `dev` default and new `dev:turbo`/`validate-local.sh` added.
- **Env:** Only `.env.example` version bump and README/Runbook documentation; no new required env vars. App continues to fail gracefully when optional keys are missing.

---

## Runbook (quick reference)

- **Clean install:** `rm -rf .next node_modules && npm ci`
- **Dev:** `npm run dev` → http://localhost:3000
- **Production:** `npm run build && npm run start` → `curl -s http://localhost:3000/api/health`
- **Full validation:** `./scripts/validate-local.sh` (or `SKIP_SERVER=1 ./scripts/validate-local.sh` to skip server/curl)

Details and troubleshooting: README “Runbook: Local validation” and [docs/SMOKE_TESTS.md](SMOKE_TESTS.md).
