# Release Validation Checklist

This document defines the **stability baseline** and **regression checklist** for production releases. The previous stable version is **v1.0.11** (tag). Current release: **v1.0.12**.

## 0. Stability baseline (v1.0.11)

- **Tag:** `v1.0.11`
- **Scope:** All routes, features, and behaviors that worked in v1.0.11 must be preserved unless a change is explicitly documented.

## 1. Package.json scripts (must exist and behave as before)

| Script | Expectation |
|--------|-------------|
| `npm run dev` | Starts Next.js dev server (reliable root `/`; use --no-turbopack if needed). |
| `npm run build` | Production build; sets REGISTRY_DB_PATH/UPLOADS_DIR when using scripts/build-with-data-paths.js. |
| `npm run start` | Starts production server; uses scripts/start-with-data-paths.js for data paths. |
| `npm run lint` | next lint. |
| `npm run type-check` / `npm run typecheck` | tsc --noEmit. |
| `npm run smoke` | Script-based smoke (endpoints + no secrets). |
| `npm run doctor` | check:node + lint + type-check + test + build. |

## 2. App routes (must resolve, no 404 on valid paths)

| Route | Expectation |
|-------|-------------|
| `/` | 200; home page with chat + version/release notes. |
| `/dashboard` | 200. |
| `/files` | 200; file upload/list UI. |
| `/settings` | 200; API keys and settings. |
| `/release-notes` | 200. |
| `/risk-map` | 200. |

## 3. API routes (must exist and return expected status)

| Method | Path | Expectation |
|--------|------|-------------|
| GET | /api/health | 200; body has status, version. |
| GET | /api/version | 200; body has version. |
| GET | /api/files/list | 200; body has files array. |
| POST | /api/files/store | 200/400/413; stores file. |
| DELETE | /api/files/delete?fileId= | 200/404. |
| DELETE | /api/files/clear | 200. |
| DELETE | /api/files/:id | 200/404. |
| POST | /api/files/:id/reindex | 200/404. |
| GET | /api/files/:id/content | 200/404. |
| POST | /api/chat | 200/400/403; chat completion. |
| POST | /api/scan | File scan (Lakera). |
| GET | /api/keys/retrieve | 200; keys status. |
| GET | /api/settings/status | 200. |
| GET | /api/models | 200. |
| GET | /api/health/openai | POST with key check. |
| GET | /api/health/cache | 200. |
| GET | /api/waf/health | 200. |
| GET | /api/waf/logs | 200/401. |
| TE/config, TE/query, TE/upload | Check Point TE flows. |

## 4. Lib / release & version

- **Client:** `lib/app-release-client.ts` — APP_VERSION, RELEASE_DATE, RELEASE_NOTES (no process/env). Used by home page.
- **Server:** `lib/app-release.ts` — APP_VERSION, getBuildId(); used by /api/health. Must not be imported by client components.

## 5. Flows (regression scope)

- **Settings:** Load settings page; API keys from server or localStorage; save (no blank screen).
- **File upload:** Upload file → appears in list; list from registry; content on demand.
- **Chat:** Send message; optional RAG from uploaded files; no “failed to fetch” for valid requests.
- **RAG:** Files in registry; chat uses same registry/storage; delete/clear removes bytes + metadata + vectors.
- **Sandbox scan:** File scan (Lakera); Check Point TE upload/query; no JSON/stream errors on scan.
- **Navigation:** Sidebar links (Chat, Dashboard, Risk Map, Files, Settings, Release Notes) go to correct routes.

## 6. Environment variables (from codebase)

- **Required for chat:** OpenAI API key (via Settings or OPENAI_API_KEY).
- **Optional:** LAKERA_AI_KEY, LAKERA_PROJECT_ID, LAKERA_ENDPOINT, CHECKPOINT_TE_API_KEY, WAF_AUTH_ENABLED, WAF_API_KEY, REGISTRY_DB_PATH, UPLOADS_DIR, STORAGE_DIR, PORT, HOSTNAME.
- **Client-safe only:** NEXT_PUBLIC_APP_NAME, NEXT_PUBLIC_APP_VERSION.
- App must not show a blank screen when optional keys are missing; fail gracefully.

## 7. How to use this checklist

- Before tagging a release: run through Sections 1–5 (scripts, routes, APIs, flows).
- Run `scripts/validate-local.sh` for automated clean install + build + critical endpoints.
- Run `scripts/run-local-prod.sh` for local production build + start; then `BASE_URL=http://localhost:<port> scripts/prod-smoke.sh` for route smoke.
- Document any intentional breaking change in CHANGELOG and here.

## 8. Regression safety (vs v1.0.11)

Compared with the previous stable version (v1.0.11):

- **Pages:** Same app routes exist and load: `/`, `/dashboard`, `/files`, `/settings`, `/release-notes`, `/risk-map`. No page removed or renamed.
- **API routes:** Paths and methods match v1.0.11; additive only (e.g. POST `/api/files/:id/reindex`). No existing route or response field removed or renamed.
- **Keys/settings behavior:** Unchanged. OpenAI/Lakera keys via UI or env; Check Point TE key server-side; persistence and “configured” behavior as before.
- **Differences (intentional):** None that change contract or flow. New scripts (`run-local-prod.sh`, `prod-smoke.sh`) and docs (`FEATURE_VALIDATION.md`) are additive. If any behavioral difference is introduced in a future release, it will be documented here and in CHANGELOG.
