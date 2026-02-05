# Targeted diff review: HEAD vs STABLE_SHA (v1.0.11)

**STABLE_SHA:** `7b52658` (tag: `v1.0.11`, 2026-01-16)  
**HEAD:** current branch (e.g. `70c3db6`)  
**Baseline:** STABLE_SHA is treated as baseline truth for all non-file features.

---

## 1. File upload / store

| Area | STABLE (7b52658) | HEAD | Assessment |
|------|------------------|------|------------|
| **Store route** | `lib/persistent-storage.storeFile()`; JSON body only; no size/type checks beyond 50 MB | Registry + `file-storage.writeFile()` + `indexFileForRAG()`; request size 55 MB cap; content length check; allowed types/extensions | **Keep HEAD** for persistence + registry + RAG. Request-size and type validation are stability improvements. |
| **Storage backend** | `.storage/files` + `files-metadata.json` (persistent-storage) | `./data/uploads` (file-storage) + SQLite registry `./data/app.db` | **Keep HEAD**: single persistent backend under `data/`, no /tmp, no memory-only. |

**Enhancement (1) – Persistent file storage:** Satisfied by current design: `lib/storage/file-storage.ts` writes to `./data/uploads` (or `UPLOADS_DIR`); no /tmp, no memory-only.

---

## 2. File list

| Area | STABLE | HEAD | Assessment |
|------|--------|------|------------|
| **List route** | `listFiles()` + `getFileContent()` from persistent-storage; returns **content** in each file | `listFiles()` from registry; **metadata only** (no content); content on-demand in chat | **Keep HEAD**: same registry as store/delete; list is metadata-only; chat loads content when needed. |
| **Consistency** | Single persistent-storage (metadata JSON) | Single registry (SQLite) + single storage (uploads) | **Keep HEAD**: unified registry. |

**Enhancement (2) – Unified file registry and owner/session:** Satisfied: registry has `owner_id` / `session_id`; list and chat both use `listFiles()` from registry.

---

## 3. File delete / clear / revert

| Area | STABLE | HEAD | Assessment |
|------|--------|------|------------|
| **Delete** | `persistent-storage.deleteFile(fileId)` (removes file + metadata entry) | `deleteFileById()`: `markDeleted(id)` + `fileStorage.deleteFile(storageKey)` + `removeDocumentFromRAG(fileId)` | **Keep HEAD**: deterministic: metadata (soft delete) + bytes + vectors removed. |
| **Clear** | `persistent-storage.clearAllFiles()` | Loop `listFiles()` then `deleteFileById(f.id)` for each | **Keep HEAD**: same semantics (bytes + metadata + RAG). |
| **Revert** | Not present | Not present | **Add**: “revert” = reindex (rebuild RAG for a file). No undo of delete (bytes are removed). Add e.g. `POST /api/files/:id/reindex`. |

**Enhancement (3) – Deterministic delete/clear/revert:** Delete/clear already remove bytes + metadata + vectors. Revert = reindex endpoint to rebuild RAG after re-upload or repair.

---

## 4. RAG indexing / search / chat retrieval

| Area | STABLE | HEAD | Assessment |
|------|--------|------|------------|
| **Indexing** | None (no RAG index) | `indexFileForRAG()` → `ingestDocument()` (scanIngestion, chunk, embed, upsert); `rag_indexed_at` set on success | **Keep HEAD**; ensure readiness state is exposed. |
| **Chat context** | All file content from persistent-storage (list + getFileContent) | Registry `listFiles()` + `file-storage.readFile(storage_key)`; keyword/relevance; no vector retrieval in chat yet | **Keep HEAD**; chat uses same registry + storage as Files page. |
| **Readiness** | N/A | `rag_indexed_at` in registry; not exposed as queued/ready/error; chat can log “no file content could be read” even when files are still indexing | **Add**: Expose RAG state (queued/ready/error). Chat: when files exist but none ready, if any have `rag_indexed_at === null`, say “files are still being indexed” instead of implying files don’t exist. |

**Enhancement (4) – RAG readiness and chat behavior:** Add explicit RAG readiness (queued/ready/error) and chat messaging that never pretends files don’t exist when they’re still indexing.

---

## 5. Lakera Guard scanning

| Area | STABLE | HEAD | Assessment |
|------|--------|------|------------|
| **Upload** | Client-side scan only | Client-side only; store route does not call Lakera | **Add**: Enforce server-side Lakera (or equivalent) at upload; block or flag before storing/indexing. |
| **Chat input** | `checkWithLakera()` on user message | Same | **Keep**. |
| **Retrieved chunks** | Chat does not use vector retrieval | Chat injects file content into messages; no `scanRetrieval()` on that content | **Add**: Scan file content (or treat as “chunks”) with Lakera before appending to context / sending to OpenAI. |

**Enhancement (5) – Lakera at upload + before sending to OpenAI:** Enforce scan at upload (server-side) and scan content used as “retrieved context” before sending to the model.

---

## 6. OpenAI adapter

| Area | STABLE | HEAD | Assessment |
|------|--------|------|------------|
| **Chat route** | Indentation/formatting only in shown diff | Minor indentation/formatting differences (e.g. around validation block, rateLimit in log) | **Revert** to STABLE formatting for those blocks to avoid noise; keep behavior. |

No functional change to OpenAI adapter logic; only style. Optional: revert formatting to STABLE in `app/api/chat/route.ts` for the affected blocks.

---

## 7. Other touched files (STABLE vs HEAD)

- **lib/persistent-storage.ts:** STABLE had no schema version/migration; HEAD has STORAGE_DIR, 0o755/0o644, schema version, `migrateStorage()`. Health/cache and cache-cleanup still use persistent-storage. **Recommendation:** Use a single source of truth: registry + file-storage. Either (a) point health/cache and cache-cleanup at registry + file-storage, or (b) remove 24h cleanup and use only API clear. Prefer (a) so health and cleanup stay consistent with list/delete/clear.
- **app/api/health/cache/route.ts:** Uses `getStorageStats()` from persistent-storage. Should use registry + file-storage stats so it reflects the same files as the Files page.
- **lib/cache-cleanup.ts:** Uses `clearAllFiles()` from persistent-storage. Should clear via registry + deleteFileById (same as clear API) so one source of truth.

---

## Summary: what to do

1. **Keep** current file/store/list/delete/clear and registry + file-storage design (persistent, unified).
2. **Add** RAG readiness (queued/ready/error) and chat message when files are indexing.
3. **Add** server-side Lakera (or equivalent) at upload; scan file content before adding to chat context.
4. **Add** revert/reindex: e.g. `POST /api/files/:id/reindex` to rebuild RAG for a file.
5. **Align** health/cache and cache-cleanup with registry + file-storage (optional but recommended).
6. **Optionally** revert chat route formatting to STABLE where the diff is only indentation.
7. **Add** smoke script: fresh install → upload → list → RAG search → chat retrieval → restart → still retrievable → delete/clear → gone → reindex → rebuilds.
