/**
 * Minimal mock for Lakera client (use in tests: Jest.mock('@/lib/security/lakera')).
 * When LAKERA_API_KEY is unset, the real module already returns allowed: true; this mock
 * forces pass-through behavior without network calls.
 */

export function getLakeraApiKey(): string | null {
  return null
}

export function getLakeraProjectId(): string | null {
  return null
}

export async function scanTextWithLakera(): Promise<{
  allowed: boolean
  flagged: boolean
  categories: string[]
  severity: 'low' | 'medium' | 'high'
}> {
  return {
    allowed: true,
    flagged: false,
    categories: [],
    severity: 'low',
  }
}
