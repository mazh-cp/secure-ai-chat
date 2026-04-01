/**
 * Check Point ThreatCloud / Threat Emulation (TE) API utilities
 * This module handles server-side storage and retrieval of the TE API key
 *
 * Aligned with Check Point Threat Prevention API 1.0 (TPAPI) — file service:
 * - Access: POST https://<host>/tecloud/api/v1/file/upload | /query
 * - Global headers: Authorization (API key), optional te_cookie for session stickiness
 * - Query: one of md5 | sha1 | sha256; features includes "te"; te.images[] + te.reports[]
 * - Best practice: query by hash first, then upload if needed
 * @see https://sc1.checkpoint.com/documents/TPAPI/CP_1.0_ThreatPreventionAPI_APIRefGuide/124144.htm
 *
 * SECURITY: This module is SERVER-ONLY and must NEVER be imported in client components.
 * The ThreatCloud API key must NEVER reach the client.
 */

// Hard gate: Prevent client-side import
if (typeof window !== 'undefined') {
  throw new Error(
    'SECURITY VIOLATION: lib/checkpoint-te.ts is server-only and cannot be imported in client components. ' +
    'The ThreatCloud API key must never reach the client.'
  )
}

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

// Storage file path (in project root, but outside of .git)
const STORAGE_DIR = path.join(process.cwd(), '.secure-storage')
const KEY_FILE_PATH = path.join(STORAGE_DIR, 'checkpoint-te-key.enc')

// Encryption key (in production, use a secure key management service)
// For now, we'll use a simple approach with environment variable or generate one
const getEncryptionKey = (): Buffer => {
  const envKey = process.env.CHECKPOINT_TE_ENCRYPTION_KEY
  if (envKey) {
    // Use provided key (should be 32 bytes for AES-256)
    return crypto.createHash('sha256').update(envKey).digest()
  }
  
  // Use a default key based on a secret (not secure for production, but better than plaintext)
  // In production, this should be set via environment variable
  const defaultSecret = 'secure-ai-chat-checkpoint-te-storage-key-v1'
  return crypto.createHash('sha256').update(defaultSecret).digest()
}

// In-memory cache for the API key
let teApiKey: string | null = null
let keyLoaded = false

/**
 * Initialize storage directory if it doesn't exist
 */
async function ensureStorageDir(): Promise<void> {
  try {
    // Check if directory exists first
    try {
      const stats = await fs.stat(STORAGE_DIR)
      if (!stats.isDirectory()) {
        throw new Error(`Storage path exists but is not a directory: ${STORAGE_DIR}`)
      }
      // Directory exists - verify and fix permissions if needed
      const currentMode = stats.mode & 0o777
      if (currentMode !== 0o700) {
        console.warn(`Storage directory has incorrect permissions (${currentMode.toString(8)}), expected 700. Attempting to fix...`)
        try {
          await fs.chmod(STORAGE_DIR, 0o700)
          console.log(`Fixed storage directory permissions to 700`)
        } catch (chmodError) {
          console.warn(`Could not fix storage directory permissions: ${chmodError instanceof Error ? chmodError.message : String(chmodError)}`)
        }
      }
      return // Directory exists with correct permissions
    } catch (statError: unknown) {
      // Directory doesn't exist or can't be accessed - will create below
      if ((statError as { code?: string }).code !== 'ENOENT') {
        throw statError // Re-throw if it's not a "not found" error
      }
    }
    
    // Directory doesn't exist - create it
    await fs.mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 })
    
    // Verify directory was created and has correct permissions
    const stats = await fs.stat(STORAGE_DIR)
    if (!stats.isDirectory()) {
      throw new Error(`Storage directory exists but is not a directory: ${STORAGE_DIR}`)
    }
    
    const finalMode = stats.mode & 0o777
    if (finalMode !== 0o700) {
      // Try to fix permissions one more time
      await fs.chmod(STORAGE_DIR, 0o700)
    }
    
    console.log(`Storage directory created/verified: ${STORAGE_DIR} (permissions: 700)`)
  } catch (error) {
    console.error('Failed to create/verify storage directory:', error)
    // Provide more details about the error
    const errorMessage = error instanceof Error ? error.message : String(error)
    const cwd = process.cwd()
    throw new Error(`Cannot create/verify .secure-storage directory: ${errorMessage}. Check permissions and ensure app user can write to: ${cwd}`)
  }
}

/**
 * Encrypt API key before storing
 */
