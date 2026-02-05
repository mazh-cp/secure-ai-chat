/**
 * Client-side: stable X-Client-ID for list/store/status/chat.
 * Persisted in localStorage so identity does not change on re-render or navigation.
 */

const STORAGE_KEY = 'x-client-id'

function getClientId(): string {
  if (typeof window === 'undefined') return ''
  let value = localStorage.getItem(STORAGE_KEY)
  if (!value) {
    value = crypto.randomUUID()
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
