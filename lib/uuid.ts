/**
 * Generate a UUID v4 string on the server. Uses Node's crypto.randomBytes so it works
 * on Node 14 and older where crypto.randomUUID is not available (avoids "randomUUID is not a function" in production).
 * Use only in server-side code (e.g. lib/owner.ts).
 * Never calls randomUUID; has fallback if randomBytes is missing.
 */

import nodeCrypto from 'crypto'

/**
 * Generate a UUID v4 string. Safe for Node 12+ (uses randomBytes only).
 * Fallback if randomBytes is not available (e.g. wrong bundling context).
 */
export function generateUUID(): string {
  try {
    if (typeof nodeCrypto.randomBytes === 'function') {
      const bytes = nodeCrypto.randomBytes(16)
      bytes[6] = (bytes[6]! & 0x0f) | 0x40
      bytes[8] = (bytes[8]! & 0x3f) | 0x80
      const hex = bytes.toString('hex')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
    }
  } catch {
    // fall through to fallback
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 9)}`
}