function encryptKey(key: string): string {
  try {
    const algorithm = 'aes-256-cbc'
    const encryptionKey = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv)
    
    let encrypted = cipher.update(key, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Prepend IV to encrypted data
    return iv.toString('hex') + ':' + encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    // Fallback to base64 encoding if encryption fails
    return Buffer.from(key).toString('base64')
  }
}

/**
 * Decrypt API key after loading
 */
function decryptKey(encryptedKey: string): string {
  try {
    // Check if it's in the new encrypted format (iv:encrypted) or old base64 format
    if (encryptedKey.includes(':')) {
      const [ivHex, encrypted] = encryptedKey.split(':')
      const algorithm = 'aes-256-cbc'
      const encryptionKey = getEncryptionKey()
      const iv = Buffer.from(ivHex, 'hex')
      
      const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } else {
      // Old base64 format (backward compatibility)
      return Buffer.from(encryptedKey, 'base64').toString('utf8')
    }
  } catch (error) {
    console.error('Decryption error:', error)
    // If decryption fails, try as plaintext (for migration)
    return encryptedKey
  }
}

/**
 * Load API key from persistent storage
 */
async function loadTeApiKey(): Promise<string | null> {
  // First check environment variable (highest priority)
  if (process.env.CHECKPOINT_TE_API_KEY) {
    const envKey = normalizeTeApiKeyInput(process.env.CHECKPOINT_TE_API_KEY)
    if (envKey) {
      teApiKey = envKey
      keyLoaded = true
      return envKey
    }
  }

  try {
    await ensureStorageDir()
    
    // Try to read from file
    try {
      const encryptedData = await fs.readFile(KEY_FILE_PATH, 'utf8')
      if (encryptedData.trim()) {
        const decryptedKey = decryptKey(encryptedData.trim())
        if (decryptedKey) {
          const k = normalizeTeApiKeyInput(decryptedKey)
          teApiKey = k
          keyLoaded = true
          return k
        }
      }
    } catch (fileError: unknown) {
      // File doesn't exist or can't be read - that's okay, key is just not configured
      if ((fileError as { code?: string }).code !== 'ENOENT') {
        console.error('Error reading TE API key file:', fileError)
      }
    }
  } catch (error) {
    console.error('Error loading TE API key:', error)
  }

  keyLoaded = true
  return null
}

/**
 * Save API key to persistent storage
 */
async function saveTeApiKey(key: string | null): Promise<void> {
  try {
    await ensureStorageDir()

    if (key) {
      const encryptedKey = encryptKey(key)
      
      // Write with restrictive permissions (owner read/write only)
      try {
        // Ensure directory exists and has correct permissions before writing
        await ensureStorageDir()
        
        // Write the file
        await fs.writeFile(KEY_FILE_PATH, encryptedKey, { mode: 0o600, flag: 'w' })
        
        // Force file system sync to ensure write completes before verification
        // Open file descriptor and sync to ensure data is written to disk
        try {
          const fd = await fs.open(KEY_FILE_PATH, 'r+')
          try {
            await fd.sync()
          } finally {
            await fd.close()
          }
        } catch (syncError) {
          // Sync failure is not critical - file write may have already completed
          console.warn(`File sync warning (non-critical): ${syncError instanceof Error ? syncError.message : String(syncError)}`)
        }
        
        // Verify file was written and has correct permissions
        const stats = await fs.stat(KEY_FILE_PATH)
        if (!stats.isFile()) {
          throw new Error(`Key file was not created as a file: ${KEY_FILE_PATH}`)
        }
        if (stats.size === 0) {
          throw new Error(`Key file is empty after write: ${KEY_FILE_PATH}`)
        }
        
        // Verify permissions
        const fileMode = stats.mode & 0o777
        if (fileMode !== 0o600) {
          console.warn(`Key file has incorrect permissions (${fileMode.toString(8)}), expected 600. Fixing...`)
          await fs.chmod(KEY_FILE_PATH, 0o600)
        }
        
        console.log(`Check Point TE API key file saved: ${KEY_FILE_PATH} (${stats.size} bytes, permissions: 600)`)
        
        // Update cache after successful write verification
        teApiKey = key
        keyLoaded = true
      } catch (writeError) {
        const errorDetails = writeError instanceof Error ? writeError.message : String(writeError)
        const errorCode = (writeError as { code?: string }).code || 'UNKNOWN'
        console.error(`Failed to write TE API key file to ${KEY_FILE_PATH}:`, errorDetails)
        
        // Check directory status
        let dirInfo = 'unknown'
        try {
          const dirStats = await fs.stat(STORAGE_DIR)
          const dirMode = dirStats.mode & 0o777
          dirInfo = `exists, mode: ${dirMode.toString(8)} (expected: 700)`
        } catch {
          dirInfo = 'does not exist or not accessible'
        }
        
        console.error(`Storage directory: ${STORAGE_DIR}, status: ${dirInfo}`)
        console.error(`Error code: ${errorCode}`)
        
        throw new Error(`Cannot save Check Point TE API key: ${errorDetails} (code: ${errorCode}). Check directory permissions for: ${STORAGE_DIR}. Directory status: ${dirInfo}`)
      }
    } else {
      // Remove key file if key is null
      try {
        await fs.unlink(KEY_FILE_PATH)
      } catch (unlinkError: unknown) {
        // File doesn't exist, that's fine
        if ((unlinkError as { code?: string }).code !== 'ENOENT') {
          throw unlinkError
        }
      }
      // Clear in-memory cache
      teApiKey = null
      keyLoaded = true // Mark as loaded so we know it's intentionally null
    }
  } catch (error) {
    console.error('Error saving TE API key:', error)
    // Invalidate cache on error
    teApiKey = null
    keyLoaded = false
    throw error
  }
}

