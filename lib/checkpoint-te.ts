/**
 * Check Point ThreatCloud / Threat Emulation (TE) API utilities
 * This module handles server-side storage and retrieval of the TE API key
 */

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
    await fs.mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 }) // Only owner can read/write/execute
  } catch (error) {
    console.error('Failed to create storage directory:', error)
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
    const envKey = process.env.CHECKPOINT_TE_API_KEY.trim()
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
        teApiKey = decryptedKey
        keyLoaded = true
        return decryptedKey
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
      await fs.writeFile(KEY_FILE_PATH, encryptedKey, { mode: 0o600, flag: 'w' })
      teApiKey = key
      keyLoaded = true
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
    const envKey = process.env.CHECKPOINT_TE_API_KEY.trim()
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
              teApiKey = decryptedKey
              keyLoaded = true
              return decryptedKey
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
  await saveTeApiKey(key)
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
 * Check Point TE API endpoints
 * Base URL: https://te-na.checkpoint.com/tecloud/api/v1/file (USA region)
 * Can be overridden via CHECKPOINT_TECLOUD_BASE_URL environment variable
 * Reference: https://support.checkpoint.com/results/sk/sk114806
 */
export const TE_API_BASE_URL = 'https://te-na.checkpoint.com/tecloud/api/v1/file'

/**
 * Get TE Cloud base URL from environment or use default
 * Supports regional endpoints:
 * - te-na.checkpoint.com (North America / USA)
 * - te-api.checkpoint.com (Global / default fallback)
 */
export function getTeApiBaseUrl(): string {
  return process.env.CHECKPOINT_TECLOUD_BASE_URL || TE_API_BASE_URL
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
export function buildTeUploadRequest(options: {
  reports?: string[]
  imageId?: string
  revision?: number
}): { request: Array<{ features: string[], te: { reports?: string[], images?: Array<{ id: string, revision: number }> } }> } {
  const { reports = ['pdf', 'xml'], imageId, revision } = options
  
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
 * Build TE query request payload (correct format with request wrapper)
 */
export function buildTeQueryRequest(options: {
  sha256?: string
  sha1?: string
  md5?: string
  features?: string[]
  imageId?: string
  revision?: number
}): { request: { sha256?: string, sha1?: string, md5?: string, features: string[], te?: { image: { id: string, revision: number } } } } {
  const { sha256, sha1, md5, features = ['te'], imageId, revision } = options
  
  const imageIdToUse = imageId || getTeImageId()
  const revisionToUse = revision || getTeImageRevision()
  
  const requestBody: {
    sha256?: string
    sha1?: string
    md5?: string
    features: string[]
    te?: { image: { id: string, revision: number } }
  } = {
    features,
  }
  
  if (sha256) requestBody.sha256 = sha256
  if (sha1) requestBody.sha1 = sha1
  if (md5) requestBody.md5 = md5
  
  if (imageIdToUse) {
    requestBody.te = {
      image: {
        id: imageIdToUse,
        revision: revisionToUse,
      },
    }
  }
  
  return { request: requestBody }
}

/**
 * Create Authorization header for Check Point TE API
 * Format: TE_API_KEY_<key> (no spaces, key should be trimmed)
 * Note: Some Check Point TE Cloud APIs might accept just the key, but standard format includes prefix
 */
export function createTeAuthHeader(apiKey: string): string {
  // Trim any whitespace from the API key
  const trimmedKey = apiKey.trim()
  
  // Remove any existing prefix if present (to avoid double prefixing)
  const cleanKey = trimmedKey.startsWith('TE_API_KEY_') 
    ? trimmedKey.substring('TE_API_KEY_'.length)
    : trimmedKey
  
  return `TE_API_KEY_${cleanKey}`
}
