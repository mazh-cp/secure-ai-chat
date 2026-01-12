/**
 * Server-side API keys storage utilities
 * This module handles encrypted storage and retrieval of all API keys
 * Keys are stored encrypted at rest using AES-256-CBC
 */

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

// Storage file path
const STORAGE_DIR = path.join(process.cwd(), '.secure-storage')
const KEYS_FILE_PATH = path.join(STORAGE_DIR, 'api-keys.enc')

export interface StoredApiKeys {
  openAiKey?: string
  lakeraAiKey?: string
  lakeraProjectId?: string
  lakeraEndpoint?: string
}

// Encryption key (in production, use a secure key management service)
const getEncryptionKey = (): Buffer => {
  const envKey = process.env.API_KEYS_ENCRYPTION_KEY || process.env.CHECKPOINT_TE_ENCRYPTION_KEY
  if (envKey) {
    // Use provided key (should be 32 bytes for AES-256)
    return crypto.createHash('sha256').update(envKey).digest()
  }
  
  // Use a default key based on a secret (not secure for production, but better than plaintext)
  // In production, this should be set via environment variable
  const defaultSecret = 'secure-ai-chat-api-keys-storage-encryption-key-v1'
  return crypto.createHash('sha256').update(defaultSecret).digest()
}

// In-memory cache for API keys
let cachedKeys: StoredApiKeys | null = null
let keysLoaded = false

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
 * Encrypt API keys before storing
 */
function encryptKeys(keys: StoredApiKeys): string {
  try {
    const algorithm = 'aes-256-cbc'
    const encryptionKey = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv)
    
    const keysJson = JSON.stringify(keys)
    let encrypted = cipher.update(keysJson, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Prepend IV to encrypted data
    return iv.toString('hex') + ':' + encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    // Fallback to base64 encoding if encryption fails
    return Buffer.from(JSON.stringify(keys)).toString('base64')
  }
}

/**
 * Decrypt API keys after loading
 */
function decryptKeys(encryptedData: string): StoredApiKeys {
  try {
    // Check if it's in the new encrypted format (iv:encrypted) or old base64 format
    if (encryptedData.includes(':')) {
      const [ivHex, encrypted] = encryptedData.split(':')
      const algorithm = 'aes-256-cbc'
      const encryptionKey = getEncryptionKey()
      const iv = Buffer.from(ivHex, 'hex')
      
      const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return JSON.parse(decrypted)
    } else {
      // Old base64 format (backward compatibility)
      const decrypted = Buffer.from(encryptedData, 'base64').toString('utf8')
      return JSON.parse(decrypted)
    }
  } catch (error) {
    console.error('Decryption error:', error)
    // If decryption fails, return empty object
    return {}
  }
}

/**
 * Load API keys from persistent storage
 */
