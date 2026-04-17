# Changelog

All notable changes to this project will be documented in this file.

## [1.1.9] - 2026-04-17

### Added

- **`POST /api/lakera/verify`** — Runs a minimal Lakera Guard request with stored or draft key / `project_id` / endpoint; returns JSON (`ok`, `requestUuid`, etc.) for production checks (`curl` friendly).
- **Settings → Verify Lakera (Guard probe)** — Triggers the verify API from the UI.
- **`scripts/remote-production-upgrade.sh`** — Canonical wrapper for SSH upgrades and curl one-liner hints; documented in **`scripts/REMOTE-UPGRADE.md`**.

### Changed

- **Lakera fail-closed in production** — `lib/config.ts`: when `NODE_ENV=production`, **`LAKERA_FAIL_CLOSED` defaults to true** unless set to `false` (development unchanged unless `LAKERA_FAIL_CLOSED=true`).
- **Chat Lakera observability** — Input Guard audit (`sendLakeraTelemetryFromLog` / `lakera_guard` system log) runs **immediately after** the input scan so failures after scan (e.g. token throttle) still record Lakera outcome.
- **Chat debug log** — `API Keys Status` now logs Lakera presence, **`lakeraEnvSet`**, and **`lakeraEffectiveKeyConfigured`** (env overrides encrypted storage; helps debug 401 after CLI key updates).
- **Upgrade pin** — Default **`GIT_REF=v1.1.9`** in **`upgrade-remote-production-v3.sh`**, **`build-remote-production-vm.sh`**, **`install-remote-production-vm.sh`**, and **`UPGRADE_COMMANDS.md`**.
- **`proxy.ts`** — `X-Application-Version` fallback aligned to **1.1.9** when `NEXT_PUBLIC_APP_VERSION` is unset.

## [1.1.8] - 2026-04-03

### Fixed

- **Nested standalone output** — Some Next.js 16 / tracing layouts emit **`.next/standalone/<app>/server.js`** (with extra folders like **`.nvm/`** at the standalone root). **`verify-build`** and **`start-standalone.js`** now resolve **`server.js`** under **`.next/standalone`** (bounded depth) and run with **`cwd`** set to that app directory.

### Changed

- **Upgrade defaults** — **`GIT_REF=v1.1.8`** in **`upgrade-remote-production-v3.sh`**, **`build-remote-production-vm.sh`**, **`install-remote-production-vm.sh`**, and **`UPGRADE_COMMANDS.md`**.

## [1.1.7] - 2026-04-03

### Fixed

- **`npm run build`** — Use **`scripts/next-build-production.mjs`** to invoke **`node_modules/next/dist/bin/next build --webpack`**, so VMs that have a **global `next`** on PATH still produce **`.next/standalone/server.js`**. **`verify-build`** now prints **`.next`** / **`.next/standalone`** listings when **`server.js`** is missing.

### Changed

- **Upgrade defaults** — **`GIT_REF=v1.1.7`** in **`upgrade-remote-production-v3.sh`**, **`build-remote-production-vm.sh`**, **`install-remote-production-vm.sh`**, and **`UPGRADE_COMMANDS.md`**.

## [1.1.6] - 2026-04-03

### Fixed

- **Production `npm run build`** — Run **`next build --webpack`** so **`output: 'standalone'`** reliably emits **`.next/standalone/server.js`** (Next.js 16’s default Turbopack build could finish without standalone, causing **`verify-build`** / upgrade scripts to fail).

### Changed

- **Upgrade defaults** — **`GIT_REF=v1.1.6`** in **`upgrade-remote-production-v3.sh`**, **`build-remote-production-vm.sh`**, **`install-remote-production-vm.sh`**, and **`UPGRADE_COMMANDS.md`**.

## [1.1.5] - 2026-04-03

### Added

- **`SHARED_ORG_OWNER_ID`** — Optional env (e.g. `org`) so **all browsers** share one **file + RAG** corpus on the server; **`GET /api/owner`** returns **`shared_org_corpus`**. Documented in **`.env.example`**.
- **`scripts/production-enable-shared-org-corpus.sh`** — On-VM helper to append **`SHARED_ORG_OWNER_ID`** to **`.env.local`** and restart the service (optional; you can edit **`.env.local`** manually).

### Changed

- **Upgrade defaults** — **`GIT_REF=v1.1.5`** in **`upgrade-remote-production-v3.sh`**, **`build-remote-production-vm.sh`**, **`install-remote-production-vm.sh`**, and **`UPGRADE_COMMANDS.md`**.

## [1.1.4] - 2026-04-02

### Fixed

- **`/release-notes` and `GET /api/release-notes`** — Parse **`### Changed`** from `CHANGELOG.md` and render it on the release notes page (previously only **Added**, **Fixed**, **Improved**, and **Security** were shown).

### Changed

- **Upgrade defaults** — **`GIT_REF=v1.1.4`** in **`upgrade-remote-production-v3.sh`**, **`build-remote-production-vm.sh`**, and docs (**`UPGRADE_COMMANDS.md`**).

## [1.1.3] - 2026-04-01

### Fixed

- **ESLint / `build:fresh` on production VMs** — Ignore **`.backups/**`** and nested **`**/.next/**`** so lint does not scan copied `.next`chunks inside upgrade backup trees (fixes`react/no-find-dom-node`/`react/display-name` on minified files).
- **`upgrade-curl-production.sh`** — On build failure retry: after `git checkout main`, run **`git pull origin main`** so a stale local `main` is not missing `build:fresh` and other scripts. If the first failure happened while already on **`main`**, second attempt also **pulls** and reinstalls deps.

### Changed

- **`.gitignore`** — **`/.backups/`** so backup snapshots are not committed.
- **`upgrade-remote-production-v3.sh`** — Default **`GIT_REF=v1.1.3`**.

## [1.1.2] - 2026-04-01

### Added

- **`scripts/upgrade-remote-production-v3.sh`** — Remote / VM upgrade entry for the **1.1.x** line: default **`GIT_REF=v1.1.2`**, **`USE_BUILD_FRESH=1`**, **`RUN_TYPECHECK=1`**, same underlying **`upgrade-curl-production.sh`** (backup, checkout, npm install, build, systemd, health).
- **`scripts/check-git-no-api-keys.mjs`** — Scans **git-tracked** files for high-confidence **`sk-…`** / **`sk-ant-api…`** patterns; folded into **`npm run check:secrets`**.

### Changed

