# Check Point TE Cloud Integration - Audit Report

## Step A: Current State Inventory

### File Upload & Storage Infrastructure

| Component/Route | Purpose | Sync/Async | Security Checks | Current Implementation |
|----------------|---------|------------|-----------------|----------------------|
| `POST /api/files/store` | Store file on server | Sync | File size validation (50MB) | Stores to `.storage/files/` via `persistent-storage.ts` |
| `GET /api/files/list` | List stored files | Sync | None | Reads from `.storage/files-metadata.json` |
| `DELETE /api/files/delete` | Delete file | Sync | None | Removes file and metadata |
| `lib/persistent-storage.ts` | File storage abstraction | Sync | None | JSON metadata + disk storage |

### Check Point TE Integration (Existing)

| Component/Route | Purpose | Sync/Async | Security Checks | Current Implementation |
|----------------|---------|------------|-----------------|----------------------|
| `POST /api/te/upload` | Upload file to TE API | Sync (blocking) | API key validation, file size | Direct upload via multipart form-data |
| `POST /api/te/query` | Query file hash in TE | Sync (blocking) | API key validation | Queries by SHA256/SHA1/MD5 |
| `GET /api/te/config` | Check TE configuration | Sync | None | Returns API key status |
| `lib/checkpoint-te.ts` | TE API utilities | Sync | Encrypted key storage | Key management, auth header creation |
| `TE_API_BASE_URL` | API endpoint | - | - | `https://te-api.checkpoint.com/tecloud/api/v1/file` |

### Content Scanning (Lakera)

| Component/Route | Purpose | Sync/Async | Security Checks | Current Implementation |
|----------------|---------|------------|-----------------|----------------------|
| `POST /api/scan` | Scan content with Lakera | Sync (blocking) | API key validation | Content scanning for prompt injection |
| `lib/lakera-telemetry.ts` | Lakera integration | Sync | None | Telemetry and scanning utilities |

### Current Upload Flow (from `app/files/page.tsx`)

```
1. User uploads file → FileUploader component
2. File stored locally (base64/text) → UploadedFile object
3. POST /api/files/store → Server stores file on disk
4. Check Point TE Scan (if enabled):
   - handleCheckpointTeSandbox() called via setTimeout (300ms delay)
   - Creates FormData from file content
   - POST /api/te/upload → Direct upload to TE API
   - Then POST /api/te/query → Query by hash (waits for response)
   - Updates file status based on verdict
5. Lakera Scan (if enabled):
   - handleFileScan() called
   - POST /api/scan → Content scanning
   - Updates file status
6. RAG/Embedding (if scans pass)
```

### Key Findings

**✅ What Exists:**
- File storage infrastructure (disk-based, JSON metadata)
- Check Point TE API integration (upload, query endpoints)
- API key management (encrypted server-side storage)
- File upload UI with scan status tracking
- Scan status states: `pending`, `scanning`, `safe`, `flagged`, `error`, `not_scanned`

**❌ Gaps vs Requirements:**
1. **No hash-first approach**: Current flow uploads file directly, doesn't query hash first
2. **No polling mechanism**: Query happens once, doesn't poll for PENDING status
3. **No exponential backoff**: Polling strategy not implemented
4. **No quota handling**: Quota endpoint not checked
5. **Synchronous blocking**: Upload/query blocks the request
6. **No normalized response format**: Different response formats across endpoints
7. **No structured error mapping**: Errors not categorized (timeout, quota, 4xx/5xx)
8. **File hashes not computed**: SHA256/SHA1 computed by TE API, not locally
9. **No status endpoint**: No `/api/files/scan-status` endpoint for polling
10. **Mixed sync/async**: Uses setTimeout for async but no proper job queue

### Environment Variables Pattern

Current pattern:
- `CHECKPOINT_TE_API_KEY` - Stored in env or `.secure-storage/checkpoint-te-key.enc`
- Keys loaded via `lib/checkpoint-te.ts` (encrypted storage)
- Keys never exposed to browser (server-side only) ✅

### Background Jobs/Queue

