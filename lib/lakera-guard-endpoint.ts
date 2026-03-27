/**
 * Lakera Guard API base URL normalization.
 * @see https://docs.lakera.ai/docs/api/guard
 * Guard requests must be POSTed to …/v2/guard with Authorization: Bearer <token> and project_id in JSON body.
 */

export const LAKERA_GUARD_URL_DEFAULT = 'https://api.lakera.ai/v2/guard'

/**
 * Resolve the Guard URL. Accepts full guard URL or API root (…/v2); always returns a URL ending in /v2/guard for Lakera SaaS.
 */
export function resolveLakeraGuardEndpoint(raw?: string | null): string {
  if (!raw?.trim()) {
    return LAKERA_GUARD_URL_DEFAULT
  }
  let s = raw.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`
  }
  try {
    const u = new URL(s)
    const p = u.pathname.replace(/\/+$/, '') || '/'
    if (p === '/v2' || p === '/') {
      u.pathname = '/v2/guard'
      return u.toString().replace(/\/+$/, '')
    }
    if (u.hostname.endsWith('lakera.ai') && !p.includes('/guard') && p.endsWith('/v2')) {
      u.pathname = `${p}/guard`
      return u.toString().replace(/\/+$/, '')
    }
    return s
  } catch {
    return LAKERA_GUARD_URL_DEFAULT
  }
}

/** Trimmed project id for Guard body, or undefined if unset (Lakera uses default policy). */
export function lakeraProjectIdForGuard(raw?: string | null): string | undefined {
  const t = raw?.trim()
  return t ? t : undefined
}