- **`scripts/run-remote-production-upgrade.sh`** — **`USE_V3=1`** runs **`upgrade-remote-production-v3.sh`** (overrides **`USE_V2`** when set).
- **`scripts/build-remote-production-vm.sh`** — Defaults **`USE_V3=1`**, **`GIT_REF=v1.1.2`**, **`USE_BUILD_FRESH=1`** for laptop-driven production builds.
- **`SECURITY.md`** — Documents that **cloning/upgrading from GitHub does not distribute OpenAI, Anthropic, or Lakera keys**; keys stay in **`.secure-storage/`** / **`.env.local`**.

## [1.0.22] - 2026-03-30

### Added

- **`npm run build:fresh`** — Clears `.next`, runs **`check:secrets`** (client leak gate), **`typecheck`**, **`lint`**, then **`npm run build`**.
- **`scripts/verify-build.mjs`** — After **`next build`**, fails if **`.next/standalone/server.js`** or **`.next/static`** is missing (matches **`output: 'standalone'`** and **`npm start`**).

### Changed

- **Toolchain** — **ESLint 9** with flat **`eslint.config.mjs`**; **`eslint-config-next@16`** with **Next.js 16**; **`eslint-config-prettier@10`**. Removed legacy **`.eslintrc.json`** / **`@typescript-eslint/*` v6**.
- **Dependencies / audit** — Replaced **`xlsx`** with **`exceljs`** for RAG spreadsheet text extraction (addresses unpatched **`xlsx`** advisories); **`npm audit`** clean on supported tree. **`next.config.js`** **`serverExternalPackages`**: **`exceljs`** instead of **`xlsx`**.
- **Excel RAG** — **`.xlsx` / `.xlsm`** (OOXML) only for extraction; legacy **`.xls`** is not indexed for RAG (convert to **`.xlsx`** if needed).

### Fixed

- **Lint** — Satisfies **`eslint-plugin-react-hooks` v7** rules (effects, **`next/link`** on internal error UI, derived state where applicable).

## [1.0.21] - 2026-03-29

### Added

- **`GET /api/te/diagnostic`** — Operator hints for Check Point TE (suggested outbound IP, upload base candidates); no secrets in response.
- **`lib/lakera-guard-audit.ts`** — Server system logs aligned with Lakera Guard platform correlation (`request_uuid`, `project_id`, breakdown summary). Chat input/output, file scan, and RAG paths emit `service: lakera_guard` audit rows.
- **Lakera Guard metadata** — Chat screening sends `session_id` (per-request correlation) alongside existing `user_id` / `ip_address` / `internal_request_id`.

### Changed

- **Check Point TE (TPAPI 1.0 alignment)** — Query body uses `te.images[]` and optional `te.reports`; default upload reports **`xml`** only (override `CHECKPOINT_TECLOUD_TE_REPORTS`). Optional **`te_cookie`** stickiness from responses; **`CHECKPOINT_TE_AUTH_FORMAT`** (`raw` vs `te_api_key` / default prefixed). **`GET /api/te/config`** returns `teAuthFormat`.
- **Lakera telemetry** — Platform visibility is primarily via **Guard API** calls (dashboard logs). Optional HTTP companion POST only when **`LAKERA_TELEMETRY_HTTP=true`**; extended payload includes `lakera_correlation`. **`LAKERA_GUARD_AUDIT_LOG=false`** disables local audit rows.
- **Files page** — Visibility refetch calls **`/api/owner`** before list (owner cookie sync); clearer banners when the server returns an empty list vs a failed refresh.

### Fixed

- Misleading “telemetry to Lakera” behavior: default no longer POSTs to undocumented `/v2/telemetry` (avoid silent 404s); use Guard + audit logs, or opt-in HTTP ingest.

## [1.0.20] - 2026-03-28

### Added

- **`lib/upload-body-buffer.ts`** — `POST /api/files/store` decodes client **base64** payloads for binary uploads (PDF, DOCX, etc.). Previously `Buffer.from(content, 'utf-8')` stored the base64 _string_ as file bytes, breaking RAG and any binary use.
- **`lib/extract-text-for-rag.ts`** — **mammoth** (DOCX/DOC) and **pdf-parse** (PDF) extract plain text for RAG; used from **`lib/rag-context.ts`** and **`app/api/chat`** fallback when primary retrieval returns no chunks.
- **Production VM upgrades** — `scripts/upgrade-remote-production-v2.sh` (type-check + health retries), `scripts/run-remote-production-upgrade.sh` (SSH from laptop). **`upgrade-curl-production.sh`**: optional `RUN_TYPECHECK` / `HEALTH_RETRIES`, restore **`.storage`** from backup, **`checkout_git_ref`** helper, **missing `v*` tag → `GIT_REF_FALLBACK`** (default `main`).

### Changed

- **Upgrade wrappers** — `upgrade-remote-production.sh` / `v2` default **`GIT_REF=main`** so curl upgrades work when release tags are not pushed.
- **`UPGRADE_COMMANDS.md`** — Option A1 one-liner without the v2 raw URL; troubleshooting for 404 and missing tags.
- **`next.config.js`** — `serverExternalPackages`: `pdf-parse`, `pdfjs-dist`, `mammoth`.

### Fixed

- **Chat + uploaded PDF/Word** — Answers could ignore file content (especially with Lakera upload scan off); fixed by correct bytes on disk and text extraction for RAG.

## [1.0.19] - 2026-03-27

### Added

- **Lakera Guard (canonical client)** — `lib/lakera/guard-client.ts` centralizes POST/parse/merge for chat screening, `/api/scan`, and server file store.
- **Server scan on store** — `POST /api/files/store` runs Lakera when a key is configured; sets `scan_status` / `scan_details` from the server (not client-only).
- **Chat vs upload scans** — `chatUseUploadedFilesContext` (localStorage) and API `lakeraRetrievalScan`: file content in chat can stay on when Lakera/Check Point upload toggles are off; per-chunk retrieval scan follows Files-page Lakera preferences.
- **RAG retrieval** — Relevance scoring over chunks, higher default chunk budget in chat (56), sliding windows up to 100 slices per prose file with top-40 pre-rank; global rank-and-cap; broader `isDataQuery` / `isFileOrDataQuestion` for companies, people, orgs, quoted strings; `readOwnerFileBuffer` reads canonical `raw.bin`.

### Changed

- **`lib/security/lakera.ts`** — Uses `postLakeraGuard` / merge pipeline; merges `getApiKeys()` for endpoint and project id when only the key is overridden.
- **RAG ingest/embed/reindex/chat** — Thread Lakera credentials from `getApiKeys()` into `scanIngestion` / retrieval metadata.
- **Files page** — Turning off Lakera Scan no longer forces RAG auto-scan off in a way that disables chat file context; clarified “Lakera after upload” copy.

### Fixed

