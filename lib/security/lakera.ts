/**
 * Lakera Guard API client wrapper (Secure RAG - Phase B boundary).
 *
 * Phase C will implement: read LAKERA_API_KEY (optional LAKERA_PROJECT_ID),
 * call POST https://api.lakera.ai/v2/guard, normalize output.
 *
 * Never log raw document text or user secrets.
 */

export type LakeraSeverity = 'low' | 'medium' | 'high'

export interface LakeraScanInput {
  /** Text to scan (never logged in full). */
  text: string
  /** Context: 'ingestion' | 'retrieval' | 'generation' | 'input' | 'output' */
  context?: string
  /** Source label e.g. 'file_upload', 'chat', 'rag_retrieval' */
  source?: string
  /** Optional metadata (no PII); may be sent to Lakera. */
  meta?: {
    user_id?: string
    session_id?: string
    ip_address?: string
    internal_request_id?: string
    docId?: string
    filename?: string
    tenantId?: string
  }
}

export interface LakeraScanResult {
  /** True if content is allowed by policy (not necessarily same as !flagged). */
  allowed: boolean
  /** True if Lakera or pre-scan flagged the content. */
  flagged: boolean
  /** Detected categories (e.g. prompt_injection, system_override, pii). */
  categories: string[]
  /** Derived severity. */
  severity: LakeraSeverity
  /** Optional redaction spans (start, end, replacement). */
  redactions?: Array<{ start: number; end: number; replacement?: string }>
  /** Raw API response for debugging (do not log in production). */
  raw?: unknown
}

const LAKERA_ENDPOINT = 'https://api.lakera.ai/v2/guard'

/**
 * Get Lakera API key from environment (or null if not set).
 * Prefer LAKERA_API_KEY; fallback to LAKERA_AI_KEY for backward compatibility.
 */
export function getLakeraApiKey(): string | null {
  const key = process.env.LAKERA_API_KEY || process.env.LAKERA_AI_KEY
  if (!key || key.trim().length === 0) return null
  return key.trim()
}

/**
 * Get optional Lakera project ID from environment.
 */
export function getLakeraProjectId(): string | null {
  const id = process.env.LAKERA_PROJECT_ID
  if (!id || id.trim().length === 0) return null
  return id.trim()
}

/**
 * Scan text with Lakera Guard API v2.
 *
 * Phase B: Stub that returns allowed: true, flagged: false when key is not set
 * (keeps existing behavior). Phase C will implement the real HTTP call and
 * normalization: { allowed, flagged, categories, severity, redactions?, raw }.
 *
 * Never log raw text; log only metadata + summary outcome (e.g. flagged, severity).
 */
export async function scanTextWithLakera(input: LakeraScanInput): Promise<LakeraScanResult> {
  const apiKey = getLakeraApiKey()
  const projectId = getLakeraProjectId()

  if (!apiKey) {
    return {
      allowed: true,
      flagged: false,
      categories: [],
      severity: 'low',
    }
  }

  // Phase C will implement: POST to LAKERA_ENDPOINT, parse response, normalize.
  // Placeholder for Phase B: could delegate to existing inline logic or leave as no-op allow.
  const endpoint = process.env.LAKERA_ENDPOINT || process.env.LAKERA_ENDPOINT_URL || LAKERA_ENDPOINT

  try {
    const body = {
      messages: [{ role: 'user', content: input.text }],
      project_id: projectId || undefined,
      payload: true,
      breakdown: true,
      metadata: input.meta
        ? {
            ip_address: input.meta.ip_address,
            internal_request_id: input.meta.internal_request_id,
            user_id: input.meta.user_id,
            session_id: input.meta.session_id,
          }
        : undefined,
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      // Do not log response body (may contain sensitive data)
      return {
        allowed: true,
        flagged: false,
        categories: [],
        severity: 'low',
        raw: { status: response.status },
      }
    }

    const data = (await response.json()) as {
      flagged?: boolean
      categories?: Record<string, boolean>
      results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>
    }

    const flagged = data.results?.[0]?.flagged ?? data.flagged ?? false
    const categoriesRecord = data.results?.[0]?.categories ?? data.categories ?? {}
    const categories = Object.entries(categoriesRecord)
      .filter(([, v]) => v)
      .map(([k]) => k)

    let severity: LakeraSeverity = 'low'
    if (flagged) {
      const highRisk = ['prompt_injection', 'jailbreak', 'system_override', 'data_poisoning']
      severity = categories.some((c) => highRisk.includes(c.toLowerCase())) ? 'high' : 'medium'
    }

    return {
      allowed: !flagged,
      flagged,
      categories,
      severity,
      raw: data,
    }
  } catch (err) {
    // On network/parse error, fail open for availability; log only summary
    return {
      allowed: true,
      flagged: false,
      categories: [],
      severity: 'low',
      raw: { error: err instanceof Error ? err.message : 'unknown' },
    }
  }
}
