# Local Runbook — Secure AI Chat v1.0.12

Exact commands and expected behavior for local dev and prod. All validation is scriptable and repeatable.

## Prerequisites

- Node.js 24.13.0 (see `package.json` engines)
- npm (lockfile present → use `npm ci` for deterministic install)

## 1. Clean install (deterministic)

```bash
npm run local:reset
```

**Expected output (summary):**

- `Removing node_modules and .next`
- `Installing dependencies (npm ci)` — no errors
- `node -v` and `npm -v` printed
- Exit 0

## 2. Run dev server

```bash
npm run local:dev
```

**Expected output (summary):**

- `NO_PROXY set for localhost`
- `Open in browser: http://localhost:3000` (and http://127.0.0.1:3000)
- **Wait for "Ready" in the terminal** before opening the URL.
- **Use the exact URL and port printed** (e.g. if dev picks 3001, open that). Wrong port = cookie/origin mismatch and files will not persist.
- Next.js dev server starts; no crash.
- In browser: open the printed URL (e.g. http://localhost:3000 or http://localhost:3001) so cookies match; the app loads (no blank page). Missing API keys show UI prompts, not a blank page.

**If http://localhost:3000 doesn’t load:** Try http://127.0.0.1:3000. If that works, your system may be resolving localhost to IPv6 (::1) while the server is listening on IPv4; using 127.0.0.1 is a reliable workaround.

**Stop:** Ctrl+C.

## 3. Run production build + start

In a clean state (or after `npm run local:reset`):

```bash
npm run local:prod
```

**Expected output (summary):**

- `Removing .next`
- `Building...` — build succeeds
- `Starting production server at http://127.0.0.1:3000`
- Server running; http://127.0.0.1:3000 serves the app.

**Stop:** Ctrl+C.

## 4. Smoke test (dev or prod)

With the server already running (dev or prod) in another terminal:

```bash
npm run local:smoke
```

Or with custom base URL:

```bash
BASE_URL=http://127.0.0.1:3000 bash scripts/smoke.sh
```

**Expected output (summary):**

- `GET /` → HTTP 200
- `GET /api/health` → 200, JSON with ok/status
- `GET /files` → real HTTP status (not 000000)
- `Smoke passed for http://127.0.0.1:3000`
- Exit 0

**If you see HTTP 000000:** Script prints diagnostics (e.g. `lsof -nP -iTCP:3000 -sTCP:LISTEN`) and suggestions (port in use, server crashed, proxy env). Use `npm run local:dev` or `npm run local:prod` so `NO_PROXY` is set and server binds to 127.0.0.1.

## 5. Full local verification (one command)

Resets, starts dev, runs smoke, stops dev, builds, starts prod, runs smoke, stops prod:

```bash
npm run local:verify
```

**Expected output (summary):**

- Step 1: `local:reset` — clean install
- Step 2: Dev server starts, port ready, smoke passes, server stopped
- Step 3: `rm .next` and `npm run build` — success
- Step 4: Prod server starts, port ready, smoke passes, server stopped
- `local:verify complete — dev works, prod works, smoke passes`
- Exit 0

## Environment

- **Optional env:** Copy `.env.example` to `.env.local` if you need overrides. No env vars are required for "/" to work.
- **Proxy bypass:** Scripts `run-local-dev.sh`, `run-local-prod.sh`, and `smoke.sh` set `NO_PROXY=localhost,127.0.0.1,::1` and use `curl --noproxy` so local requests are not sent through a proxy.
- **Base URL:** Default `BASE_URL=http://127.0.0.1:3000` for smoke; prefer 127.0.0.1 over localhost to avoid DNS/proxy issues.

## Troubleshooting

| Symptom                                             | Action                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App not accessible at http://localhost:3000**     | 1) Start server: `npm run local:dev`. 2) Wait until the terminal shows "Ready". 3) Open http://localhost:3000 or http://127.0.0.1:3000. 4) If localhost fails but 127.0.0.1 works, use 127.0.0.1 (localhost may be resolving to IPv6). 5) Check nothing else is on port 3000: `lsof -nP -iTCP:3000 -sTCP:LISTEN`. |
| **GUI shows 404 or "This page could not be found"** | Caused by "EMFILE: too many open files" breaking the dev file watcher. Fix: run `ulimit -n 10240` in the same terminal, then run `npm run local:dev` again. Or use production: `npm run local:prod` (build + start) — production serves the GUI correctly.                                                        |
| Curl returns 000000                                 | Run dev/prod with `npm run local:dev` or `npm run local:prod`; run smoke with `npm run local:smoke` (scripts set NO_PROXY).                                                                                                                                                                                       |
| Port 3000 in use                                    | Change port: `PORT=3001 npm run local:dev` and `BASE_URL=http://127.0.0.1:3001 npm run local:smoke`.                                                                                                                                                                                                              |
| Blank page                                          | Check browser console; ensure no client import of server-only code (use `lib/app-release-client.ts` on client, not `lib/app-release.ts`).                                                                                                                                                                         |
| Build fails                                         | Run `npm run local:reset` then `npm run build`.                                                                                                                                                                                                                                                                   |

## 6. RAG + Chat smoke (regression guardrail)

With the server already running (dev or prod) and OpenAI API key configured in Settings:

```bash
npm run smoke:rag-chat
```

Or with custom base URL:

```bash
BASE_URL=http://127.0.0.1:3000 bash scripts/rag-chat-smoke.sh
```

**Expected output (summary):**

- Upload a small text file containing a unique fact (e.g. "The launch code phrase is BLUE-COMET-772.")
- Wait for `/api/rag/status` to be ready
- Ask chat: "What is the launch code phrase?" → answer contains BLUE-COMET-772 and a citation
- Ask chat: "What is the CEO of Apple's favorite food?" → answer says "Not found in the uploaded files."
- Exit 0

**If LAKERA_ENABLED=true:** Run with a clean file first (must pass). To test quarantine: upload a doc with malicious instruction chunk → that chunk is quarantined; clean retrieval still works.

## Script reference

| Script                        | Purpose                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `scripts/clean-reinstall.sh`  | rm -rf node_modules .next; npm ci; print node/npm -v                                                 |
| `scripts/run-local-dev.sh`    | NO_PROXY, PORT=3000 HOSTNAME=127.0.0.1 npm run dev                                                   |
| `scripts/run-local-prod.sh`   | NO_PROXY, rm .next, build, PORT=3000 HOSTNAME=127.0.0.1 npm run start                                |
| `scripts/smoke.sh`            | curl --noproxy GET /, /api/health, /files; fail on 000000 with diagnostics                           |
| `scripts/rag-chat-smoke.sh`   | Upload file → RAG ready → chat answers from file + "Not found" for out-of-file; exit 1 if regression |
| `scripts/run-local-verify.sh` | reset → dev smoke → build → prod smoke (background servers, then kill)                               |