- **OpenAI adapter** — On 400, retry Chat Completions with `max_completion_tokens` when the model rejects `max_tokens` (and Azure parity).
- **Next.js dev navigation** — `Strict-Transport-Security` is sent only in **production** so local HTTP dev is not upgraded to broken HTTPS (`Failed to fetch` on client navigations).
- **RAG file inclusion** — Do not skip registry `scan_status: error` for retrieval (Lakera API misconfig ≠ unsafe file).

## [1.0.18] - 2026-03-26

### Added

- Azure OpenAI connector (`provider=azure`):
  - Settings UI fields for `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`
  - `/api/models?provider=azure` to list available Azure OpenAI deployments
  - `/api/chat` routes to Azure OpenAI using the selected deployment name

### Changed

- Model/provider selector now includes Azure OpenAI alongside OpenAI and Anthropic

### Security (Lakera Guard)

- Output/generation scans send the screened line as `role: assistant` (input scans remain `user`) so Guard evaluates the last interaction correctly per Lakera docs
- Production logs no longer print Lakera `breakdown` / `payload` details (dev-only debug)
- Guard requests include stable `metadata.user_id` (from app owner id) for Lakera Platform analytics alongside existing telemetry

## [1.0.17] - 2026-02-06

Production release: chat security, Lakera toggles, port 3000 only, no Sources list.

### Fixed

- **Chat: general vs file questions (security)**
  - General knowledge questions (e.g. "what is depression") use **model-only** answers: no RAG, no file context, no "Sources" section.
  - File/data questions (e.g. "who is dealing with depression") use RAG; answers are based on file content only.
- **Chat: no file names or row numbers**
  - RAG citations no longer expose file names, row numbers, or PII. API returns `rag: { chunks: [] }`; UI shows only the answer text (natural English).
- **Chat: model instructions**
  - When RAG is used, the model is instructed not to mention file names, row numbers, or document identifiers.
- **Chat: fallback file context**
  - System message no longer lists actual file names; refers only to "N uploaded file(s)".
- **UI**
  - Sources list removed from chat responses; only the answer text is shown.

### Changed

- **Lakera toggles**
  - Input and output scan respect UI toggles: when toggles are off, Lakera is not run (no "Blocked by filter"); when on, scanning runs as before.
- **Install & upgrade**
  - App runs on **port 3000 only**: nginx is not installed or started by the install script; UFW allows 22 and app port (3000). Upgrade script no longer reloads nginx.
- **Check Point TE key**
  - Can be updated via CLI: `scripts/set-api-keys.sh --checkpoint-te-key "..."` or `curl -X POST .../api/te/config -d '{"apiKey":"..."}'`.

## [1.0.16] - 2026-02-05

### Added

- **Local persistent storage architecture**: Canonical layout under `DATA_DIR`:
  - `uploads/<tenant>/<fileId>/raw.bin` and `meta.json` (atomic writes: tmp → rename)
  - `derived/<tenant>/<fileId>/status.json` for pipeline status
  - Registry `pipeline_status` column: `uploaded` → `extracting` → `scanning` → `indexing` → `ready` or `blocked` / `failed`
- **GET /api/files/status?fileId=**: Returns pipeline status for a file (JSON only: `{ ok: true, data: { fileId, status, updatedAt } }`).
- **Async processing pipeline**: Status lifecycle backed by registry and derived status files; RAG ingest runs Lakera on chunks before embedding.
- **Blank screen prevention**: All file API routes return JSON only; `lib/http/safe-fetch.ts` re-export and ErrorBoundary in place.
- **Upgrade safety**: `scripts/upgrade.sh` (in-place upgrade to v1.0.16); never deletes or moves `DATA_DIR`. `scripts/preflight.sh` (Node version, DATA_DIR exists and writable, disk space). `scripts/storage-perms.sh` (ownership and safe chmod; no 777).
- **Clean install script**: `scripts/install_ubuntu_clean.sh` — full VM install with prerequisites, nvm/Node, clone, flatten subdir, build. One-liner: `curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install_ubuntu_clean.sh | bash`. **FORCE_CLEAN=1** wipes existing install (preserves API keys) and does fresh clone with latest fixes including RAG+Model chat.
- **Next.js 16 proxy**: Migrated `middleware.ts` → `proxy.ts` for Next.js 16 compatibility.

### Fixed

- **Crypto.randomUUID in production**: Removed `crypto.randomUUID` usage from `lib/owner-client.ts` (Node 14 compatibility). Uses timestamp + Math.random fallback for client IDs.
- **Standalone start**: `scripts/start-standalone.js` selects `.next/standalone/server.js` when standalone build exists; systemd PATH fix for Node in nvm.
- **Install scripts**: `dpkg-query` for package checks; prerequisites phase; chown temp dir before clone; flatten single subdir (e.g. `secure-ai-chat/`) into install dir; verify Node/npm as `secureai` user.
- **Upgrade scripts**: Clear `node_modules/.cache` before build in upgrade flows.
- **Chat general-knowledge fallback**: Chat no longer restricts answers to uploaded files only. General questions (e.g. "what is Python?", "hello") are answered from model knowledge; RAG/file context is used only when the question is about file content or data. Uses `groundedOnly: false` and updated system prompts.

### Changed

- **Store route**: Writes to canonical layout (raw.bin + meta.json + status.json); registry gets `pipeline_status = uploaded`.
- **Read path**: `readOwnerFile` tries canonical `raw.bin` first, then legacy single file for backward compatibility.
- **Release notes**: Retain prior correction (last 5 lines under v1.0.12 "Added functionality" removed in CHANGELOG).

## [1.0.15] - 2026-02-05

Stable release: file upload, release notes, and production install fixes.

### Fixed

- **Production npm install**: Overrides use exact versions for npm alias compatibility (`npm:@eslint/config-array@0.18.0`, `npm:@eslint/object-schema@2.1.0`) so `npm ci` / `npm install` succeed on production VMs (fixes "Invalid comparator" error).
- **Chat file read path**: Chat RAG file content now uses only `readOwnerFile(owner, fileId)` from persistent-storage (single source of truth). Removed fallback to file-storage key layout so uploaded files are always read from `data/uploads/<ownerId>/<fileId>`.

### Changed

- **Stable release baseline**: This version is the recommended production release after v1.0.11. Includes all v1.0.14 fixes (safeFetchJson, ErrorBoundary, JSON error contract, release notes cleanup) plus production install and chat read path fixes.

## [1.0.14] - 2026-02-05

### Fixed

