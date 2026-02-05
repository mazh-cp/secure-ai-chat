# Smoke Tests (lightweight, script-based)

No test framework is required. Use these checks to validate a build before release or after changes.

## 1. Home page load

- **Action:** Open `/` (e.g. http://localhost:3000/).
- **Pass:** Page renders; title or heading "Secure AI Chat" visible; no blank white screen; no 404.
- **Fail:** 404, blank page, or uncaught error in console.

## 2. Chat page load

- **Action:** Same as home (chat is on `/`). Send one message if API key is configured.
- **Pass:** Chat UI visible; send returns 200 or expected error (e.g. missing key).
- **Fail:** "Failed to fetch" with no message, or blank chat area.

## 3. Settings page load

- **Action:** Open `/settings`.
- **Pass:** Settings page renders; API key inputs or status visible.
- **Fail:** 404 or blank.

## 4. File upload page load

- **Action:** Open `/files`.
- **Pass:** File list/upload UI visible; list may be empty.
- **Fail:** 404 or blank.

## 5. API health check

- **Action:** `curl -s http://localhost:3000/api/health`
- **Pass:** HTTP 200; JSON with `status: "ok"` and `version`.
- **Fail:** Non-200 or missing/invalid JSON.

## 6. Optional: full smoke script

```bash
npm run smoke
```

Covers multiple endpoints and checks for secret leakage. For file/RAG pipeline:

```bash
npm run smoke:stability
```

(Requires server running; see scripts/smoke-file-rag-stability.sh.)

## Troubleshooting

- **Root `/` 404 in dev:** Run `npm run dev` (uses --no-turbopack). If still 404, try `npm run build && npm run start` and test against production.
- **Blank page:** Check browser console for errors; ensure no client import of server-only modules (e.g. lib/app-release.ts on client — use lib/app-release-client.ts).
- **Health 404 or 500:** Ensure server started with `npm run start` (or start-with-data-paths.js); check REGISTRY_DB_PATH/UPLOADS_DIR if used.