/**
 * Force reload API key from storage (clears cache and re-reads)
 * Useful after saving to ensure fresh state
 */
export async function reloadTeApiKey(): Promise<void> {
  teApiKey = null
  keyLoaded = false
  await loadTeApiKey()
}

// Initialize: Load key on module load (for server-side)
// Use a promise to ensure key is loaded before use
// Initialize: Load key on module load (for server-side)
if (typeof window === 'undefined') {
  // Load key asynchronously on initialization (non-blocking)
  loadTeApiKey()
    .then(() => {
      console.log('Check Point TE API key loaded from persistent storage')
    })
    .catch(error => {
      console.error('Failed to load TE API key on initialization:', error)
    })
}

/**
 * Get the stored Check Point TE API key
 * This should only be called from server-side code, never exposed to client
 */
export async function getTeApiKey(): Promise<string | null> {
  if (!keyLoaded) {
    return await loadTeApiKey()
  }
  return teApiKey
}

/**
 * Get the stored Check Point TE API key (synchronous version for compatibility)
 * Note: This returns the cached value or tries to load synchronously if not loaded.
 * For fresh loads, use async version. This will attempt a quick sync load if not already loaded.
 */
export function getTeApiKeySync(): string | null {
  // Return cached value if available
  if (teApiKey) {
    return teApiKey
  }
  
  // Check environment variable (highest priority, always available)
  if (process.env.CHECKPOINT_TE_API_KEY) {
    const envKey = normalizeTeApiKeyInput(process.env.CHECKPOINT_TE_API_KEY)
    if (envKey) {
      teApiKey = envKey
      keyLoaded = true
      return envKey
    }
  }
  
  // If not loaded yet and we're in Node.js, try synchronous file read as fallback
  // This ensures the key is available even if async initialization hasn't completed
  if (!keyLoaded && typeof window === 'undefined') {
    try {
      const fsSync = require('fs')
      const pathSync = require('path')
      const storageDir = pathSync.join(process.cwd(), '.secure-storage')
      const keyFilePath = pathSync.join(storageDir, 'checkpoint-te-key.enc')
      
      if (fsSync.existsSync(keyFilePath)) {
        try {
          const encryptedData = fsSync.readFileSync(keyFilePath, 'utf8')
          if (encryptedData && encryptedData.trim()) {
            const decryptedKey = decryptKey(encryptedData.trim())
            if (decryptedKey) {
              const k = normalizeTeApiKeyInput(decryptedKey)
              teApiKey = k
              keyLoaded = true
              return k
            }
          }
        } catch (readError) {
          console.error('Failed to read TE API key file synchronously:', readError)
        }
      }
    } catch (syncError) {
      // Silently fail - will rely on async loading or environment variable
      console.error('Synchronous key load failed:', syncError)
    }
  }
  
  // Key not available yet
  return null
}

/**
 * Set the Check Point TE API key (persists to disk)
 * Clears cache to ensure fresh data on next access
 */
export async function setTeApiKey(key: string | null): Promise<void> {
  const toSave = key === null ? null : normalizeTeApiKeyInput(key)
  await saveTeApiKey(toSave)
  // Cache is already updated in saveTeApiKey, but ensure it's marked as loaded
  // This ensures that getTeApiKey() will return the correct value (null if deleted)
}

