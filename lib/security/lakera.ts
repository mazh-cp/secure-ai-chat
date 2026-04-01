import { config } from '@/lib/config'
import {
  extractAggregatedFromLakeraResponse,
  postLakeraGuard,
} from '@/lib/lakera/guard-client'
import { resolveLakeraGuardEndpoint, lakeraProjectIdForGuard } from '@/lib/lakera-guard-endpoint'
import { mergeLakeraEffectiveFlag } from '@/lib/lakera-sensitive-block'

/**
 * Lakera Guard API client wrapper (RAG + env-based scans).
 * Uses the same HTTP/parse/merge path as chat and /api/scan.
 */

export type LakeraSeverity = 'low' | 'medium' | 'high'

export interface LakeraScanInput {
  text: string
  context?: string
  source?: string
  meta?: {
    user_id?: string
    session_id?: string
    ip_address?: string
    internal_request_id?: string
    docId?: string
    filename?: string
    tenantId?: string
  }
  /** When set (e.g. from chat RAG), use these instead of env / server storage only */
  lakeraApiKeyOverride?: string
  lakeraEndpointOverride?: string
  lakeraProjectIdOverride?: string | null
}

export interface LakeraScanResult {
  allowed: boolean
  flagged: boolean
  categories: string[]
  severity: LakeraSeverity
  redactions?: Array<{ start: number; end: number; replacement?: string }>
  raw?: unknown
  /** Guard metadata.request_uuid when Lakera API was called */
  requestUuid?: string
  breakdown?: Array<{
    project_id: string
    policy_id: string
    detector_id: string
    detector_type: string
    detected: boolean
    message_id: number
  }>
}

export function getLakeraApiKey(): string | null {
  const key = process.env.LAKERA_API_KEY || process.env.LAKERA_AI_KEY
  if (!key || key.trim().length === 0) return null
  return key.trim()
}

export function getLakeraProjectId(): string | null {
  const id = process.env.LAKERA_PROJECT_ID
  if (!id || id.trim().length === 0) return null
  return id.trim()
}

function categoriesRecordToList(categories?: Record<string, boolean>): string[] {
  if (!categories) return []
  return Object.entries(categories)
    .filter(([, v]) => v)
    .map(([k]) => k)
}

export async function scanTextWithLakera(input: LakeraScanInput): Promise<LakeraScanResult> {
  const { getApiKeys } = await import('@/lib/api-keys-storage')
  const stored = await getApiKeys()

  const apiKey =
    input.lakeraApiKeyOverride?.trim() ||
    stored.lakeraAiKey?.trim() ||
    getLakeraApiKey() ||
    ''

  const endpointRaw =
    input.lakeraEndpointOverride ?? stored.lakeraEndpoint ?? undefined

  const projectIdRaw =
    input.lakeraProjectIdOverride !== undefined
      ? input.lakeraProjectIdOverride
      : stored.lakeraProjectId ?? getLakeraProjectId()

  if (!apiKey) {
    return {
      allowed: true,
      flagged: false,
      categories: [],
      severity: 'low',
    }
  }

  const guardUrl = resolveLakeraGuardEndpoint(
    endpointRaw || process.env.LAKERA_ENDPOINT || process.env.LAKERA_ENDPOINT_URL || undefined,
  )
  const projectId = lakeraProjectIdForGuard(
    projectIdRaw !== undefined && projectIdRaw !== null ? String(projectIdRaw) : getLakeraProjectId(),
  )

  const role =
    input.context === 'output' || input.context === 'generation' ? 'assistant' : 'user'

  try {
    const posted = await postLakeraGuard({
      guardUrl,
      lakeraKey: apiKey,
      messages: [{ role, content: input.text }],
      projectId,
      metadata: input.meta
        ? {
            ip_address: input.meta.ip_address,
            internal_request_id: input.meta.internal_request_id,
            user_id: input.meta.user_id,
            session_id: input.meta.session_id,
          }
        : undefined,
    })

    if (!posted.ok) {
      if (config.lakeraFailClosed) {
        return {
          allowed: false,
          flagged: true,
          categories: ['lakera_api_error'],
          severity: 'high',
          raw: { status: posted.status, errorDetails: posted.errorDetails },
        }
      }
      return {
        allowed: true,
        flagged: false,
        categories: [],
        severity: 'low',
        raw: { status: posted.status },
      }
    }

    const extracted = extractAggregatedFromLakeraResponse(posted.data)
    const effective = mergeLakeraEffectiveFlag({
      flagged: extracted.flagged,
      categories: extracted.categories,
      payload: extracted.payload,
      breakdown: extracted.breakdown,
    })

    const categoriesList = categoriesRecordToList(effective.categories)
    const flagged = effective.flagged

    let severity: LakeraSeverity = 'low'
    if (flagged) {
      const highRisk = ['prompt_injection', 'jailbreak', 'system_override', 'data_poisoning', 'pii']
      severity = categoriesList.some((c) => highRisk.includes(c.toLowerCase())) ? 'high' : 'medium'
    }

    return {
      allowed: !flagged,
      flagged,
      categories: categoriesList,
      severity,
      raw: posted.data,
      requestUuid: extracted.requestUuid,
      breakdown: extracted.breakdown,
    }
  } catch (err) {
    if (config.lakeraFailClosed) {
      return {
        allowed: false,
        flagged: true,
        categories: ['lakera_client_error'],
        severity: 'high',
        raw: { error: err instanceof Error ? err.message : 'unknown' },
      }
    }
    return {
      allowed: true,
      flagged: false,
      categories: [],
      severity: 'low',
      raw: { error: err instanceof Error ? err.message : 'unknown' },
    }
  }
}