async function loadApiKeys(): Promise<StoredApiKeys> {
  // First check environment variables (highest priority)
  const envKeys: StoredApiKeys = {}
  
  if (process.env.OPENAI_API_KEY) {
    const envKey = process.env.OPENAI_API_KEY.trim()
    // Validate it's not a placeholder
    if (envKey && !envKey.includes('your_ope') && !envKey.includes('your-api-key') && envKey.length >= 20) {
      envKeys.openAiKey = envKey
    } else {
      console.warn('OPENAI_API_KEY environment variable contains placeholder or invalid value, ignoring')
    }
  }
  
  if (process.env.LAKERA_AI_KEY) {
    const envKey = process.env.LAKERA_AI_KEY.trim()
    // Validate it's not a placeholder
    if (envKey && !envKey.includes('your') && !envKey.includes('placeholder') && envKey.length >= 20) {
      envKeys.lakeraAiKey = envKey
    } else {
      console.warn('LAKERA_AI_KEY environment variable contains placeholder or invalid value, ignoring')
    }
  }
  
  if (process.env.LAKERA_PROJECT_ID) {
    const envKey = process.env.LAKERA_PROJECT_ID.trim()
    // Validate it's not a placeholder
    if (envKey && !envKey.includes('your') && !envKey.includes('placeholder') && envKey.length >= 5) {
      envKeys.lakeraProjectId = envKey
    } else {
      console.warn('LAKERA_PROJECT_ID environment variable contains placeholder or invalid value, ignoring')
    }
  }
  
  if (process.env.LAKERA_ENDPOINT) {
    const envKey = process.env.LAKERA_ENDPOINT.trim()
    // Validate it's a valid URL
    if (envKey && (envKey.startsWith('http://') || envKey.startsWith('https://'))) {
      envKeys.lakeraEndpoint = envKey
    } else {
      console.warn('LAKERA_ENDPOINT environment variable contains invalid value, ignoring')
    }
  }
  
  // If any env vars are set, merge them with file storage (env vars take priority)
  try {
    await ensureStorageDir()
    
    // Try to read from file
    try {
      const encryptedData = await fs.readFile(KEYS_FILE_PATH, 'utf8')
      if (encryptedData.trim()) {
        const fileKeys = decryptKeys(encryptedData.trim())
        // Merge: env vars take priority
        cachedKeys = { ...fileKeys, ...envKeys }
        keysLoaded = true
        return cachedKeys
      }
    } catch (fileError: unknown) {
      // File doesn't exist or can't be read - that's okay, key is just not configured
      if ((fileError as { code?: string }).code !== 'ENOENT') {
        console.error('Error reading API keys file:', fileError)
      }
    }
  } catch (error) {
    console.error('Error loading API keys:', error)
  }
  
  // Return env keys if available, otherwise empty object
  cachedKeys = envKeys
  keysLoaded = true
  return cachedKeys
}

/**
 * Save API keys to persistent storage
 */
