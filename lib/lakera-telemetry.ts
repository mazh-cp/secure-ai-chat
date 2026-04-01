/**
 * Lakera: optional HTTP companion events + platform-aligned audit.
 *
 * Primary logging to Lakera Guard platform happens automatically on each POST /v2/guard
 * (project policies / guard rails apply server-side when project_id is set).
 * Correlate app-side logs using metadata.request_uuid from the Guard response.
 * @see https://docs.lakera.ai/docs/metadata
 *
 * Optional: LAKERA_TELEMETRY_HTTP=true posts a JSON payload to LAKERA_TELEMETRY_ENDPOINT
 * for custom pipelines (not required for platform.lakera.ai dashboard).
 */

import {
  recordLakeraGuardAudit,
  summarizeLakeraBreakdown,
  type LakeraGuardAuditContext,
} from '@/lib/lakera-guard-audit'

interface LakeraTelemetryPayload {
  timestamp: string
  event_type: 'scan' | 'blocked' | 'allowed'
  context: {
    type: 'chat' | 'file_upload'
    source: string
  }
  scan_result: {
    flagged: boolean
    categories?: Record<string, boolean>
    scores?: Record<string, number>
    threat_level?: 'low' | 'medium' | 'high' | 'critical'
  }
  /** Aligns with Lakera Guard response metadata for dashboard search */
  lakera_correlation?: {
    request_uuid?: string
    project_id?: string
    breakdown_summary?: {
      detectors_triggered: number
      detector_types: string[]
      policy_ids: string[]
    }
  }
  metadata?: {
    user_ip?: string
    file_name?: string
    file_type?: string
    file_size?: number
    message_length?: number
    detected_patterns?: string[]
    internal_request_id?: string
    user_id?: string
    session_id?: string
  }
  project_id?: string
}

interface LakeraTelemetryResponse {
  success: boolean
  message?: string
  error?: string
}

export function isLakeraHttpTelemetryEnabled(): boolean {
  return process.env.LAKERA_TELEMETRY_HTTP === 'true' || process.env.LAKERA_TELEMETRY_HTTP === '1'
}

/**
 * Send optional companion JSON to a custom endpoint (not the Lakera Guard platform ingest).
 * Platform logs come from Guard API calls themselves.
 */
