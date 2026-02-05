# Troubleshooting Guide

## File Management Issues

### Issue: Files vanish when switching screens

**Symptoms:**
- Upload a file on `/files` page
- Navigate to another page (e.g., `/settings`, `/`)
- Return to `/files` page
- Files are gone

**Root Cause:**
The `/api/files/list` endpoint was returning the **full content** of all files (including large files like 20MB CSVs), causing:
- 40MB+ response sizes
- Timeouts or parse failures on the client
- Fallback to `localStorage` (which might be empty/stale)

**Fix Applied:**
- Modified `/api/files/list` to return **metadata only** (no content)
- Response size reduced from 40MB to ~1KB
- Content is now loaded on-demand when needed (e.g., for RAG in chat)

---

### Issue: RAG doesn't use uploaded files (Chat says no files available)

**Symptoms:**
- Files appear in the files list
- Chat doesn't use file content for answers
- Questions about file data get generic responses

**Root Cause:**
- **File size limit:** RAG skips files larger than 50MB (see `RAG_MAX_FILE_SIZE_BYTES` in `app/api/chat/route.ts`)
- **Scan status:** Files with `flagged` or `error` status are skipped for security
- **Orphaned metadata:** Metadata exists but `.dat` file is missing (see below)

**Fix:**
- Keep files under 50MB for RAG, or split large files
- Scan files to `safe` status (or leave as `pending`/`not_scanned`)
- Re-upload files if orphaned (list will auto-clean orphan metadata)

---

### Issue: Files show in UI but have no content / Chat can't access files

**Symptoms:**
- Files appear in the files list
- Chat says "no files available" or can't access file content
- Delete button doesn't work (returns "File not found")

**Root Cause:**
"Orphaned metadata" - metadata entries exist in `files-metadata.json` but the actual `.dat` files in `.storage/files/` are missing. This happens when:
- Files are deleted manually from `.storage/files/` directory
- "Clear All Files" button is used but fails partway through
- System crash or incomplete cleanup operation

**Fix Applied:**
- Added automatic orphan cleanup in `listFiles()` function
- When listing files, the system now:
  1. Checks if each file's `.dat` file actually exists
  2. Removes metadata entries for missing files
  3. Logs cleanup actions for debugging

**Manual Fix (if needed):**
```bash
# Delete the metadata file to force a clean state
rm .storage/files-metadata.json

# Or restore from backup
cp .storage/files-metadata.json.backup.TIMESTAMP .storage/files-metadata.json
```

---

### Issue: Delete button doesn't work

**Symptoms:**
- Click "Remove" button on a file
- API returns "File not found"
- File still appears in the list

**Root Cause:**
Either:
1. Orphaned metadata (see above)
2. Stale server cache (old build running)

**Fix:**
1. Rebuild and restart the server:
   ```bash
   npm run build
   npm run start
   ```
2. The orphan cleanup will automatically remove ghost files
3. Delete should work for real files

---

## Scan Errors

### Issue: "Failed to execute 'json' on 'Response': body stream already read"

**Symptoms:**
- Upload a file
- Click "Scan" button
- Error appears in scan result

**Root Cause:**
The client-side code was attempting to read the HTTP response body multiple times (e.g., calling `.json()` and then `.text()` on the same response), which is not allowed by the browser's Fetch API.

**Fix Applied:**
Modified `app/files/page.tsx` `handleFileScan` function to:
1. Read response body **once** with `await response.text()`
2. Conditionally parse as JSON if `Content-Type` indicates JSON
3. Handle errors gracefully

---

## Performance Issues

### Issue: Slow file list loading

**Symptoms:**
- Files page takes 10+ seconds to load
- Browser becomes unresponsive

**Root Cause:**
`/api/files/list` was returning full file content (see "Files vanish" issue above)

**Fix Applied:**
Metadata-only responses (see above)

---

## Data Integrity

### Issue: Files persist but metadata is lost

**Symptoms:**
- `.storage/files/` directory has `.dat` files
- `files-metadata.json` is empty or missing
- Files don't appear in UI

**Manual Fix:**
Unfortunately, if metadata is lost, file names and types are not recoverable from `.dat` files alone. You'll need to:
1. Delete the orphaned `.dat` files
2. Re-upload the files

**Prevention:**
- Regular backups of `.storage/` directory
- The system automatically creates backups at `.storage/files-metadata.json.backup.TIMESTAMP`

---

## Server Issues

### Issue: Changes not taking effect

**Symptoms:**
- Make code changes
- Refresh browser
- Changes don't appear

**Root Cause:**
Running production build (`npm run start`) serves pre-built files. Changes require rebuild.

**Fix:**
```bash
# For development (auto-reload)
npm run dev

# For production (requires rebuild after changes)
npm run build
npm run start
```

---

## Environment Issues

### Issue: Files not persisting across restarts

**Symptoms:**
- Upload files
- Restart server
- Files are gone

**Root Cause:**
`.storage/` directory permissions or location

**Fix:**
1. Check `.storage/` directory exists and is writable:
   ```bash
   ls -la .storage/
   # Should show drwx------ (700 or 755)
   ```

2. If using Docker or systemd, ensure `.storage/` is:
   - On a persistent volume (not tmpfs)
   - Has correct ownership and permissions

3. Check `STORAGE_DIR` environment variable:
   ```bash
   # Default: ./.storage
   # Custom: export STORAGE_DIR=/path/to/persistent/storage
   ```

---

## Debug Tips

### Check file storage state
```bash
# List metadata
cat .storage/files-metadata.json | jq '.files | keys'

# List actual files
ls -la .storage/files/

# Check for orphans
# If metadata has more entries than .dat files, you have orphans
```

### Check API responses
```bash
# List files
curl http://localhost:3000/api/files/list | jq '.'

# Delete a file
curl -X DELETE "http://localhost:3000/api/files/delete?fileId=FILE_ID"

# Health check
curl http://localhost:3000/api/health
```

### Enable debug logging
```bash
# Set in .env.local
DEBUG=true
LOG_LEVEL=debug
```

---

## Getting Help

If issues persist:
1. Check the server logs for errors
2. Check browser console for client-side errors
3. Verify `.storage/` directory permissions
4. Try clearing `.storage/` and re-uploading files
5. Check `docs/ARCHITECTURE_CURRENT.md` for system design
6. Review `docs/CHECKPOINT_WAF_INTEGRATION.md` if using WAF
