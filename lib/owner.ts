/**
 * Stable owner_id for file registry and RAG scope.
 * Priority: 1) X-Client-ID header (when valid) and sync to cookie 2) cookie 3) generate and set cookie.
 * Syncing header to cookie ensures list/store/chat always use the same owner after client sends X-Client-ID.
 */

import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { generateUUID } from '@/lib/uuid'

const COOKIE_NAME = 'owner_id'
// Next.js normalizes request headers to lowercase; check both for compatibility
const CLIENT_ID_HEADER_LC = 'x-client-id'
const CLIENT_ID_HEADER = 'X-Client-ID'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function generateOwnerId(): string {
  try {
    return generateUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
  }
}

function isValidOwnerId(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && value.length < 256 && /^[a-zA-Z0-9_-]+$/.test(value)
}

function setOwnerCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, ownerId: string, request?: NextRequest): void {
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
}

export interface OwnerResult {
  ownerId: string
}

/**
 * Get stable owner_id. When X-Client-ID is present and valid, use it and set cookie to that value
 * so list/store/chat always share the same owner. Otherwise use cookie, or generate and set cookie.
 */
export async function getOwnerId(request?: NextRequest): Promise<OwnerResult> {
  const cookieStore = await cookies()
  const fromHeader = (request?.headers.get(CLIENT_ID_HEADER_LC) ?? request?.headers.get(CLIENT_ID_HEADER))?.trim()

  // Prefer client-sent X-Client-ID and sync to cookie so list/store never use a different owner
  if (fromHeader && isValidOwnerId(fromHeader)) {
    const fromCookie = cookieStore.get(COOKIE_NAME)?.value?.trim()
    if (fromCookie !== fromHeader) {
      setOwnerCookie(cookieStore, fromHeader, request)
    }
    return { ownerId: fromHeader }
  }

  const fromCookie = cookieStore.get(COOKIE_NAME)?.value?.trim()
  if (fromCookie && isValidOwnerId(fromCookie)) {
    return { ownerId: fromCookie }
  }

  const ownerId = generateOwnerId()
  setOwnerCookie(cookieStore, ownerId, request)
  return { ownerId }
}