- **File upload blank screen (v1.0.13 regression)**: Upload and files list/store/clear now use a safe JSON fetch helper so non-JSON API responses (e.g. HTML error pages) never cause the UI to crash with a white screen.
  - New `lib/safe-fetch.ts`: `safeFetchJson()` returns `{ ok, status, data?, error? }` and never throws on parse/network errors.
  - Files page: all calls to `/api/files/list`, `/api/files/store`, and `/api/files/clear` use `safeFetchJson`; errors surface as a visible banner instead of crashing.
  - Error boundary added around the Files page so any render error shows a friendly fallback instead of a blank screen.
- **API error contract**: File store and list routes return consistent JSON on failure: `{ ok: false, error: { code, message, details: null } }` with appropriate HTTP status (4xx/5xx).

### Added

- **Regression test**: `scripts/smoke-upload.sh` — verifies store returns JSON (not HTML), file persists, and list returns the file (run with server at `BASE_URL`, e.g. `BASE_URL=http://localhost:3000 ./scripts/smoke-upload.sh`).

### Changed

- **Release notes cleanup**: Removed the last 5 lines under v1.0.12 "Added functionality" (Local server startup bullet) from CHANGELOG.

## [1.0.12] - 2026-02-05

### Added

- **Anthropic (Claude) support**: Chat can use OpenAI or Anthropic as provider
  - Server-side storage for Anthropic API key (Settings, encrypted storage, PIN protection)
  - Provider selector in chat UI (OpenAI / Anthropic) with model dropdown per provider
  - `/api/models?provider=anthropic` returns Claude models; existing `/api/models` remains default OpenAI
  - Anthropic Messages API adapter (`callAnthropic`) in `lib/aiAdapter.ts` with system prompt and RAG context
  - Chat API accepts `provider` in request body and routes to OpenAI or Anthropic with same RAG/file context
  - Settings: Anthropic API key field (paste-only, clear with PIN), status in keys retrieve API

### Improved

- **Build and npm**: Documentation for `npm warn Unknown env config "devdir"`
  - README and docs/DATA_STORAGE_AND_REINSTALL.md explain one-time fix: `npm config delete devdir`
  - Clarified that the warning comes from user config, not the project

### Fixed

- **ChatInterface**: `apiKeys` possibly null when building scanOptions (optional chaining for `apiKeys?.lakeraAiKey`)

## [1.0.11] - 2026-01-16

### Added

- **Check Point WAF Integration**: Enterprise-grade Web Application Firewall integration
  - Middleware for capturing request metadata and security events
  - WAF logs API endpoint (`/api/waf/logs`) for Check Point WAF consumption
  - WAF health check endpoint (`/api/waf/health`) for monitoring
  - Support for Check Point WAF-specific headers and IP detection
  - Security event logging for blocked requests and threat detection
  - CSV and JSON export formats for log analysis
  - Optional authentication for WAF endpoints (via `WAF_AUTH_ENABLED` and `WAF_API_KEY`)
  - Comprehensive filtering options (by level, service, time range, IP, endpoint, etc.)

### Fixed

- **API Parameter Update**: Fixed `max_completion_tokens` parameter error for GPT-5.x models
  - Changed `max_completion_tokens` to `max_output_tokens` to match updated API specification
  - Updated parameter normalization in AI adapter for Responses API
  - Resolves "Unsupported Parameter, 'max_completion_tokens' in the response API" errors
  - Fixes production errors when using GPT-5.x models with token limits
- **Check Point TE File Upload Error**: Fixed `TypeError: formDataStream is not async iterable` error in Check Point TE file upload route
  - Replaced manual stream handling with `form-data` package's built-in `getBuffer()` method
  - Simplified buffer conversion approach (reduced from 49 lines to 3 lines)
  - Resolves runtime errors when uploading files to Check Point TE API
  - Fixes "Failed to execute error" messages when scanning files
- **GPT-5.x Rate Limit Error**: Fixed rate limit errors for GPT-5.x models
  - Increased rate limits from 50 to 200 requests/minute for GPT-5.x models
  - Improved model matching for GPT-5.x with suffixes (e.g., `gpt-5.2-pro-2025-12-11`)
  - Better rate limit handling and error messages

### Improved

- **Rate Limiting**: Enhanced rate limiting system for GPT-5.x models
  - Increased rate limits from 50 to 200 requests/minute for GPT-5.x models
  - Improved model matching for GPT-5.x with suffixes (e.g., `gpt-5.2-pro-2025-12-11`)
  - Model-specific rate limits (GPT-4: 100/min, GPT-4o: 200/min, GPT-5.x: 200/min)
  - Automatic rate limit checking before API calls
  - Proper error handling with Retry-After headers (429 status)
  - Rate limit status tracking and monitoring
- **RAG System**: Enhanced file processing capabilities
  - File limit increased from 5 to 10 files
  - Improved file content processing
  - Better structured data extraction
