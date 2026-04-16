# Root cause candidates: v1.0.13 file upload blank screen

## Version diff (v1.0.11 → v1.0.13)

### Key changes

| Area               | v1.0.11                                                    | v1.0.13                                                                                                                               |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Store API**      | `storeFile()` from persistent-storage (single abstraction) | `getOwnerId(request)` + `writeOwnerFile()` + `insertFile()` (registry + disk); runtime `nodejs`; JSON body only                       |
| **Request format** | JSON body (fileId, fileName, fileContent, etc.)            | Same JSON body; added content-length check (55 MB), file type allowlist                                                               |
| **Owner scoping**  | Not explicit in store route                                | `ownerId` from cookie/header via `getOwnerId(request)`; writes to `data/uploads/<ownerId>/<fileId>`                                   |
| **List API**       | Likely same                                                | Uses `getOwnerId(request)` and `listFiles({ owner_id })`; reads from registry + disk                                                  |
| **Frontend list**  | `fetch('/api/files/list')` no special headers              | `ownerHeaders()` (X-Client-ID) sent; `loadFilesFromServer` returns list or null; refetch does not overwrite with [] when server empty |
| **Frontend store** | Store then update UI                                       | Same; added `storeError` state and banner; `response.json().catch(() => ({}))` on error path                                          |
| **Error handling** | Store returns JSON errors                                  | Same; top-level try/catch returns `{ error: string }` 500                                                                             |

## Root cause candidates

1. **Non-JSON response from API**  
   If the store or list route returns HTML (e.g. Next.js 500 error page) due to an uncaught exception (e.g. `getOwnerId`/`cookies()` in wrong context, or write failure before try/catch), the client’s `response.json()` throws → unhandled rejection or render path crash → blank screen.

2. **Missing or wrong ownerId**  
   If `getOwnerId(request)` throws (e.g. `cookies()` not available in route context) or returns inconsistent id between store and list, list returns [] and UI/refetch logic can expose edge cases.

3. **Write path / permissions**  
   On production VM, `data/uploads` may be missing or not writable (e.g. systemd `ReadWritePaths` without `data/`). Store then returns 500 with JSON; if that 500 were ever returned as HTML, client would crash on `.json()`.

4. **Uncaught throw in upload flow**  
   In `handleCheckpointTeSandbox` or `handleFileScan`, `uploadResponse.json()` or `queryResponse.json()` can throw if the response is not JSON; those are inside try/catch that rethrow. If the error boundary does not catch, React can show blank screen.

5. **loadFilesFromServer**  
   Line 73: `const data = await response.json()` — if server returns HTML, this throws. The function is in try/catch and returns null, so it should not crash the tree unless the caller does something that throws during render with the null result.

## Fix strategy

- **C)** Add `safeFetchJson()` and use it for all file/store/list (and scan) fetches; never assume response is JSON; show user-visible error instead of crashing.
- **C)** Add an error boundary around the Files page (or file upload UI) so any render error shows a fallback instead of a blank screen.
- **D)** Ensure store route always returns JSON (including on 500) with a consistent shape (e.g. `{ ok: true, file?: {...} }` or `{ ok: false, error: { code, message, details? } }`).
- **D)** Ensure `data/uploads` is created if missing and that production has write access (document ReadWritePaths).

## Fix summary (v1.0.14)

- **Frontend**: Introduced `lib/safe-fetch.ts` — `safeFetchJson(url, opts)` never throws; returns `{ ok, status, data?, error? }`. If the response is not JSON (e.g. HTML 500), it returns `ok: false` and a structured `error` so the UI never calls `.json()` on HTML. All file-related fetches in `app/files/page.tsx` (list, store, clear, updateFileMetadataOnServer) now use `safeFetchJson`. Errors are shown via the existing `storeError` / `serverSyncWarning` banners.
- **Error boundary**: The Files page content is wrapped in `<ErrorBoundary>` with a Files-specific fallback (message + Reload button) so any remaining render error does not blank the screen.
- **API**: Store route already returned JSON for all paths; list route’s catch block now returns `{ ok: false, error: { code: 'LIST_FAILED', message, details: null } }` for consistency.
- **Regression**: `scripts/smoke-upload.sh` checks that POST /api/files/store and GET /api/files/list return JSON (not HTML) and that the uploaded file appears in the list.
- **Release**: Version set to 1.0.14; CHANGELOG updated; v1.0.12 “Added” cleanup (last 5 lines removed) applied. Deploy via existing curl/upgrade script; README documents `--ref v1.0.14` for in-place upgrade.
