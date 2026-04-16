/**
 * Stable owner_id for file registry and RAG scope.
 *
 * Shared org corpus: set SHARED_ORG_OWNER_ID (e.g. org) so every browser uses one tenant — uploads,
 * file list, RAG, and delete/clear all apply to the same server-side corpus. Ignores per-browser cookie
 * and X-Client-ID for owner resolution (cookie is still set to the shared id for consistency).
 *
 * Default: 1) X-Client-ID (valid) + sync cookie 2) cookie 3) generate and set cookie.
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
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length < 256 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  )
}

let loggedInvalidSharedOrgId = false

/** When set and valid, all clients share one file/RAG namespace (single-tenant org). */
function resolvedSharedOrgOwnerId(): string | null {
  const raw = process.env.SHARED_ORG_OWNER_ID?.trim()
  if (!raw) return null
  if (!isValidOwnerId(raw)) {
    if (!loggedInvalidSharedOrgId) {
      loggedInvalidSharedOrgId = true
      console.error(
        '[owner] SHARED_ORG_OWNER_ID is invalid (use 1–255 chars, [a-zA-Z0-9_-] only); falling back to per-browser owner'
      )
    }
    return null
  }
  return raw
}

export function isSharedOrgCorpusMode(): boolean {
  return resolvedSharedOrgOwnerId() !== null
}

function setOwnerCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  ownerId: string,
  request?: NextRequest
): void {
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
 * Get stable owner_id. Shared org mode (SHARED_ORG_OWNER_ID) wins over header/cookie.
 */
export async function getOwnerId(request?: NextRequest): Promise<OwnerResult> {
  const cookieStore = await cookies()
  const shared = resolvedSharedOrgOwnerId()
  if (shared) {
    const fromCookie = cookieStore.get(COOKIE_NAME)?.value?.trim()
    if (fromCookie !== shared) {
      setOwnerCookie(cookieStore, shared, request)
    }
    return { ownerId: shared }
  }

  const fromHeader = (
    request?.headers.get(CLIENT_ID_HEADER_LC) ?? request?.headers.get(CLIENT_ID_HEADER)
  )?.trim()

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