/**
 * Check if the API key is configured
 */
export async function isTeApiKeyConfigured(): Promise<boolean> {
  const key = await getTeApiKey()
  return !!key
}

/**
 * Check if the API key is configured (synchronous version)
 */
export function isTeApiKeyConfiguredSync(): boolean {
  return !!getTeApiKeySync()
}

/**
 * Default TE Cloud file API base (global / te-api host — same as v1.0.17-era releases and CHANGELOG).
 * Set CHECKPOINT_TECLOUD_BASE_URL to https://te-na.checkpoint.com/tecloud/api/v1/file if your Infinity tenant requires North America only.
 * @see https://support.checkpoint.com/results/sk/sk114806
 */
export const TE_API_BASE_URL = 'https://te-api.checkpoint.com/tecloud/api/v1/file'

/**
 * Strip accidental path suffixes and whitespace from CHECKPOINT_TECLOUD_BASE_URL.
 * Upload/query routes append `/upload` and `/query` themselves.
 */
export function normalizeTeCloudBaseUrl(raw: string): string {
  let u = raw.trim().replace(/[\r\n\t]/g, '')
  u = u.replace(/\/+$/, '')
  if (u.endsWith('/upload')) u = u.slice(0, -'/upload'.length).replace(/\/+$/, '')
  if (u.endsWith('/query')) u = u.slice(0, -'/query'.length).replace(/\/+$/, '')
  return u
}

/** Remove newlines/tabs often pasted from PDFs; strip duplicate TE_API_KEY_ prefix. */
export function normalizeTeApiKeyInput(key: string): string {
  let k = key.replace(/[\r\n\t]/g, '').trim()
  while (k.startsWith('TE_API_KEY_')) {
    k = k.slice('TE_API_KEY_'.length).trim()
  }
  return k
}

/**
 * Get TE Cloud base URL from environment or use default
 * Supports regional / global hosts (must match where your Infinity key was issued):
 * - https://te-api.checkpoint.com/tecloud/api/v1/file — default (global)
 * - https://te-na.checkpoint.com/tecloud/api/v1/file — North America
 * - https://te.checkpoint.com/tecloud/api/v1/file — alternate global
 */
export function getTeApiBaseUrl(): string {
  const fromEnv = process.env.CHECKPOINT_TECLOUD_BASE_URL
  if (fromEnv?.trim()) {
    return normalizeTeCloudBaseUrl(fromEnv)
  }
  return normalizeTeCloudBaseUrl(TE_API_BASE_URL)
}

/** Documented / common TE Cloud file API bases — 403 on one host often succeeds on another until CHECKPOINT_TECLOUD_BASE_URL is set. */
export const TE_CLOUD_KNOWN_FILE_BASES = [
  'https://te-api.checkpoint.com/tecloud/api/v1/file',
  'https://te.checkpoint.com/tecloud/api/v1/file',
  'https://te-na.checkpoint.com/tecloud/api/v1/file',
] as const

