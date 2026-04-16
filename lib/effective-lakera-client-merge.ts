/**
 * Merge server-stored Lakera settings with optional client-sent values.
 * Server/env-backed values from getApiKeys() always win when present.
 * Client may send the placeholder "configured" (see /api/keys/retrieve + ChatInterface);
 * those must never be forwarded to Lakera Guard.
 */

function trimOrEmpty(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.trim()
}

export function effectiveLakeraAiKey(
  server: string | null | undefined,
  client: string | null | undefined
): string | null {
  const s = trimOrEmpty(server)
  if (s) return s
  const c = trimOrEmpty(client)
  if (!c || c === 'configured') return null
  return c
}

export function effectiveLakeraProjectId(
  server: string | null | undefined,
  client: string | null | undefined
): string | null {
  const s = trimOrEmpty(server)
  if (s) return s
  const c = trimOrEmpty(client)
  if (!c || c === 'configured') return null
  return c
}

export function effectiveLakeraEndpoint(
  server: string | null | undefined,
  client: string | null | undefined
): string | undefined {
  const s = trimOrEmpty(server)
  if (s) return s
  const c = trimOrEmpty(client)
  if (!c || c === 'configured') return undefined
  return c
}
