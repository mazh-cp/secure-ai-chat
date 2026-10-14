/**
 * PIN Verification System
 * Provides secure PIN storage and verification for protecting API key removal
 */

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

import { getSecureStorageDir } from '@/lib/app-paths'

function pinFilePath(): string {
  return path.join(getSecureStorageDir(), 'verification-pin.hash')
}

// Number of iterations for PBKDF2 (password-based key derivation)
const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 32
const KEY_LENGTH = 64

/**
 * Initialize storage directory if it doesn't exist
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(getSecureStorageDir(), { recursive: true, mode: 0o700 }) // Only owner can read/write/execute
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
      await fs.access(pinFilePath())
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
    if (fsSync.existsSync(pinFilePath())) {
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
    await fs.writeFile(pinFilePath(), data, { mode: 0o600, flag: 'w' })

    console.log('Verification PIN configured successfully')
  } catch (error) {
    console.error('Error setting PIN:', error)
    throw error
  }
}

/** Raw stored `hash:salt` record, or null when no PIN is set. Server-only secret material. */
export async function readPinRecord(): Promise<string | null> {
  try {
    const data = (await fs.readFile(pinFilePath(), 'utf8')).trim()
    return data || null
  } catch {
    return null
  }
}

// An 8-digit PIN is brute-forceable without a cap. Per-client lockout after repeated failures, plus a
// global ceiling because the client key comes from forwarded headers a caller can rotate.
const MAX_FAILURES_PER_CLIENT = 5
const MAX_FAILURES_GLOBAL = 25
const FAILURE_WINDOW_MS = 15 * 60 * 1000
const clientFailures = new Map<string, { count: number; firstAt: number }>()
let globalFailures = { count: 0, firstAt: 0 }

function activeCount(entry: { count: number; firstAt: number } | undefined, now: number): number {
  if (!entry || now - entry.firstAt > FAILURE_WINDOW_MS) return 0
  return entry.count
}

/** Milliseconds until PIN attempts are accepted again for this client (0 = not locked). */
export function pinLockoutRemainingMs(clientKey: string): number {
  const now = Date.now()
  const client = clientFailures.get(clientKey)
  if (activeCount(client, now) >= MAX_FAILURES_PER_CLIENT && client) {
    return client.firstAt + FAILURE_WINDOW_MS - now
  }
  if (activeCount(globalFailures, now) >= MAX_FAILURES_GLOBAL) {
    return globalFailures.firstAt + FAILURE_WINDOW_MS - now
  }
  return 0
}

function recordPinFailure(clientKey: string): void {
  const now = Date.now()
  const client = clientFailures.get(clientKey)
  clientFailures.set(
    clientKey,
    activeCount(client, now) > 0 && client
      ? { count: client.count + 1, firstAt: client.firstAt }
      : { count: 1, firstAt: now }
  )
  globalFailures =
    activeCount(globalFailures, now) > 0
      ? { count: globalFailures.count + 1, firstAt: globalFailures.firstAt }
      : { count: 1, firstAt: now }
}

/**
 * Verify PIN. Returns false while the client is locked out after repeated failures.
 * With no PIN configured, returns true (first-run setup).
 */
export async function verifyPinCode(pin: string, clientKey = 'unknown'): Promise<boolean> {
  const configured = await isPinConfigured()
  if (!configured) return true

  if (pinLockoutRemainingMs(clientKey) > 0) return false

  try {
    const data = await fs.readFile(pinFilePath(), 'utf8')
    const [storedHash, storedSalt] = data.trim().split(':')

    if (!storedHash || !storedSalt) {
      console.error('Invalid PIN file format')
      return false
    }

    const ok = verifyPin(pin.trim(), storedHash, storedSalt)
    if (ok) clientFailures.delete(clientKey)
    else recordPinFailure(clientKey)
    return ok
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
      await fs.unlink(pinFilePath())
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
