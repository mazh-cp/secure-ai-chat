/**
 * Lakera Guard API base URL normalization.
 * @see https://docs.lakera.ai/docs/api/guard
 * Guard requests must be POSTed to …/v2/guard with Authorization: Bearer <token> and project_id in JSON body.
 */

export const LAKERA_GUARD_URL_DEFAULT = 'https://api.lakera.ai/v2/guard'

/** Lakera-hosted Guard (global + regional); other hosts are returned unchanged (self-hosted, proxies). */
function isLakeraHostedGuardHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'api.lakera.ai' || h.endsWith('.api.lakera.ai')
}

/** Canonical path for Lakera SaaS Guard v2. */
function normalizeLakeraSaaSPathname(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/v2/guard') return '/v2/guard'
  if (p === '/' || p === '/v1' || p === '/v2') return '/v2/guard'
  if (p === '/v1/guard' || p === '/guard') return '/v2/guard'
  if (p.toLowerCase().startsWith('/v1')) return '/v2/guard'
  const pl = p.toLowerCase()
  if (pl.endsWith('/v2') && !pl.includes('guard')) {
    return `${p}/guard`
  }
  return p
}

/**
 * Resolve the Guard URL. Accepts full guard URL or API root (…/v2); returns a URL that POSTs to …/v2/guard on Lakera SaaS.
 * Misconfigured legacy paths (/v1/guard, /guard, bare /v2) are normalized and often fix HTTP 404 from Lakera.
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
    if (!isLakeraHostedGuardHost(u.hostname)) {
      return s
    }
    u.pathname = normalizeLakeraSaaSPathname(u.pathname)
    return u.toString().replace(/\/+$/, '')
  } catch {
    return LAKERA_GUARD_URL_DEFAULT
  }
}

/** Trimmed project id for Guard body, or undefined if unset (Lakera uses default policy). */
export function lakeraProjectIdForGuard(raw?: string | null): string | undefined {
  const t = raw?.trim()
  return t ? t : undefined
}

/** Short operator hint when Lakera HTTP status is surfaced to the UI. */
export function lakeraGuardHttpUserHint(status: number): string | undefined {
  if (status === 404) {
    return 'Use endpoint https://api.lakera.ai/v2/guard or your region (e.g. https://eu-west-1.api.lakera.ai/v2/guard). /v1/guard and /guard are invalid.'
  }
  if (status === 401) {
    return 'Check Lakera API key and that Authorization uses Bearer; rotate key in Lakera platform if needed.'
  }
  return undefined
}
