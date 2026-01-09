/**
 * PIN Verification System
 * Provides secure PIN storage and verification for protecting API key removal
 */

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

// Storage file path (in project root, but outside of .git)
const STORAGE_DIR = path.join(process.cwd(), '.secure-storage')
const PIN_FILE_PATH = path.join(STORAGE_DIR, 'verification-pin.hash')

// Number of iterations for PBKDF2 (password-based key derivation)
const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 32
const KEY_LENGTH = 64

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
 * Hash PIN using PBKDF2 (Password-Based Key Derivation Function 2)
 * This is a secure way to store passwords/PINs
 */
function hashPin(pin: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const hash = crypto.pbkdf2Sync(pin, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512')
  
  return {
    hash: hash.toString('hex'),
    salt: salt.toString('hex'),
  }
}

/**
 * Verify PIN against stored hash
 */
function verifyPin(pin: string, storedHash: string, storedSalt: string): boolean {
  try {
    const saltBuffer = Buffer.from(storedSalt, 'hex')
    const hashBuffer = Buffer.from(storedHash, 'hex')
    const computedHash = crypto.pbkdf2Sync(pin, saltBuffer, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512')
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(hashBuffer, computedHash)
  } catch (error) {
    console.error('Error verifying PIN:', error)
    return false
  }
}

/**
 * Check if PIN is configured
 */
export async function isPinConfigured(): Promise<boolean> {
  try {
    await ensureStorageDir()
    try {
      await fs.access(PIN_FILE_PATH)
      return true
    } catch {
      return false
    }
  } catch (error) {
    console.error('Error checking PIN configuration:', error)
    return false
  }
}

/**
 * Check if PIN is configured (synchronous version)
 */
export function isPinConfiguredSync(): boolean {
  try {
    const fsSync = require('fs')
    if (fsSync.existsSync(PIN_FILE_PATH)) {
      return true
    }
  } catch (error) {
    // Silently fail
  }
  return false
}

/**
 * Set or update the verification PIN
 * PIN must be 4-8 digits
 */
export async function setPin(pin: string): Promise<void> {
  // Validate PIN format
  if (!pin || typeof pin !== 'string') {
    throw new Error('PIN is required')
  }
  
  const trimmedPin = pin.trim()
  
  // PIN must be 4-8 digits
  if (!/^\d{4,8}$/.test(trimmedPin)) {
    throw new Error('PIN must be 4-8 digits')
  }
  
  try {
    await ensureStorageDir()
    
    // Hash the PIN
    const { hash, salt } = hashPin(trimmedPin)
    
    // Store hash and salt (separated by colon)
    const data = `${hash}:${salt}`
    
    // Write with restrictive permissions (owner read/write only)
    await fs.writeFile(PIN_FILE_PATH, data, { mode: 0o600, flag: 'w' })
    
    console.log('Verification PIN configured successfully')
  } catch (error) {
    console.error('Error setting PIN:', error)
    throw error
  }
}

/**
 * Verify PIN
 * Returns true if PIN is correct, false otherwise
 */
export async function verifyPinCode(pin: string): Promise<boolean> {
  // Check if PIN is configured
  const configured = await isPinConfigured()
  if (!configured) {
    // If no PIN is configured, allow access (backward compatibility)
    // In production, you might want to require PIN setup first
    return true
  }
  
  try {
    // Read stored hash and salt
    const data = await fs.readFile(PIN_FILE_PATH, 'utf8')
    const [storedHash, storedSalt] = data.trim().split(':')
    
    if (!storedHash || !storedSalt) {
      console.error('Invalid PIN file format')
      return false
    }
    
    // Verify the PIN
    return verifyPin(pin.trim(), storedHash, storedSalt)
  } catch (error) {
    console.error('Error verifying PIN:', error)
    return false
  }
}

/**
 * Remove PIN (for reset/reset functionality)
 */
export async function removePin(): Promise<void> {
  try {
    await ensureStorageDir()
    try {
      await fs.unlink(PIN_FILE_PATH)
      console.log('Verification PIN removed')
    } catch (unlinkError: unknown) {
      // File doesn't exist, that's fine
      if ((unlinkError as { code?: string }).code !== 'ENOENT') {
        throw unlinkError
      }
    }
  } catch (error) {
    console.error('Error removing PIN:', error)
    throw error
  }
}
