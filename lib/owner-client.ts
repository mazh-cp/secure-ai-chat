/**
 * Client-side: stable X-Client-ID for list/store/status/chat.
 * Persisted in localStorage so identity does not change on re-render or navigation.
 * Uses crypto.randomUUID() only in the browser when available; never on server (SSR) to avoid
 * "crypto.randomUUID is not a function" in Node/standalone.
 */

const STORAGE_KEY = 'x-client-id'

function generateClientId(): string {
  // Only use crypto.randomUUID in the browser. On server (SSR/Node) it can be missing or different.
  if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && typeof (crypto as { randomUUID?: () => string }).randomUUID === 'function') {
    try {
      return (crypto as { randomUUID: () => string }).randomUUID()
    } catch {
      // fall through to fallback
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 9)}`
}

function getClientId(): string {
  if (typeof window === 'undefined') return ''
  let value = localStorage.getItem(STORAGE_KEY)
  if (!value) {
    value = generateClientId()
    localStorage.setItem(STORAGE_KEY, value)
  }
  return value
}

/**
 * Headers to add to every /api/* request so the server uses this client's owner_id.
 * Sync; does not regenerate id on each call.
 */
export function ownerHeaders(): Record<string, string> {
  const id = getClientId()
  return id ? { 'X-Client-ID': id } : {}
}

/** Default fetch options for all /api/* calls: include cookies, no cache. */
export const apiFetchOptions: RequestInit = {
  credentials: 'include',
  cache: 'no-store',
}
