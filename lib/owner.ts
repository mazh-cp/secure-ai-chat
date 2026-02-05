/**
 * Stable owner_id for file registry and RAG scope.
 * Priority: 1) cookie owner_id 2) header X-Client-ID 3) generate new UUID and set cookie.
 * Do NOT rotate ownerId per request.
 */

import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'owner_id'
const CLIENT_ID_HEADER = 'X-Client-ID'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function generateOwnerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

function isValidOwnerId(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && value.length < 256 && /^[a-zA-Z0-9_-]+$/.test(value)
}

export interface OwnerResult {
  ownerId: string
}

/**
 * Get stable owner_id. Priority: 1) cookie owner_id 2) header X-Client-ID 3) generate and set cookie.
 * When generating, ALWAYS set cookie so future requests use the same id.
 */
export async function getOwnerId(request?: NextRequest): Promise<OwnerResult> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(COOKIE_NAME)?.value?.trim()
  if (fromCookie && isValidOwnerId(fromCookie)) {
    return { ownerId: fromCookie }
  }
  const fromHeader = request?.headers.get(CLIENT_ID_HEADER)?.trim()
  if (fromHeader && isValidOwnerId(fromHeader)) {
    return { ownerId: fromHeader }
  }
  const ownerId = generateOwnerId()
  // Secure only in true production HTTPS; false on localhost so cookie persists in local dev (http)
  const host = request?.headers.get('host') ?? ''
  const isLocalhost = /^localhost(:\d+)?$/i.test(host.trim())
  const isProd = process.env.NODE_ENV === 'production' && !isLocalhost
  cookieStore.set(COOKIE_NAME, ownerId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return { ownerId }
}
