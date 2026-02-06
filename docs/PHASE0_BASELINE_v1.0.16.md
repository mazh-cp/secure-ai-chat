# Phase 0 — Baseline Review (v1.0.16)

## 1) Version comparison

| Area | v1.0.11 | v1.0.13 | v1.0.15 | Current (pre-1.0.16) |
|------|---------|---------|---------|----------------------|
| Upload API | POST /api/files/store (JSON body) | Same | Same | Same; ownerId validated; JSON-only errors |
| Storage path | data/uploads/<ownerId>/<fileId> (single file) | Same | Same + atomic write (tmp→rename) | Same; DATA_DIR env; atomic write |
| Registry | data/app.db (single SQLite) | Same | Same | Same; REGISTRY_DB_PATH / DATA_DIR |
| RAG | ingestDocument; scanIngestion (Lakera) then chunk/embed | Same | readOwnerFile only for chat | Client triggers /api/rag/embed after store/scan |
| Lakera | /api/scan (file); scanIngestion in RAG | Same | Same | Same; chunk-level in ingestDocument |
| Edge runtime | Not used for file routes | Not used | Not used | All file/chat/rag routes: runtime = 'nodejs' |
| API error format | Mixed | HTML on 500 → blank screen | JSON { ok: false, error: { code, message } } | Same; safeFetchJson + ErrorBoundary on client |

## 2) Upload API routes

- **POST /api/files/store** — application/json; fileId, fileName, fileContent, fileType, fileSize, scanStatus?, scanResult?, scanDetails?, checkpointTeDetails?. Writes to DATA_DIR/uploads/<ownerId>/<fileId>; inserts into registry. Returns `{ ok: true, file: { id, name, size, mime, sha256, storagePath, createdAt } }` or `{ ok: false, error: { code, message, details } }`.
- **GET /api/files/list** — Reads from registry + readOwnerFile(owner, fileId) for content.
- **DELETE /api/files/delete**, **POST /api/files/clear** — Registry + disk delete.

## 3) Storage path logic

- **DATA_DIR**: env `DATA_DIR` (default `./data`); resolved absolute.
- **Uploads**: `DATA_DIR/uploads/<ownerId>/<fileId>` (single file). Atomic write via temp file then rename.
- **Registry**: `DATA_DIR/app.db` (or REGISTRY_DB_PATH). Single DB for all owners.

## 4) RAG integration

- Chat builds context from uploaded files via readOwnerFile(owner, fileId).
- **POST /api/rag/embed** — Indexes files from storage; ingestDocument runs scanIngestion (Lakera) on text, then chunk/embed. Client calls after store when safe (not_scanned or Lakera safe).

## 5) Lakera integration

- **POST /api/scan** — Full-file Lakera Guard (client sends content).
- **scanIngestion** (lib/security/rag-scan) — Called during RAG ingest; scans extracted text before embedding.

## 6) Edge runtime misuse

- None. All file, chat, and RAG API routes use `export const runtime = 'nodejs'`.

## 7) API non-JSON on error

- Addressed in v1.0.14+: store/list/clear return JSON only. Client uses safeFetchJson and ErrorBoundary to prevent blank screen.

## 8) Root causes documented

- **Blank screen during upload**: Non-JSON response (e.g. HTML 500) caused `response.json()` to throw; no error boundary. Fixed by safeFetchJson + ErrorBoundary + server always returning JSON.
- **File not persisting**: Chat was reading from a different key layout than store in some paths; fixed by single source of truth readOwnerFile(owner, fileId) and registry.
- **Registry inconsistency**: Single app.db; no per-tenant DB. v1.0.16 adds optional per-tenant registry and status lifecycle to reduce inconsistency and support async pipeline.

---

**Technical summary for PR**: Current codebase (v1.0.15) uses DATA_DIR-based uploads and single SQLite registry; all file routes use Node runtime; errors return JSON; client uses safeFetchJson and ErrorBoundary. v1.0.16 adds canonical layout (uploads/<tenant>/<fileId>/raw.bin + meta.json, derived/, optional registry per tenant), status lifecycle (uploaded→extracting→scanning→indexing→ready | blocked | failed), GET /api/files/status, preflight/storage-perms/upgrade scripts, and full doc/version parity at 1.0.16.
