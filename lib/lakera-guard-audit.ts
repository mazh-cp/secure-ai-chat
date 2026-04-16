/**
 * Server-side audit rows that align with Lakera Guard platform logging.
 *
 * Lakera records each POST /v2/guard in the Guard dashboard when project_id + metadata are sent.
 * There is no separate public "telemetry push" API required for portal visibility — correlate using
 * metadata.request_uuid from the Guard response.
 * @see https://docs.lakera.ai/docs/metadata
 */

import { systemLog } from '@/lib/system-logging'

export type LakeraGuardAuditContext =
  | 'chat_input'
  | 'chat_output'
  | 'file_upload'
  | 'rag_ingestion'
  | 'rag_retrieval'
  | 'rag_generation'

type BreakdownRow = {
  detector_type?: string
  detected?: boolean
  policy_id?: string
  detector_id?: string
}

export function summarizeLakeraBreakdown(breakdown?: BreakdownRow[]): {
  triggered: number
  detector_types: string[]
  policy_ids: string[]
} {
  if (!breakdown?.length) return { triggered: 0, detector_types: [], policy_ids: [] }
  const detected = breakdown.filter(b => b.detected === true)
  return {
    triggered: detected.length,
    detector_types: [...new Set(detected.map(d => d.detector_type).filter(Boolean) as string[])],
    policy_ids: [...new Set(detected.map(d => d.policy_id).filter(Boolean) as string[])],
  }
}

/** Writes a structured system log row operators can align with platform.lakera.ai Guard logs. */
export async function recordLakeraGuardAudit(entry: {
  context: LakeraGuardAuditContext
  projectId?: string | null
  requestUuid?: string
  flagged: boolean
  categories?: Record<string, boolean>
  breakdown?: BreakdownRow[]
  internalRequestId?: string
  userId?: string
  sessionId?: string
  ip?: string
}): Promise<void> {
  if (process.env.LAKERA_GUARD_AUDIT_LOG === 'false') {
    return
  }

  const summary = summarizeLakeraBreakdown(entry.breakdown)
  const categoryKeys = entry.categories
    ? Object.keys(entry.categories).filter(k => entry.categories![k])
    : []

  const missingProject = !entry.projectId?.trim()
  if (missingProject && process.env.NODE_ENV === 'production') {
    console.warn(
      '[Lakera] No project_id on Guard request — Lakera applies the default policy, not your project guard rails. Set Lakera Project ID in Settings.'
    )
  }

  await systemLog.info(
    'lakera_guard',
    entry.flagged
      ? `Lakera Guard flagged (${entry.context}) — correlate with platform using request_uuid`
      : `Lakera Guard allowed (${entry.context})`,
    {
      endpoint: '/v2/guard',
      method: 'POST',
      statusCode: 200,
    },
    {
      lakera: {
        context: entry.context,
        request_uuid: entry.requestUuid ?? null,
        project_id: entry.projectId ?? null,
        project_configured: !missingProject,
        flagged: entry.flagged,
        category_keys: categoryKeys,
        detectors_triggered: summary.triggered,
        detector_types: summary.detector_types,
        policy_ids: summary.policy_ids,
        internal_request_id: entry.internalRequestId,
        user_id: entry.userId ?? null,
        session_id: entry.sessionId ?? null,
        ip_address: entry.ip ?? null,
        platform_note:
          'Guard API calls are logged by Lakera; search the Guard dashboard using request_uuid and project_id.',
      },
    }
  )
}
