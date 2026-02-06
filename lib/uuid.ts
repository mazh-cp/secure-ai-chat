/**
 * Generate a UUID v4 string on the server. Uses Node's crypto.randomBytes so it works
 * on Node 14 and older where crypto.randomUUID is not available (avoids "randomUUID is not a function" in production).
 * Use only in server-side code (e.g. lib/owner.ts).
 */

import crypto from 'crypto'

/**
 * Generate a UUID v4 string. Safe for Node 12+ (uses randomBytes only).
 */
export function generateUUID(): string {
  const bytes = crypto.randomBytes(16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