- **UI/UX Improvements**: Enhanced readability and user experience
  - Font sizes increased by 1 step across entire application (text-xs→text-sm, text-sm→text-base, etc.)
  - Light mode text colors made darker for better readability (#1F2933 → #0F172A)
  - Light mode font weight set to 500 (medium/bold) for improved contrast
  - Base font size increased to 17px in light mode
  - Better visual hierarchy and improved accessibility
- **Token Limit Validation**: Model-specific token limit validation and management
  - Token counting/estimation utility (~4 chars per token approximation)
  - Model-specific context window limits (GPT-4: 8K-128K, GPT-5: 128K)
  - Automatic token validation before API calls
  - Intelligent message truncation when limits are exceeded
  - 10% safety buffer to prevent edge cases
  - Clear error messages with suggestions for resolution
  - Support for all GPT-4 and GPT-5 model variants
- **Error Handling**: Enhanced error handling for rate limits and token limits
  - Specific error types for rate limit (429) and token limit (400) errors
  - User-friendly error messages with actionable suggestions
  - Automatic detection of rate limit errors from API responses
  - Proper HTTP status codes and Retry-After headers
  - Logging of rate limit and token limit violations

## [1.0.10] - 2026-01-13

### Added

- **Enhanced RAG (Retrieval Augmented Generation) System**: Automatic file indexing and intelligent content search
  - Files are automatically indexed when uploaded (no manual configuration needed)
  - Chat client automatically searches uploaded files before using general LLM knowledge
  - Improved content matching algorithm for data/PII queries
  - System message informs LLM about available files and search instructions
  - Enhanced file context formatting with clear file separation
  - Increased file size limit from 5MB to 10MB for RAG processing
  - Increased file count limit from 3 to 5 most relevant files
  - Better handling of large files with intelligent truncation
  - Fallback inclusion for safe files even when keywords don't match
  - Support for CSV, JSON, and TXT files with automatic data file detection

### Improved

- **File Access Control**: More inclusive file filtering for RAG
  - Files with `pending` or `not_scanned` status are now included (only explicitly flagged/malicious files excluded)
  - Better security balance between safety and usability
  - Clear distinction between safe files and malicious files
- **Content Matching**: Enhanced algorithm for finding relevant files
  - Automatic detection of data files (CSV, JSON, TXT)
  - Recognition of data-related queries (users, records, fields, etc.)
  - More lenient keyword matching (words > 2 chars instead of > 3)
  - Intelligent fallback to include safe files when no direct matches found
- **LLM Instructions**: Clear system prompts about file access
  - LLM is explicitly informed about available uploaded files
  - Instructions to search files first, then fall back to general knowledge
  - Requirement to cite source files when providing information
  - Clear instructions for data queries and file analysis

### Fixed

- **File Search Issue**: Fixed chat client not finding uploaded files
  - Previously, chat would say "please upload files" even when files were uploaded
  - Now automatically searches all safe uploaded files
  - Better handling of files with various scan statuses

## [1.0.9] - 2026-01-13

### Added

- **API Errors & Key Failures Section in Logs**: Dedicated section in Logs viewer showing all API errors and key failures with full error details
  - Highlights key failures (401/403) with troubleshooting tips
  - Shows full error messages, response bodies, and stack traces
  - Filters logs by API failures, errors, and HTTP status codes >= 400
  - Visual indicators (🔑 for key failures, 🚫 for access denied, ❌ for other errors)
  - Expandable system details including endpoints, request IDs, and response bodies
- **Dynamic Release Notes**: Release notes page now dynamically loads from CHANGELOG.md via API endpoint
  - Automatically includes all release notes from CHANGELOG.md
  - No need to manually update release notes page when adding new versions
  - API endpoint (`/api/release-notes`) parses CHANGELOG.md and returns structured data
  - Loading and error states for better UX
- **Lakera Guard API v2 Enhancements**: Full support for official Lakera Guard API v2 specification
  - Added `payload` field extraction (detected threats with locations)
  - Added `breakdown` field extraction (detector results)
  - Enhanced UI to display payload and breakdown data in chat messages, file scans, and system logs
  - Improved threat reporting with exact text positions and detector information
  - Console logging for debugging payload and breakdown data

### Improved

- **Logs Viewer**: Enhanced with dedicated API errors section showing full error details and key failure troubleshooting
  - Better visibility into API failures and authentication issues
  - Comprehensive error information for debugging
  - Key failure detection with actionable troubleshooting tips
- **Release Notes**: Now automatically syncs with CHANGELOG.md, ensuring all versions are always up-to-date
  - Eliminates manual synchronization between CHANGELOG.md and release notes page
  - Single source of truth for version history
  - Automatic parsing and formatting of changelog entries

## [1.0.8] - 2026-01-13

### Added

- **Ubuntu VM Installation Script** (`scripts/install_ubuntu_public.sh`): Single-step installation script for fresh Ubuntu VM deployments
  - Installs system dependencies, Node.js LTS 20.x, clones repository
  - Auto-detects free port starting from 3000 (avoids EADDRINUSE errors)
  - Creates dedicated user (`secureai`) and installs under `/opt/secure-ai-chat`
  - Configures systemd service for auto-start and management
  - Sets up nginx reverse proxy on port 80
  - Configures UFW firewall (SSH + Nginx)
  - Performs smoke checks after installation
  - Idempotent: safe to re-run for updates/repairs
- **Safe Remote Upgrade Script** (`scripts/upgrade_remote.sh`): Safely upgrades remote installations to latest version
  - Automatically backs up all settings before upgrade (`.env.local`, `.secure-storage/`, `.storage/`)
  - Preserves all configurations during upgrade
  - Verifies upgrade success with version and health checks
  - Rollback capability via backup
- **Cleanup/Reset Script** (`scripts/cleanup_reset_vm.sh`): Safely removes application, services, and nginx configuration
- **Git Repository Fix Script** (`scripts/fix_git_repo.sh`): Fixes corrupted or missing `.git` repository in installation directory
- **CLI Script to Set API Keys** (`scripts/set-api-keys.sh`): Set API keys via command line
  - Supports all keys: OpenAI, Lakera AI, Lakera Project ID, Lakera Endpoint, Check Point TE
  - Interactive mode for easy key entry
  - Works with local and remote servers
  - Uses existing API endpoints (no application changes)
- **Installation Documentation** (`docs/INSTALL_UBUNTU_VM.md`): Comprehensive guide for Ubuntu VM installation
- **Upgrade Documentation** (`docs/UPGRADE_REMOTE.md`): Safe remote upgrade process
- **API Endpoints Documentation** (`docs/API_ENDPOINTS_FOR_SECURITY.md`): Recommended API endpoints for security configuration
- **CLI API Keys Documentation** (`docs/CLI_API_KEYS.md`): CLI usage guide
- **Merge Safety Reports**: Detailed verification and risk assessment reports
- **API Errors & Key Failures Section in Logs**: Dedicated section in Logs viewer showing all API errors and key failures with full error details
  - Highlights key failures (401/403) with troubleshooting tips
  - Shows full error messages, response bodies, and stack traces
  - Filters logs by API failures, errors, and HTTP status codes >= 400
- **Dynamic Release Notes**: Release notes page now dynamically loads from CHANGELOG.md via API endpoint
  - Automatically includes all release notes from CHANGELOG.md
  - No need to manually update release notes page when adding new versions
  - API endpoint (`/api/release-notes`) parses CHANGELOG.md and returns structured data
- **Lakera Guard API v2 Enhancements**: Full support for official Lakera Guard API v2 specification
  - Added `payload` field extraction (detected threats with locations)
  - Added `breakdown` field extraction (detector results)
  - Enhanced UI to display payload and breakdown data in chat, files, and logs
  - Improved threat reporting with exact text positions and detector information

### Fixed

- **Git Repository Issues**: Fixed "fatal: not a git repository" errors on remote installations
- **Upgrade Process**: Fixed 404 errors when downloading upgrade scripts from wrong branch
- **Port Conflicts**: Auto-detection of free ports prevents EADDRINUSE errors

### Improved

- **README.md**: Added "Quick Install (Ubuntu VM)" and "Reset/Cleanup" sections
- **Port Auto-Detection**: Installation script automatically finds free port starting from 3000
- **Idempotent Installation**: Installation script can be safely re-run
- **Documentation**: Comprehensive guides for installation, upgrade, and CLI usage
- **Logs Viewer**: Enhanced with dedicated API errors section showing full error details and key failure troubleshooting
- **Release Notes**: Now automatically syncs with CHANGELOG.md, ensuring all versions are always up-to-date

## [1.0.7] - 2026-01-12

### Added

- **Release Notes Page**: New dedicated page for viewing version history and changelog
  - Accessible from Settings page and navigation sidebar
  - Displays version history with categorized changes (Added, Fixed, Improved, Security)
  - Shows current application version
  - Beautiful UI with version badges and type indicators
- **RAG (Retrieval Augmented Generation)**: Chat can now access and answer questions about uploaded files
  - Automatic file content retrieval based on user queries
  - Supports CSV, JSON, and text files
  - Smart content matching and excerpt generation for large files
  - Controlled by "RAG Scan" toggle on Files page
- **GPT-5.x Support**: Full support for GPT-5.x models with automatic API migration
  - Model-agnostic adapter (`lib/aiAdapter.ts`) for unified LLM calls
  - Automatic API selection (Responses API for GPT-5.x, Chat Completions for GPT-4)
  - Message normalization (messages[] to single input for GPT-5.x)
  - Token parameter conversion (`max_tokens` to `max_completion_tokens`)
  - Runtime auto-fallback (GPT-5.2 → GPT-5.1 → GPT-4o)
- **Release Gate System**: Comprehensive pre-deployment validation
  - Strict PASS/FAIL checklist for all deployments
  - Automated release gate script (`npm run release-gate`)
  - Single copy/paste release command pack
  - Security scans (client-side key leakage, build output, git history)
  - Complete command documentation in RELEASE.md
- **Security Verification Script**: Automated script to verify key security (`npm run verify-security`)
  - Checks .gitignore configuration
  - Verifies no keys in git repository
  - Validates file permissions
  - Scans for hardcoded API keys
- **Installation Validation Script**: Comprehensive installation validation (`scripts/validate-installation.sh`)
  - Build & type check validation
  - Key storage configuration verification
  - Persistent storage validation
  - Application server status checks
  - API key storage & retrieval verification

### Fixed

- **File Scanning Error**: Fixed "Failed to execute 'json' on 'Response'" error for large files
  - Response cloning to avoid stream consumption issues
  - Better error handling for files with 500+ individuals
- **Navigation Issue**: Fixed sidebar navigation - sidebar now always visible on desktop
  - Desktop users can always access navigation links
  - Mobile users can toggle sidebar with hamburger menu
  - Auto-close sidebar on mobile after navigation
- **Checkpoint TE Status**: Fixed status not updating after key save
  - Added 200ms delay before status refresh
  - Periodic status checking in Files page (every 5 seconds)
  - Automatic toggle enable when key is configured
- **Webpack Chunk Errors**: Fixed "Cannot find module" errors
  - Proper cache clearing and rebuild process
  - Fresh dev server startup
- **TypeScript Errors**: All type errors resolved
- **ESLint Errors**: All critical errors fixed (only expected warnings remain)

### Improved

- **Key Deletion**: Enhanced with proper server-side cache invalidation
- **Status Synchronization**: Better sync between Settings and Files pages
- **System Prompt**: Updated to allow data queries from uploaded files
- **Error Handling**: Enhanced error messages and recovery
- **Documentation**: Comprehensive security and upgrade documentation
- **File Upload Stability**: Enhanced concurrency control with error isolation
  - Sequential file processing to prevent event loop blocking
  - 100ms delay between files to prevent overwhelming system
  - Proper error isolation (one failure doesn't block others)
- **Logging Security**: Authorization header and API key redaction in system logs
  - Automatic redaction of Authorization headers (first 30 chars only)
  - API key pattern redaction in request/response bodies
  - Header redaction for any header containing "api-key" or "apikey"

### Security

- **Key Security Verification**: Confirmed all API keys excluded from git
- **Persistence Verification**: Confirmed keys persist across restarts and upgrades
- **File Permissions**: Verified correct permissions (700/600) on storage files
- **Client-Side Key Leakage Prevention**:
  - ESLint rule blocks `checkpoint-te` and `api-keys-storage` imports in client components
  - Check Point TE API key never reaches client (server-side only)
  - `checkpointTeKey` state cleared immediately after save (never persisted)
  - All TE operations use server-side API routes (`/api/te/*`)
- **Release Gate Security Scans**: Automated security checks in release gate
  - Client-side key leakage detection
  - Build output scan for API keys
  - Git history scan for secrets
  - Hard-gate failure on any security violation

## [1.0.6] - 2026-01-12

### Added

- Checkpoint TE (Threat Emulation) integration
- Server-side API key storage with encryption
- PIN verification for sensitive operations

### Fixed

- Form-data stream handling in Checkpoint TE upload
- Key deletion with proper cache invalidation

## [1.0.5] - 2025-01-10

### Added

- **OpenAI Model Selector**: Users can now select different OpenAI models from a dropdown list on the Chat page
  - Model dropdown displays available GPT models based on configured API key
  - Dynamic model list fetched from OpenAI API
  - Model preference persisted in localStorage
  - Model names formatted for readability (e.g., "GPT-4o Mini", "GPT-4o")
  - Models sorted with newest first
  - Secure validation (only gpt-\* models allowed)
  - Default model: `gpt-4o-mini`
- **New API Route**: `/api/models` - Fetches available OpenAI models
- **New Component**: `ModelSelector` - Dropdown component for model selection

### Changed

- **Chat API**: Enhanced to accept and use selected model parameter
- **ChatInterface**: Integrated ModelSelector component above chat messages

### Fixed

- **Settings Page - Save Keys Button**: Fixed button not visible in light mode
  - Changed from invalid `var(--primary)` to `rgb(var(--accent))` for proper theme support
  - Button now clearly visible in both light and dark modes
- **Settings Page - Lakera Project ID**: Made Project ID field visible (text input instead of password)
  - Added helpful message about policy verification
  - Current Project ID displayed when configured

### Technical

- Updated version to 1.0.5
- All new features styled with UniFi theme tokens
- Maintained backward compatibility

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2026-01-XX

### Added

- **UniFi-Style Day/Night Theme System**: Complete theme system with instant switching, no flash on load
  - Light and dark themes with neutral-first palette and single accent color
  - CSS variable-based design tokens for maintainability
  - Theme toggle component with system preference support
  - Bootstrap script prevents theme flash on initial load
- **Status Dots Enhancement**: Visual status indicators for toggles and API key configuration
  - Green dots for enabled/configured states
  - Red dots for disabled/unconfigured states
  - Subtle glow effects for better visibility
- **Source Protection**: Enhanced security to prevent casual source code viewing
  - Disabled right-click context menu
  - Disabled keyboard shortcuts (F12, Ctrl+U, Ctrl+Shift+I, etc.)
  - Disabled text selection (except form fields)
  - Disabled image dragging
- **Production Safety Audit**: Comprehensive pre-flight safety audit
  - `docs/SAFETY_AUDIT.md` - Complete audit of runtime entrypoints and production paths
  - `docs/HARDENING_CHANGES.md` - Documentation of all hardening changes
  - Environment variable validation script (`scripts/validate-env.sh`)
- **Environment Configuration**:
  - `.env.example` file for documentation
  - `validate-env` npm script for startup checks
- **Package Scripts**:
  - Added `typecheck` alias for `type-check`
  - Added `test` script (placeholder)
  - Added `validate-env` script

### Changed

- **Dockerfile**: Updated Node.js version from `20-alpine` to `25-alpine` to match package.json engines
- **Theme System**: Complete refactor to use CSS variables (design tokens) instead of hard-coded colors
- **Files Page**: Added status dots to Lakera Scan, RAG Auto Scan, and File Sandboxing toggles
- **Settings Page**: Added status dots to API key configuration fields
- **Layout**: Enhanced source protection integration

### Security

- ✅ Source protection component prevents casual code inspection
- ✅ Error boundaries verified to not expose secrets
- ✅ Security headers verified and production-ready
- ✅ Docker, systemd, and Kubernetes configurations hardened
- ✅ Environment variable validation (warns, doesn't fail)

### Documentation

- `docs/SAFETY_AUDIT.md` - Comprehensive production safety audit
- `docs/HARDENING_CHANGES.md` - All hardening changes documented
- `docs/THEME_SYSTEM.md` - Theme system architecture and usage guide
- `.env.example` - Environment variable documentation

### Deployment

- ✅ All entrypoints verified (Next.js, Docker, systemd, Kubernetes)
- ✅ Health check endpoint verified (`/api/health`)
- ✅ Build process verified (TypeScript, ESLint, Next.js build)
- ✅ All package scripts verified (lint, typecheck, test, build, start)
- ✅ Backwards compatibility maintained (all changes are non-breaking)

---

## [1.0.3] - 2026-01-XX

### Added

- **Server-Side Encrypted API Key Storage**: All API keys (OpenAI, Lakera, Check Point TE) now stored server-side with AES-256-CBC encryption
- **Universal Access**: Application works from any browser/device once keys are configured (no per-device setup needed)
- **Comprehensive Security Checks**: Enhanced security validation to prevent API key leakage in code, logs, or client bundles
- **API Keys Management API**: New `/api/keys` endpoints for secure server-side key management
- **Documentation**: Added `SERVER_SIDE_KEY_STORAGE.md` with comprehensive storage architecture documentation
- **Post-Change Validation Report**: Added `POST_CHANGE_VALIDATION_V1.0.3.md` with validation results

### Changed

- **API Routes**: Updated chat and scan routes to prioritize server-side keys over client keys
- **Settings UI**: Settings form now saves keys to server-side encrypted storage instead of localStorage
- **Client Components**: Updated ChatInterface, page.tsx, and files.tsx to load keys from server-side
- **Security Validation**: Enhanced `check-security.sh` to check for all API keys (OpenAI, Lakera, Check Point TE)
- **ESLint Rules**: Added restrictions to prevent client-side imports of `api-keys-storage.ts`
- **Release Gate**: Updated release gate script with comprehensive security checks
- **Version Display**: Updated app version to 1.0.3 in Layout.tsx footer

### Security

- ✅ **No Hardcoded Keys**: Verified no API keys hardcoded in source code
- ✅ **Encrypted Storage**: All keys encrypted at rest with AES-256-CBC
- ✅ **Secure Permissions**: Storage files have 600 permissions (owner read/write only)
- ✅ **PIN Protection**: Key deletion operations require PIN verification
- ✅ **Client-Side Prevention**: ESLint rules prevent accidental client-side key imports
- ✅ **Build Output Scan**: Release gate scans build output for leaked keys
- ✅ **Comprehensive Security Checks**: Enhanced security script checks for all API key types

### Migration

- Automatic migration from localStorage to server-side storage
- Existing keys in localStorage are migrated on first Settings save
- Backward compatibility maintained during transition period

### Documentation

- `SERVER_SIDE_KEY_STORAGE.md` - Comprehensive server-side key storage guide
- `POST_CHANGE_VALIDATION_V1.0.3.md` - Post-change validation report
- Updated security check documentation
- Enhanced release gate documentation

## [1.0.2] - 2026-01-XX

### Added

- **Lakera Telemetry Integration**
  - Automatic log export to Platform.lakera.ai for analytics and monitoring
  - Support for S3 log export (Enterprise feature via Platform.lakera.ai Settings)
  - Custom API telemetry endpoint for real-time analytics
  - Non-blocking telemetry that doesn't affect main application flow
  - Configurable via `LAKERA_TELEMETRY_ENABLED` and `LAKERA_TELEMETRY_ENDPOINT` environment variables

- **Production Upgrade Script**
  - Single-command upgrade script (`upgrade.sh`) for production systems
  - Automatic dependency updates, build, and service restart
  - Environment variable configuration support
  - Rollback capability with commit hash tracking

- **Deployment Verification Script**
  - Post-deployment verification script (`verify-deployment.sh`)
  - Comprehensive health checks and service status validation
  - Git commit hash verification

- **Documentation**
  - `LAKERA_TELEMETRY.md` - Technical API reference for Lakera telemetry
  - `LAKERA_LOGS_SETUP.md` - Complete setup guide for S3 export and API telemetry
  - `UPGRADE.md` - Production upgrade documentation
  - `V1.0.2_RELEASE_NOTES.md` - Release notes

### Enhanced

- **Release Gate Automation**
  - Improved security scan to only check for actual API key patterns (not variable names)
  - Better error handling and validation

- **Lakera Integration**
  - Telemetry automatically sent after each scan (chat input/output, file uploads)
  - Uses Lakera API key and Project ID from Settings
  - Privacy-preserving (only metadata, not full content)

### Fixed

- TypeScript errors in LogViewer and SystemLogViewer (unknown type handling)
- ESLint disable comments (removed invalid rule references)
- Build output security scan false positives (variable names vs actual API keys)

### Documentation

- Updated `README.md` with Lakera telemetry configuration options
- Added upgrade instructions and verification steps
- Enhanced release workflow documentation

---

## [1.0.1] - 2026-01-XX

### Added

- **Check Point ThreatCloud / Threat Emulation (TE) Integration**
  - Server-side only API key storage (encrypted at rest in `.secure-storage/checkpoint-te-key.enc`)
  - File sandbox toggle via Check Point ThreatCloud TE
  - Secure API key management in Settings UI with PIN protection
  - File upload sandboxing with ThreatCloud TE proxy endpoints
  - Polling-based query system with bounded timeouts (60s total, 30 attempts)
  - Comprehensive threat detection with detailed log fields from Check Point R81 documentation

- **PIN Verification System**
  - 4-8 digit PIN for protecting sensitive API key operations
  - PBKDF2 hashing with SHA-512 (100,000 iterations)
  - PIN required for removing Check Point TE API key or clearing any API keys
  - Secure storage in `.secure-storage/verification-pin.hash`

- **System Logging**
  - Server-side system logs for debugging and auditing
  - System Logs section in Dashboard with filtering by level and service
  - Detailed error logging for Check Point TE API failures
  - Request IDs for tracking API interactions

- **Security Hard Gates**
  - ESLint rule preventing `checkpoint-te` imports in client components
  - Automated security audit script (`scripts/check-security.sh`)
  - Build output scan for API key leakage
  - Release gate validation script (`scripts/release-gate.sh`)

- **Release Gate Automation**
  - Pre-deployment validation script with package manager detection
  - Comprehensive validation (lint, type-check, build, security scan)
  - Clear PASS/FAIL output with exit codes
  - Release documentation (`RELEASE.md`)

### Enhanced

- **ThreatCloud Proxy Hardening**
  - Request timeouts: 30s upload, 30s query, 60s polling
  - Capped retries with exponential backoff for transient failures
  - Response validation with schema checks
  - Bounded polling with safe "unknown/pending" fallback
  - User-friendly error messages (no stack traces to client)
  - File size limits: 50 MB enforced on frontend and backend
  - File type validation: `.pdf`, `.txt`, `.md`, `.json`, `.csv`, `.docx`

- **Error Handling**
  - Specific error messages for 400, 401, 403, 502, 504
  - Troubleshooting tips for common errors
  - Graceful degradation when ThreatCloud unavailable
  - Fail-safe behavior (app works fully without Check Point TE configured)

- **Stability & Performance**
  - Non-blocking UI (all operations async)
  - Resource-safe file handling (streams, memory-efficient)
  - Parallel uploads handled independently
  - Restart-safe configuration (persistent encrypted storage)
  - Event-loop safety (no blocking operations)

- **Backwards Compatibility**
  - New settings fields optional with safe defaults
  - Existing users continue to work without migrations
  - No breaking changes to file upload flow
  - Existing Lakera scanning continues to work

### Security

- **API Key Protection**
  - Check Point TE API keys stored server-side only (never in client)
  - Encrypted at rest using AES-256-CBC
  - Environment variable support (`CHECKPOINT_TE_API_KEY`)
  - API keys redacted in logs (only prefixes shown)
  - No API keys in localStorage/sessionStorage/client bundle

- **PIN Protection**
  - All API key clearing operations require PIN (when configured)
  - PIN protection for OpenAI, Lakera AI, Lakera Project ID, Lakera Endpoint, and Check Point TE keys
  - Timing-safe PIN verification (prevents timing attacks)

### Fixed

- Hydration error in ThemeToggleButton (server/client render mismatch)
- Form-data stream handling for Check Point TE uploads
- API base URL corrected to `https://te-api.checkpoint.com/tecloud/api/v1/file`
- Response validation for Check Point TE API responses
- TypeScript type errors in system logging interfaces

### Documentation

- Added `RELEASE.md` with release gate documentation
- Added `RELEASE_GATE_SUMMARY.md` with detailed validation summary
- Added `POST_CHANGE_VALIDATION_REPORT.md` with comprehensive validation report
- Added `FINAL_VALIDATION_CHECKLIST.md` with quick reference checklist
- Updated `README.md` with Release Gate section

---

## [0.1.0] - 2024-XX-XX

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-12-XX

### Added

- **UI Theme System**: Complete light/dark mode implementation with semantic color tokens
  - Dark mode: Navy blue backgrounds (#141C2C, #1D2839, #323C4E) with light text (#F0EDF4)
  - Light mode: Light gray/white backgrounds (#F6F7FB, #FFFFFF, #EEF1F7) with dark text (#0F172A)
  - Shared brand accents (#8E61F0, #4E4592) consistent across both modes
  - Safe CSS variable fallbacks to prevent rendering crashes
- **Production Hardening**:
  - React Error Boundary component for graceful error handling
  - General health endpoint (`/api/health`) for service monitoring
  - Automated validation scripts (`npm run check`, `npm run check:ci`)
  - Docker Compose configuration with restart policy and healthcheck
  - Dockerfile with multi-stage build and healthcheck support
  - systemd service file with auto-restart (Restart=always, RestartSec=5)
  - Kubernetes deployment manifest with liveness/readiness probes
- **Documentation**: Production hardening guide with restart verification steps

### Changed

- **UI Colors**: All hard-coded colors replaced with semantic theme tokens
  - Backgrounds, text, and borders now adapt to light/dark mode
  - Improved contrast and readability in both themes
- **Error Handling**: Centralized error boundary prevents full app crashes
- **Build Configuration**: Added standalone output mode for Docker deployments

### Security

- CSS variable fallbacks prevent missing token crashes
- Error boundary prevents sensitive error exposure in production

### Infrastructure

- Health check endpoint for Docker/systemd/Kubernetes monitoring
- Auto-restart policies for all deployment methods
- Production-ready Docker and Kubernetes configurations

## [0.1.0] - 2024-01-08

### Added

- Initial release of Secure AI Chat application
- Next.js 14 App Router implementation
- TypeScript support with full type safety
- Chat interface with OpenAI integration
- File upload and scanning with Lakera AI security
- Security dashboard with real-time monitoring
- Risk mapping and OWASP LLM Top 10 integration
- Settings page for API key configuration
- Dark/light theme support
- Comprehensive logging system
- Security headers configuration
- GitHub Actions CI/CD workflow
- Setup scripts for Unix/Linux/macOS and Windows
- Environment variable management with .env.example
- Prettier code formatting
- ESLint configuration
- Comprehensive documentation (README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT)
- GitHub issue and PR templates
- Dependabot configuration

### Security

- Prompt injection detection and blocking
- Input/output scanning with Lakera AI
- Security headers (HSTS, X-Frame-Options, etc.)
- Pre-scan validation for common attack patterns
- Threat level assessment (low, medium, high, critical)

### Documentation

- Installation and setup instructions
- Production build and deployment guide
- Troubleshooting section
- Environment variables documentation
- Contributing guidelines
- Security policy
- Code of conduct

[0.1.0]: https://github.com/your-username/Secure-Ai-Chat/releases/tag/v0.1.0