async function saveApiKeys(keys: StoredApiKeys): Promise<void> {
  try {
    await ensureStorageDir()
    
    // Merge with existing keys (don't overwrite env vars)
    const existingKeys = await loadApiKeys()
    
    // Build keys to save - merge new keys with existing, but don't overwrite env vars
    const keysToSave: StoredApiKeys = {}
    
    // Handle OpenAI key
    if (keys.openAiKey !== undefined) {
      // New key provided
      if (keys.openAiKey && keys.openAiKey.trim() && !process.env.OPENAI_API_KEY) {
        keysToSave.openAiKey = keys.openAiKey.trim()
      } else if (!keys.openAiKey && existingKeys.openAiKey && !process.env.OPENAI_API_KEY) {
        // Empty string provided but existing key exists - keep existing
        keysToSave.openAiKey = existingKeys.openAiKey
      }
      // If new key is empty and no existing key, don't save (will be null)
    } else if (existingKeys.openAiKey && !process.env.OPENAI_API_KEY) {
      // No new key provided, keep existing
      keysToSave.openAiKey = existingKeys.openAiKey
    }
    
    // Handle Lakera AI key
    if (keys.lakeraAiKey !== undefined) {
      if (keys.lakeraAiKey && keys.lakeraAiKey.trim() && !process.env.LAKERA_AI_KEY) {
        keysToSave.lakeraAiKey = keys.lakeraAiKey.trim()
      } else if (!keys.lakeraAiKey && existingKeys.lakeraAiKey && !process.env.LAKERA_AI_KEY) {
        keysToSave.lakeraAiKey = existingKeys.lakeraAiKey
      }
    } else if (existingKeys.lakeraAiKey && !process.env.LAKERA_AI_KEY) {
      keysToSave.lakeraAiKey = existingKeys.lakeraAiKey
    }
    
    // Handle Lakera Project ID
    if (keys.lakeraProjectId !== undefined) {
      if (keys.lakeraProjectId && keys.lakeraProjectId.trim() && !process.env.LAKERA_PROJECT_ID) {
        keysToSave.lakeraProjectId = keys.lakeraProjectId.trim()
      } else if (!keys.lakeraProjectId && existingKeys.lakeraProjectId && !process.env.LAKERA_PROJECT_ID) {
        keysToSave.lakeraProjectId = existingKeys.lakeraProjectId
      }
    } else if (existingKeys.lakeraProjectId && !process.env.LAKERA_PROJECT_ID) {
      keysToSave.lakeraProjectId = existingKeys.lakeraProjectId
    }
    
    // Handle Lakera Endpoint
    if (keys.lakeraEndpoint !== undefined) {
      if (keys.lakeraEndpoint && keys.lakeraEndpoint.trim() && !process.env.LAKERA_ENDPOINT) {
        keysToSave.lakeraEndpoint = keys.lakeraEndpoint.trim()
      } else if (!keys.lakeraEndpoint && existingKeys.lakeraEndpoint && !process.env.LAKERA_ENDPOINT) {
        keysToSave.lakeraEndpoint = existingKeys.lakeraEndpoint
      } else if (!keys.lakeraEndpoint) {
        // Default endpoint
        keysToSave.lakeraEndpoint = 'https://api.lakera.ai/v2/guard'
      }
    } else if (existingKeys.lakeraEndpoint && !process.env.LAKERA_ENDPOINT) {
      keysToSave.lakeraEndpoint = existingKeys.lakeraEndpoint
    } else {
      // Default endpoint if nothing exists
      keysToSave.lakeraEndpoint = 'https://api.lakera.ai/v2/guard'
    }
    
    // Always save at least the endpoint, even if no other keys
    const encryptedKeys = encryptKeys(keysToSave)
    
    // Ensure directory exists and has correct permissions
    await ensureStorageDir()
    
    // Write with restrictive permissions (owner read/write only)
    await fs.writeFile(KEYS_FILE_PATH, encryptedKeys, { mode: 0o600, flag: 'w' })
    
    console.log('Keys saved successfully. Keys to save:', Object.keys(keysToSave))
    // Update cache with merged keys (env vars take priority)
    const envKeys: StoredApiKeys = {}
    if (process.env.OPENAI_API_KEY) envKeys.openAiKey = process.env.OPENAI_API_KEY.trim()
    if (process.env.LAKERA_AI_KEY) envKeys.lakeraAiKey = process.env.LAKERA_AI_KEY.trim()
    if (process.env.LAKERA_PROJECT_ID) envKeys.lakeraProjectId = process.env.LAKERA_PROJECT_ID.trim()
    if (process.env.LAKERA_ENDPOINT) envKeys.lakeraEndpoint = process.env.LAKERA_ENDPOINT.trim()
    cachedKeys = { ...keysToSave, ...envKeys }
  } catch (error) {
    console.error('Error saving API keys:', error)
    // Invalidate cache on error
    cachedKeys = null
    keysLoaded = false
    throw error
  }
}

/**
 * Delete a specific API key or all keys
 * Invalidates cache after deletion to ensure fresh data
 */
export async function deleteApiKey(keyName: keyof StoredApiKeys): Promise<void> {
  try {
    const existingKeys = await loadApiKeys()
    
    // Don't delete keys that are set via environment variables
    if (keyName === 'openAiKey' && process.env.OPENAI_API_KEY) {
      return
    }
    if (keyName === 'lakeraAiKey' && process.env.LAKERA_AI_KEY) {
      return
    }
    if (keyName === 'lakeraProjectId' && process.env.LAKERA_PROJECT_ID) {
      return
    }
    if (keyName === 'lakeraEndpoint' && process.env.LAKERA_ENDPOINT) {
      return
    }
    
    // Delete the key from existing keys
    delete existingKeys[keyName]
    await saveApiKeys(existingKeys)
    
    // Force cache invalidation to ensure fresh data on next access
    cachedKeys = null
    keysLoaded = false
    
    // Reload to update cache with deleted key removed
    await loadApiKeys()
  } catch (error) {
    console.error('Error deleting API key:', error)
    // Invalidate cache on error
    cachedKeys = null
    keysLoaded = false
    throw error
  }
}

/**
 * Delete all API keys
 * Invalidates cache after deletion to ensure fresh data
 */