/** Bases to try for upload when `CHECKPOINT_TECLOUD_BASE_URL` is unset (deduped, primary first). */
export function getTeUploadCandidateBases(): string[] {
  const primary = getTeApiBaseUrl()
  if (process.env.CHECKPOINT_TECLOUD_BASE_URL?.trim()) {
    return [primary]
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const b of [primary, ...TE_CLOUD_KNOWN_FILE_BASES]) {
    const n = normalizeTeCloudBaseUrl(b)
    if (!seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

/** Accept only configured or known TE file bases (prevents SSRF via client-supplied `teApiBase`). */
export function isAllowedTeFileBaseUrl(candidate: string | undefined): boolean {
  if (!candidate?.trim()) return false
  const n = normalizeTeCloudBaseUrl(candidate)
  return getTeUploadCandidateBases().includes(n)
}

/** How the app submits files to Check Point TE (server env `CHECKPOINT_TE_HASH_LOOKUP_ONLY`). */
export type TeSubmitStrategy = 'auto' | 'hash_only' | 'upload_only'

/**
 * - `true` / `1` / `yes` / `on` → hash_only (never upload file bytes).
 * - `false` / `0` / `no` / `upload_only` → upload_only (always upload; legacy behavior).
 * - unset → auto (query by SHA-256 first; upload only if no definitive verdict).
 */
export function getTeSubmitStrategy(): TeSubmitStrategy {
  const v = process.env.CHECKPOINT_TE_HASH_LOOKUP_ONLY?.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return 'hash_only'
  if (v === '0' || v === 'false' || v === 'no' || v === 'upload_only') return 'upload_only'
  return 'auto'
}

/**
 * When true (env `CHECKPOINT_TE_HASH_LOOKUP_ONLY=true`), TE never receives file bytes — only SHA-256 is sent via the query API.
 * Verdicts apply only if Check Point Threat Cloud already has that hash (no new-file sandboxing).
 */
export function isTeHashLookupOnlyMode(): boolean {
  return getTeSubmitStrategy() === 'hash_only'
}

/**
 * Get OS image ID from environment
 */
export function getTeImageId(): string | null {
  return process.env.CHECKPOINT_TECLOUD_IMAGE_ID?.trim() || null
}

/**
 * Get OS image revision from environment
 */
export function getTeImageRevision(): number {
  const rev = process.env.CHECKPOINT_TECLOUD_IMAGE_REVISION
  return rev ? parseInt(rev, 10) : 1
}

/**
 * Build TE upload request payload (correct format)
 */
/** Default TE reports: TPAPI notes PDF is not available in the new TE report format; avoid pdf+summary together. */
export function getDefaultTeReports(): string[] {
  const raw = process.env.CHECKPOINT_TECLOUD_TE_REPORTS?.trim()
  if (raw) {
    return raw.split(/[\s,]+/).filter(Boolean)
  }
  return ['xml']
}

export function buildTeUploadRequest(options: {
  reports?: string[]
  imageId?: string
  revision?: number
}): { request: Array<{ features: string[], te: { reports?: string[], images?: Array<{ id: string, revision: number }> } }> } {
  const { reports = getDefaultTeReports(), imageId, revision } = options
  
  const imageIdToUse = imageId || getTeImageId()
  const revisionToUse = revision || getTeImageRevision()
  
  const requestItem: {
    features: string[]
    te: {
      reports?: string[]
      images?: Array<{ id: string, revision: number }>
    }
  } = {
    features: ['te'],
    te: {
      reports,
    },
  }
  
  // Only include images if imageId is provided
  if (imageIdToUse) {
    requestItem.te.images = [{ id: imageIdToUse, revision: revisionToUse }]
  }
  
  return { request: [requestItem] }
}

/**
 * Build TE query request payload (TPAPI: `request` wrapper; `te.images` array, optional `te.reports`).
 */
export function buildTeQueryRequest(options: {
  sha256?: string
  sha1?: string
  md5?: string
  features?: string[]
  imageId?: string
  revision?: number
  reports?: string[]
}): {
  request: {
    sha256?: string
    sha1?: string
    md5?: string
    features: string[]
    te?: { images?: Array<{ id: string; revision: number }>; reports?: string[] }
  }
} {
  const { sha256, sha1, md5, features = ['te'], imageId, revision, reports } = options

  const imageIdToUse = imageId || getTeImageId()
  const revisionToUse = revision || getTeImageRevision()

  const requestBody: {
    sha256?: string
    sha1?: string
    md5?: string
    features: string[]
    te?: { images?: Array<{ id: string; revision: number }>; reports?: string[] }
  } = {
    features,
  }

  if (sha256) requestBody.sha256 = sha256
  if (sha1) requestBody.sha1 = sha1
  if (md5) requestBody.md5 = md5

  const teReports = reports ?? getDefaultTeReports()
  if (imageIdToUse) {
    requestBody.te = {
      images: [{ id: imageIdToUse, revision: revisionToUse }],
      reports: teReports.length ? teReports : undefined,
    }
  } else if (teReports.length) {
    requestBody.te = { reports: teReports }
  }

  return { request: requestBody }
}

/**
 * TPAPI Global Request Headers: `Authorization` = valid API key (example in guide is raw key, no Bearer).
 * Some Threat Cloud deployments expect `TE_API_KEY_<key>` instead — use legacy mode if you get 401 with raw.
 *
 * CHECKPOINT_TE_AUTH_FORMAT:
 * - `raw` | `tpapi` — value is the API key only (Threat Prevention API 1.0 Reference Guide)
 * - `te_api_key` — value is `TE_API_KEY_<key>` (common SandBlast / file API variant)
 * - unset — defaults to `te_api_key` for backward compatibility with existing installs
 */
/** Effective Authorization style (for diagnostics /api/te/config). */
export function getTeAuthFormatMode(): 'raw' | 'te_api_key' {
  const mode = process.env.CHECKPOINT_TE_AUTH_FORMAT?.trim().toLowerCase()
  if (mode === 'raw' || mode === 'tpapi') return 'raw'
  if (mode === 'te_api_key') return 'te_api_key'
  return 'te_api_key'
}

export function getTeAuthorizationValue(apiKey: string): string {
  const cleanKey = normalizeTeApiKeyInput(apiKey)
  if (getTeAuthFormatMode() === 'raw') {
    return cleanKey
  }
  return `TE_API_KEY_${cleanKey}`
}

/** @deprecated Use getTeAuthorizationValue — name kept for call sites (returns Authorization header value only). */
export function createTeAuthHeader(apiKey: string): string {
  return getTeAuthorizationValue(apiKey)
}

/** Per-TPAPI-base sticky token from Set-Cookie / te_cookie (same server for upload → query). */
const teStickyCookieByBase = new Map<string, string>()

function stickyKeyForBase(base: string): string {
  return normalizeTeCloudBaseUrl(base)
}

export function getTeStickyCookieHeaderForBase(teBase: string): string | undefined {
  return teStickyCookieByBase.get(stickyKeyForBase(teBase))
}

/**
 * Capture te_cookie stickiness from TPAPI responses (Global Request Headers).
 * Sends `te_cookie: <value>` on later requests to the same base URL.
 */
export function captureTeStickyFromResponse(teBase: string, response: Response): void {
  const key = stickyKeyForBase(teBase)
  const direct =
    response.headers.get('te-cookie') ??
    response.headers.get('Te-Cookie') ??
    response.headers.get('TE-Cookie')
  if (direct?.trim()) {
    teStickyCookieByBase.set(key, direct.trim())
    return
  }
  const getSetCookie = (response.headers as { getSetCookie?: () => string[] }).getSetCookie
  const lines: string[] =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(response.headers)
      : response.headers.get('set-cookie')
        ? [response.headers.get('set-cookie')!]
        : []
  for (const line of lines) {
    if (!line || typeof line !== 'string') continue
    const first = line.split(';')[0]?.trim()
    if (!first?.includes('=')) continue
    const [name, ...rest] = first.split('=')
    const val = rest.join('=').trim()
    if (!name || !val) continue
    if (/te/i.test(name) || /session/i.test(name) || /stick/i.test(name)) {
      teStickyCookieByBase.set(key, first)
      return
    }
  }
  if (lines.length > 0) {
    const first = lines[0].split(';')[0]?.trim()
    if (first?.includes('=')) teStickyCookieByBase.set(key, first)
  }
}

export function buildTeFetchHeaders(
  apiKey: string,
  teBase: string,
  extra?: Record<string, string>
): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: getTeAuthorizationValue(apiKey),
    ...extra,
  }
  const sticky = getTeStickyCookieHeaderForBase(teBase)
  if (sticky) h['te_cookie'] = sticky
  return h
}

/** Concise steps for TE Cloud 403 (IP allowlist / regional URL). Shown after a one-line `error` in the API response. */
export function getTeCloud403Troubleshooting(): string {
  return [
    'Wrong keys usually return 401 — 403 is almost always policy or region.',
    'This app retries te-api → te.checkpoint → te-na automatically when CHECKPOINT_TECLOUD_BASE_URL is not set. If all three return 403, the block is account/IP side.',
    '1) Allowlist the public outbound IP of the machine running this app (not your browser). Open /api/te/diagnostic on that server for a suggested IP.',
    '2) Set CHECKPOINT_TECLOUD_BASE_URL on the server to the host Check Point assigned (path must end with …/file).',
    '3) Confirm the key is a TE Cloud file-upload API key with upload rights for your account.',
    '4) If you get 401: Threat Prevention API 1.0 uses raw key in Authorization by setting CHECKPOINT_TE_AUTH_FORMAT=raw; default here is te_api_key (TE_API_KEY_ prefix) for compatibility.',
  ].join('\n')
}

export function getTeEndpointDiagnostics(): {
  teBaseUrl: string
  uploadUrl: string
  queryUrl: string
  defaultBaseUrl: string
  envOverrideSet: boolean
} {
  const base = getTeApiBaseUrl()
  return {
    teBaseUrl: base,
    uploadUrl: `${base}/upload`,
    queryUrl: `${base}/query`,
    defaultBaseUrl: normalizeTeCloudBaseUrl(TE_API_BASE_URL),
    envOverrideSet: Boolean(process.env.CHECKPOINT_TECLOUD_BASE_URL?.trim()),
  }
}
