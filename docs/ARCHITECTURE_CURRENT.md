# Current Architecture (Pre–Secure RAG)

This document captures the application architecture before the Secure RAG upgrade. Use it as the baseline for the new pipeline.

---

## UI

### Routes

- **`/`** — Home / chat (`app/page.tsx`)
- **`/files`** — File upload, scan toggles, RAG Auto-Scan, Check Point TE flow (`app/files/page.tsx`)
- **`/dashboard`** — Logs (chat + system) (`app/dashboard/page.tsx`)
- **`/settings`** — API keys, app settings (`app/settings/page.tsx`)
- **`/risk-map`** — Risk map (`app/risk-map/page.tsx`)
- **`/release-notes`** — Release notes (`app/release-notes/page.tsx`)

### Chat

- **`app/page.tsx`** — Renders `ChatInterface`; loads API key status from server or localStorage.
- **`components/ChatInterface.tsx`** — Main chat: messages, `enableRAG`, model selection; sends `POST /api/chat` with messages and optional RAG.
- **`components/MessageList.tsx`**, **`MessageBubble.tsx`**, **`MessageInput.tsx`** — Message display and input.
- **`components/ChatHeader.tsx`**, **`components/ModelSelector.tsx`** — Header and model picker.

### Files / RAG (UI)

- **`components/FileUploader.tsx`** — Drag/drop and file select; props `lakeraScanEnabled`, `ragScanEnabled`.
- **`components/FileList.tsx`** — Lists uploaded files.
- **`app/files/page.tsx`** — Orchestrates upload: store first (`/api/files/store` with `scanStatus: 'pending'`), then Check Point TE (if enabled), then Lakera (`/api/scan`), then update file metadata. No citations or confidence meter in UI.

---

## API

### Upload and store

- **`POST /api/files/store`** — `app/api/files/store/route.ts`  
  - Body: `fileId`, `fileName`, `fileContent`, `fileType`, `fileSize`, optional `scanStatus`, `scanResult`, `scanDetails`, `checkpointTeDetails`.  
  - **Does not run Lakera**; trusts client-provided scan status. Persists via `lib/persistent-storage.storeFile()`.

### File scan (Lakera)

- **`POST /api/scan`** — `app/api/scan/route.ts`  
  - Body: `fileContent`, `fileName`, optional `apiKeys`.  
  - Uses Lakera Guard v2 (inline logic + pre-scan patterns). Returns `flagged`, `message`, `details` (categories, threatLevel, payload, breakdown). Used for file content only.

### Chat (RAG + LLM)

- **`POST /api/chat`** — `app/api/chat/route.ts`  
  - Body: `messages`, optional `enableRAG`, `scanOptions`, `model`, `apiKeys`.  
  - **RAG**: `listFiles()` → for each safe file `getFileContent()` → keyword/data-query relevance → format/truncate → single context string appended to last user message.  
  - **Lakera**: Applied to **user message** and **model output** only (no ingestion/retrieval scan).  
  - **No embeddings or vector store**; no chunking or retrieval step.

### Files (list / delete / clear)

- **`GET /api/files/list`** — `app/api/files/list/route.ts` — List stored files.
- **`DELETE /api/files/delete`** — `app/api/files/delete/route.ts` — Delete by `fileId`.
- **`DELETE /api/files/clear`** — `app/api/files/clear/route.ts` — Clear all files.

### Check Point TE

- **`POST /api/te/upload`** — `app/api/te/upload/route.ts` — Upload file for sandbox.
- **`POST /api/te/query`** — `app/api/te/query/route.ts` — Query TE result.
- **`GET` / `POST /api/te/config`** — `app/api/te/config/route.ts` — TE API key config.

### Other

- **`app/api/keys/route.ts`**, **`app/api/keys/retrieve/route.ts`** — Server-side API keys.
- **`app/api/health/route.ts`**, **`app/api/health/openai/route.ts`**, **`app/api/health/cache/route.ts`** — Health checks.
- **`app/api/waf/health/route.ts`**, **`app/api/waf/logs/route.ts`** — Check Point WAF integration.

---

## Storage

| Component        | Path / mechanism | Purpose |
|-----------------|------------------|---------|
| File storage    | `lib/persistent-storage.ts` | `.storage/` (or `STORAGE_DIR`): `files/` (content), `files-metadata.json` (id, name, size, type, scanStatus, scanDetails, checkpointTeDetails). `storeFile`, `getFileContent`, `listFiles`, `deleteFile`. |
| API keys        | `lib/api-keys-storage.ts`    | `.secure-storage/api-keys.enc` (encrypted). |
| Check Point TE  | `lib/checkpoint-te.ts`      | `.secure-storage/checkpoint-te-key.enc`. |
| System logs     | `lib/system-logging.ts`     | `.secure-storage/system-logs.json`. |
| Client cache    | Browser `localStorage`     | `uploadedFiles`, `appSettings`, `lakeraFileScanEnabled`, `lakeraRagScanEnabled`, `checkpointTeSandboxEnabled`; optional `apiKeys` fallback. |

No relational DB or S3; all persistence is filesystem under `.storage` and `.secure-storage`.

---

## Vector store / embeddings

- **Vector store:** None. No Pinecone, Weaviate, pgvector, etc.
- **Embeddings:** None. No embedding API or model.
- **RAG:** In-memory only in `app/api/chat/route.ts`: filter safe files → load full content → keyword/data-query match → truncate/format → concatenate into one context string for the LLM.

---

## Security (current)

- **Lakera:** Inline in `app/api/chat/route.ts` (user message + model output) and `app/api/scan/route.ts` (file content). No shared client module; no 3-layer (ingestion / retrieval / generation) design.
- **File upload:** Client calls `/api/scan` then `/api/files/store`. Server does **not** re-run Lakera before storing; no hard “Lakera-before-index” gate on the server.
- **Middleware:** `middleware.ts` — Check Point WAF request logging only.
- **LLM:** `lib/aiAdapter.ts` — model-agnostic OpenAI calls; no security layer inside adapter.
- **File prompt check:** `lib/file-content-processor.ts` — `validateFilePromptSecurity()` when combining user prompt + file content (no Lakera call).

---

## Key file paths (quick reference)

```
app/
  page.tsx
  files/page.tsx
  api/
    chat/route.ts      # RAG + Lakera (input/output only)
    files/store/route.ts
    scan/route.ts
    files/list/route.ts, files/delete/route.ts, files/clear/route.ts
    te/upload/route.ts, te/query/route.ts, te/config/route.ts
lib/
  persistent-storage.ts
  api-keys-storage.ts
  checkpoint-te.ts
  aiAdapter.ts
  file-content-processor.ts
  system-logging.ts
middleware.ts
```