**None found.** Current approach uses:
- `setTimeout` for delayed execution
- Synchronous API calls
- No job queue system
- No background worker

### Storage Pattern

- Files: `.storage/files/{fileId}`
- Metadata: `.storage/files-metadata.json` (single JSON file)
- Metadata structure: `{ [fileId]: { name, type, size, scanStatus, scanDetails, checkpointTeDetails, ... } }`

---

## Step B: Requirements Baseline

### Required Flow

```
1. Upload file → Store on server
2. Compute hashes (SHA256, SHA1) locally
3. Query-first: POST /file/query with hash
   - If FOUND → Return verdict + report IDs (skip upload)
   - If NOT_FOUND → Upload file
   - If PENDING → Poll with exponential backoff until terminal state
4. Upload (if needed): POST /file/upload multipart
5. Poll verdict (if PENDING): Query with backoff until FOUND/PARTIALLY_FOUND or timeout
6. Handle quota: Check /file/quota when receiving quota errors
7. Normalize response: Single format across all operations
```

### Required Response Format

```typescript
{
  status: "clean" | "malicious" | "unknown" | "error" | "pending" | "rate_limited",
  vendor: "checkpoint-tecloud",
  hash: { sha1: string, sha256: string },
  verdict_raw?: object,
  report_ids?: string[],
  timings: { startedAt: number, finishedAt?: number, durationMs?: number },
  error?: { code: string, message: string }
}
```

### Required Behaviors

1. **Hash computation**: SHA256 (preferred), SHA1 (minimum) at upload time
2. **Query-first**: Always query hash before uploading
3. **Polling**: Exponential backoff with jitter, max attempts, timeout
4. **Quota**: Check `/file/quota` endpoint, return `rate_limited` status
5. **Non-blocking**: Upload request returns quickly, status polled separately
6. **Error mapping**: Categorize errors (timeout, quota, 4xx, 5xx)
7. **Status endpoint**: `/api/files/scan-status?fileId=...` for polling

---

## Step C: Integration Point Decision

**Chosen: Option 1 (Preferred) - Async Scan with Job ID**

### Rationale

1. **Minimal changes to existing code**: Can reuse `/api/files/store` route
2. **No queue infrastructure needed**: Use in-memory scan state in metadata file
3. **Compatible with current UI**: UI already polls scan status via file state
4. **Server-side only**: All TE operations stay server-side ✅
5. **Backward compatible**: Existing sync flow can coexist

### Implementation Approach

1. **Add TE Cloud service module**: `lib/checkpoint-tecloud.ts` (new, modular)
2. **Enhance `/api/files/store`**: After storing file, kick off async TE scan
3. **Add `/api/files/scan-status`**: New endpoint for polling scan status
4. **Update file metadata**: Store scan state in existing metadata file
5. **Preserve existing routes**: Keep `/api/te/upload` and `/api/te/query` for backward compatibility

### Benefits

- ✅ Non-breaking: Existing code continues to work
- ✅ Modular: New service isolated, easy to test
- ✅ Server-side only: API key never exposed
- ✅ Scalable: Can migrate to queue later if needed
- ✅ UI-compatible: Status polling already supported

---

## Implementation Plan

### Files to Create

1. `lib/checkpoint-tecloud.ts` - New TE Cloud service module
2. `app/api/files/scan-status/route.ts` - Status polling endpoint
3. Tests (TBD based on test infrastructure)

### Files to Modify

1. `app/api/files/store/route.ts` - Add async TE scan trigger
2. `lib/persistent-storage.ts` - Add scan state management (if needed)
3. `.env.example` - Add new env vars documentation

### Files NOT to Modify

- `app/api/te/upload/route.ts` - Keep for backward compatibility
- `app/api/te/query/route.ts` - Keep for backward compatibility
- `app/files/page.tsx` - UI already supports status polling
- `lib/checkpoint-te.ts` - Reuse existing key management

---

## Next Steps

1. Implement `lib/checkpoint-tecloud.ts` service module
2. Enhance `/api/files/store` to trigger async scan
3. Add `/api/files/scan-status` endpoint
4. Add tests
5. Update documentation
6. Provide verification curls