export async function deleteAllApiKeys(): Promise<void> {
  try {
    await ensureStorageDir()
    
    // Only delete keys not set via environment variables
    const keysToDelete: StoredApiKeys = {}
    
    if (!process.env.OPENAI_API_KEY) {
      keysToDelete.openAiKey = ''
    }
    if (!process.env.LAKERA_AI_KEY) {
      keysToDelete.lakeraAiKey = ''
    }
    if (!process.env.LAKERA_PROJECT_ID) {
      keysToDelete.lakeraProjectId = ''
    }
    if (!process.env.LAKERA_ENDPOINT) {
      keysToDelete.lakeraEndpoint = ''
    }
    
    await saveApiKeys(keysToDelete)
    
    // Force cache invalidation to ensure fresh data on next access
    cachedKeys = null
    keysLoaded = false
    
    // Reload to update cache with all keys deleted
    await loadApiKeys()
  } catch (error) {
    console.error('Error deleting all API keys:', error)
    // Invalidate cache on error
    cachedKeys = null
    keysLoaded = false
    throw error
  }
}

/**
 * Get API keys (async version)
 * Returns keys from environment variables, cached, or file storage
 */
export async function getApiKeys(): Promise<StoredApiKeys> {
  if (keysLoaded && cachedKeys) {
    return cachedKeys
  }
  return await loadApiKeys()
}

/**
 * Get API keys (synchronous version)
 * Returns cached keys or tries to load synchronously
 */
export function getApiKeysSync(): StoredApiKeys {
  // Return cached value if available
  if (cachedKeys) {
    return cachedKeys
  }
  
  // Check environment variables (always available synchronously)
  const envKeys: StoredApiKeys = {}
  
  if (process.env.OPENAI_API_KEY) {
    const envKey = process.env.OPENAI_API_KEY.trim()
    // Validate it's not a placeholder
    if (envKey && !envKey.includes('your_ope') && !envKey.includes('your-api-key') && envKey.length >= 20) {
      envKeys.openAiKey = envKey
    }
  }
  
  if (process.env.LAKERA_AI_KEY) {
    const envKey = process.env.LAKERA_AI_KEY.trim()
    // Validate it's not a placeholder
    if (envKey && !envKey.includes('your') && !envKey.includes('placeholder') && envKey.length >= 20) {
      envKeys.lakeraAiKey = envKey
    }
  }
  
  if (process.env.LAKERA_PROJECT_ID) {
    const envKey = process.env.LAKERA_PROJECT_ID.trim()
    // Validate it's not a placeholder
    if (envKey && !envKey.includes('your') && !envKey.includes('placeholder') && envKey.length >= 5) {
      envKeys.lakeraProjectId = envKey
    }
  }
  
  if (process.env.LAKERA_ENDPOINT) {
    const envKey = process.env.LAKERA_ENDPOINT.trim()
    // Validate it's a valid URL
    if (envKey && (envKey.startsWith('http://') || envKey.startsWith('https://'))) {
      envKeys.lakeraEndpoint = envKey
    }
  }
  
  return envKeys
}

/**
 * Set API keys (persists to encrypted file)
 * Invalidates cache to ensure fresh data
 */
export async function setApiKeys(keys: StoredApiKeys): Promise<void> {
  await saveApiKeys(keys)
  // Invalidate cache to force reload on next access
  cachedKeys = null
  keysLoaded = false
}

/**
 * Check if API keys are configured (checks both env vars and file storage)
 */
export async function areApiKeysConfigured(): Promise<boolean> {
  const keys = await getApiKeys()
  return !!(keys.openAiKey || keys.lakeraAiKey || keys.lakeraProjectId)
}

/**
 * Check if a specific API key is configured
 */
export async function isApiKeyConfigured(keyName: keyof StoredApiKeys): Promise<boolean> {
  const keys = await getApiKeys()
  return !!keys[keyName]
}

// Initialize: Load keys on module load (for server-side)
if (typeof window === 'undefined') {
  loadApiKeys().catch((error) => {
    console.error('Failed to load API keys on initialization:', error)
  })
}
