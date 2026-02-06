/**
 * Safe fetch for UI: never throws on non-JSON or network errors.
 * Re-exports from lib/safe-fetch for consistent API response handling and blank-screen prevention.
 */

export type { SafeFetchResult } from '@/lib/safe-fetch'
export { safeFetchJson } from '@/lib/safe-fetch'