export async function sendLakeraTelemetry(
  payload: LakeraTelemetryPayload,
  lakeraApiKey: string,
  lakeraProjectId?: string
): Promise<LakeraTelemetryResponse> {
  const TELEMETRY_ENDPOINT =
    process.env.LAKERA_TELEMETRY_ENDPOINT?.trim() || 'https://api.lakera.ai/v2/telemetry'

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lakeraApiKey.trim()}`,
    }

    if (lakeraProjectId && lakeraProjectId.trim()) {
      headers['X-Lakera-Project'] = lakeraProjectId.trim()
    }

    const requestBody: LakeraTelemetryPayload & { project_id?: string } = {
      ...payload,
    }

    if (lakeraProjectId && lakeraProjectId.trim()) {
      requestBody.project_id = lakeraProjectId.trim()
    }

    console.log('Lakera HTTP companion POST:', {
      endpoint: TELEMETRY_ENDPOINT,
      event_type: payload.event_type,
      flagged: payload.scan_result.flagged,
      request_uuid: payload.lakera_correlation?.request_uuid,
    })

    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      if (response.status === 404) {
        console.warn(
          `Lakera telemetry HTTP: ${response.status} at ${TELEMETRY_ENDPOINT} — endpoint may not exist; platform logs still come from Guard API. Body: ${errorText.slice(0, 200)}`
        )
        return {
          success: false,
          error: `HTTP ${response.status} — disable LAKERA_TELEMETRY_HTTP or set LAKERA_TELEMETRY_ENDPOINT to a valid ingest URL`,
        }
      }
      console.warn(`Lakera telemetry HTTP warning (${response.status}): ${errorText.slice(0, 300)}`)
      return {
        success: false,
        error: `Telemetry API error: ${response.status}`,
      }
    }

    await response.json().catch(() => ({}))

    return {
      success: true,
      message: 'Companion telemetry POST accepted',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Lakera telemetry HTTP failed:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export type LakeraLogEntryForTelemetry = {
  type: string
  action: string
  source: string
  lakeraDecision?: {
    scanned: boolean
    flagged: boolean
    categories?: Record<string, boolean>
    scores?: Record<string, number>
    message?: string
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
  requestDetails?: {
    fileName?: string
    fileType?: string
    fileSize?: number
    message?: string
    threatLevel?: 'low' | 'medium' | 'high' | 'critical'
    detectedPatterns?: string[]
    lakeraRequestUuid?: string
  }
  userIP?: string
  timestamp?: string
  /** Chat route passes owner id; used for audit + optional HTTP metadata */
  userId?: string
  sessionId?: string
  internalRequestId?: string
  projectId?: string | null
}

/**
 * Convert application log entry to companion telemetry payload (HTTP mode only).
 */
export function convertLogToTelemetry(logEntry: LakeraLogEntryForTelemetry): LakeraTelemetryPayload | null {
  if (!logEntry.lakeraDecision?.scanned) {
    return null
  }

  const eventType =
    logEntry.action === 'blocked' ? 'blocked' : logEntry.action === 'scanned' ? 'scan' : 'allowed'

  const requestUuid =
    logEntry.lakeraDecision.requestUuid || logEntry.requestDetails?.lakeraRequestUuid

  const bsum = summarizeLakeraBreakdown(logEntry.lakeraDecision.breakdown)

  return {
    timestamp: logEntry.timestamp || new Date().toISOString(),
    event_type: eventType as 'scan' | 'blocked' | 'allowed',
    context: {
      type: logEntry.type === 'file_scan' ? 'file_upload' : 'chat',
      source: logEntry.source || 'unknown',
    },
    scan_result: {
      flagged: logEntry.lakeraDecision.flagged || false,
      categories: logEntry.lakeraDecision.categories,
      scores: logEntry.lakeraDecision.scores,
      threat_level: logEntry.requestDetails?.threatLevel,
    },
    lakera_correlation: {
      request_uuid: requestUuid,
      project_id: logEntry.projectId ?? undefined,
      breakdown_summary: {
        detectors_triggered: bsum.triggered,
        detector_types: bsum.detector_types,
        policy_ids: bsum.policy_ids,
      },
    },
    metadata: {
      user_ip: logEntry.userIP,
      file_name: logEntry.requestDetails?.fileName,
      file_type: logEntry.requestDetails?.fileType,
      file_size: logEntry.requestDetails?.fileSize,
      message_length: logEntry.requestDetails?.message?.length,
      detected_patterns: logEntry.requestDetails?.detectedPatterns,
      internal_request_id: logEntry.internalRequestId,
      user_id: logEntry.userId,
      session_id: logEntry.sessionId,
    },
  }
}

function defaultAuditContext(logEntry: LakeraLogEntryForTelemetry): LakeraGuardAuditContext {
  if (logEntry.type === 'file_scan') return 'file_upload'
  return 'chat_input'
}

/**
 * Platform-aligned audit (default) + optional HTTP companion (LAKERA_TELEMETRY_HTTP=true).
 * Set LAKERA_TELEMETRY_ENABLED=false to skip both (legacy name — disables outbound telemetry/audit fanout).
 */
export async function sendLakeraTelemetryFromLog(
  logEntry: LakeraLogEntryForTelemetry,
  lakeraApiKey: string,
  lakeraProjectId?: string | null,
  options?: { contextOverride?: LakeraGuardAuditContext }
): Promise<void> {
  const TELEMETRY_ENABLED = process.env.LAKERA_TELEMETRY_ENABLED !== 'false'
  if (!TELEMETRY_ENABLED) {
    return
  }

  if (!lakeraApiKey?.trim()) {
    return
  }

  const context = options?.contextOverride ?? defaultAuditContext(logEntry)

  try {
    await recordLakeraGuardAudit({
      context,
      projectId: lakeraProjectId ?? logEntry.projectId,
      requestUuid: logEntry.lakeraDecision?.requestUuid || logEntry.requestDetails?.lakeraRequestUuid,
      flagged: logEntry.lakeraDecision?.flagged ?? false,
      categories: logEntry.lakeraDecision?.categories,
      breakdown: logEntry.lakeraDecision?.breakdown,
      internalRequestId: logEntry.internalRequestId,
      userId: logEntry.userId,
      sessionId: logEntry.sessionId,
      ip: logEntry.userIP,
    })
  } catch (e) {
    console.error('Lakera guard audit log failed (non-blocking):', e)
  }

  if (!isLakeraHttpTelemetryEnabled()) {
    return
  }

  const payload = convertLogToTelemetry({
    ...logEntry,
    projectId: lakeraProjectId ?? logEntry.projectId,
  })
  if (!payload) {
    return
  }

  try {
    sendLakeraTelemetry(payload, lakeraApiKey, lakeraProjectId ?? undefined).catch((error) => {
      console.error('Lakera HTTP telemetry failed (non-blocking):', error)
    })
  } catch (error) {
    console.error('Lakera HTTP telemetry prepare failed (non-blocking):', error)
  }
}
