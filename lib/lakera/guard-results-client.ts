/**
 * Lakera Guard /v2/guard/results client.
 * For calibration, dashboards, and UI overlays — does NOT replace /v2/guard blocking decisions.
 * @see https://docs.lakera.ai/docs/api/guard-results
 */

const TIMEOUT_MS = 15_000

export interface GuardResultsOptions {
  resultsUrl: string
  lakeraKey: string
  messages: Array<{ role: string; content: string }>
  projectId?: string
  metadata?: Record<string, string | undefined>
}

export interface GuardResultsResponse {
  ok: boolean
  status: number
  data?: unknown
  errorDetails?: unknown
}

export interface GuardResultsOverlay {
  flagged: boolean
  rowCount: number
  breakdown: Array<{
    detector_type: string
    detected: boolean
    message_id?: number
  }>
}

/** POST messages to Lakera /v2/guard/results and return raw response. */
export async function postLakeraGuardResults(
  opts: GuardResultsOptions
): Promise<GuardResultsResponse> {
  const { resultsUrl, lakeraKey, messages, projectId, metadata } = opts

  const body: Record<string, unknown> = { messages }
  if (projectId) body.project_id = projectId
  if (metadata) body.metadata = metadata

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(resultsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lakeraKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorDetails = await response.json().catch(() => ({}))
      return { ok: false, status: response.status, errorDetails }
    }

    const data = await response.json().catch(() => ({}))
    return { ok: true, status: response.status, data }
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

/** Normalize the /v2/guard/results payload to a UI-ready overlay shape. */
export function normalizeGuardResultsToOverlay(data: unknown): GuardResultsOverlay {
  if (!data || typeof data !== 'object') {
    return { flagged: false, rowCount: 0, breakdown: [] }
  }

  const d = data as Record<string, unknown>

  // Top-level flagged
  const flagged = Boolean(d.flagged)

  // breakdown array — shape mirrors LakeraApiResponse.breakdown
  const rawBreakdown = Array.isArray(d.breakdown) ? d.breakdown : []
  const breakdown = rawBreakdown
    .filter((b): b is Record<string, unknown> => b !== null && typeof b === 'object')
    .map(b => ({
      detector_type: typeof b.detector_type === 'string' ? b.detector_type : 'unknown',
      detected: Boolean(b.detected),
      message_id: typeof b.message_id === 'number' ? b.message_id : undefined,
    }))

  return { flagged, rowCount: breakdown.length, breakdown }
}
