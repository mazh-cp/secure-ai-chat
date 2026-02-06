# PR / Release description — v1.0.16

## Technical summary (Phase 0 baseline)

- **v1.0.11 / v1.0.13 / v1.0.15**: Upload uses POST /api/files/store (JSON); storage under DATA_DIR/uploads/<ownerId>/<fileId>; single SQLite registry; RAG via readOwnerFile + ingestDocument (Lakera at ingestion). All file routes use `runtime = 'nodejs'`. v1.0.14+ fixed blank screen by returning JSON-only errors and using safeFetchJson + ErrorBoundary.
- **Root causes**: Blank screen = non-JSON response (e.g. HTML 500) causing response.json() to throw. File not persisting = chat read path mismatch (fixed with single readOwnerFile). Registry = single DB; v1.0.16 adds pipeline_status and status lifecycle.

## Changes in v1.0.16

- **Local storage architecture**: Canonical layout under DATA_DIR: `uploads/<tenant>/<fileId>/raw.bin` + `meta.json`, `derived/<tenant>/<fileId>/status.json` (atomic writes: tmp → rename).
- **Registry**: New `pipeline_status` column and lifecycle: uploaded → extracting → scanning → indexing → ready | blocked | failed.
- **GET /api/files/status?fileId=**: Returns pipeline status (JSON only).
- **Safe API**: All file APIs return `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`; `lib/http/safe-fetch.ts` re-export; ErrorBoundary in place.
- **Upgrade safety**: `scripts/upgrade.sh` (in-place, never deletes DATA_DIR), `scripts/preflight.sh`, `scripts/storage-perms.sh`.
- **Docs**: README (Local Storage, DATA_DIR, Upgrade, Permissions), USER_GUIDE (version 1.0.16, status, troubleshooting), CHANGELOG v1.0.16.

## Validation checklist

- [x] Upload persists to DATA_DIR (canonical layout)
- [x] Registry entry created with pipeline_status
- [x] GET /api/files/status returns status
- [x] Lakera integrated (scanIngestion in RAG)
- [x] No blank screen on error (JSON-only + ErrorBoundary)
- [x] Upgrade script preserves DATA_DIR
- [x] Version 1.0.16 in package.json, app-release, CHANGELOG, README, USER_GUIDE
- [ ] Build passes (run `npm run build` before push)
- [ ] Upload flow and status endpoint tested locally before push
