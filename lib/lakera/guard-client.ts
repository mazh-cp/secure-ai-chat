/**
 * Canonical Lakera Guard v2 client: one HTTP + parse + merge path for chat, file scan, and RAG.
 * @see https://docs.lakera.ai/docs/api/guard
 */

import { config } from '@/lib/config'
import { buildGuardMessagesFromAugmentedUserTurn } from '@/lib/lakera-guard-messages'
import { lakeraProjectIdForGuard, resolveLakeraGuardEndpoint } from '@/lib/lakera-guard-endpoint'
import { detectCommonInjectionPatterns } from '@/lib/lakera-prescan'
import { detectStructuredSensitiveLeakInAssistantOutput } from '@/lib/lakera-output-structured-leak'
import { mergeLakeraEffectiveFlag, sortLakeraThreatCategoriesForDisplay } from '@/lib/lakera-sensitive-block'
import {
  classifyLakeraBlock,
  buildLakeraChatBlockMessage,
  type LakeraBlockPolicy,
} from '@/lib/lakera-guard-classify'

/** Raw JSON shape from POST /v2/guard */
export interface LakeraApiResponse {
  flagged: boolean
  payload?: Array<{
    start: number
    end: number
    text: string
    detector_type: string
    labels: string[]
    message_id: number
  }>
  breakdown?: Array<{
    project_id: string
    policy_id: string
    detector_id: string
    detector_type: string
    detected: boolean
    message_id: number
  }>
  metadata?: { request_uuid?: string }
  categories?: Record<string, boolean>
  payload_scores?: Record<string, number>
  results?: Array<{
    flagged: boolean
    categories?: Record<string, boolean>
    payload_scores?: Record<string, number>
    payload?: LakeraApiResponse['payload']
    breakdown?: LakeraApiResponse['breakdown']
  }>
  message?: string
  error?: string
}

export type LakeraResultEntry = NonNullable<LakeraApiResponse['results']>[number]

export function aggregateLakeraResultEntries(results: LakeraResultEntry[]): {
  flagged: boolean
  categories?: Record<string, boolean>
  scores?: Record<string, number>
  payload?: LakeraResultEntry['payload']
  breakdown?: LakeraResultEntry['breakdown']
} {
  const flagged = results.some((r) => r.flagged === true)
  const categories: Record<string, boolean> = {}
  for (const r of results) {
    if (!r.categories) continue
    for (const [k, v] of Object.entries(r.categories)) {
      if (v) categories[k] = true
    }
  }
  const payload = results.flatMap((r) => r.payload ?? [])
  const breakdown = results.flatMap((r) => r.breakdown ?? [])
  const scores: Record<string, number> = {}
  for (const r of results) {
    if (!r.payload_scores) continue
    for (const [k, v] of Object.entries(r.payload_scores)) {
      if (typeof v === 'number') scores[k] = Math.max(scores[k] ?? 0, v)
    }
  }
  return {
    flagged,
    categories: Object.keys(categories).length > 0 ? categories : undefined,
    scores: Object.keys(scores).length > 0 ? scores : undefined,
    payload: payload.length > 0 ? payload : undefined,
    breakdown: breakdown.length > 0 ? breakdown : undefined,
  }
}

export function extractAggregatedFromLakeraResponse(data: LakeraApiResponse): {
  flagged: boolean
  categories?: Record<string, boolean>
  scores?: Record<string, number>
  payload?: LakeraApiResponse['payload']
  breakdown?: LakeraApiResponse['breakdown']
  requestUuid?: string
} {
  if (data.results && Array.isArray(data.results) && data.results.length > 0) {
    const agg = aggregateLakeraResultEntries(data.results)
    return {
      flagged: agg.flagged,
      categories: agg.categories,
      scores: agg.scores,
      payload: agg.payload,
      breakdown: agg.breakdown,
      requestUuid: data.metadata?.request_uuid,
    }
  }
  return {
    flagged: data.flagged === true,
    categories: data.categories,
    scores: data.payload_scores,
    payload: data.payload,
    breakdown: data.breakdown,
    requestUuid: data.metadata?.request_uuid,
  }
}

export type GuardMetadata = {
  user_id?: string
  session_id?: string
  ip_address?: string
  internal_request_id?: string
}

export async function postLakeraGuard(params: {
  guardUrl: string
  lakeraKey: string
  messages: Array<{ role: string; content: string }>
  projectId?: string
  metadata?: GuardMetadata
}): Promise<
  | { ok: true; data: LakeraApiResponse }
  | { ok: false; status: number; errorDetails?: Record<string, unknown> | string | null }
> {
  const body: Record<string, unknown> = {
    messages: params.messages,
    project_id: params.projectId,
    payload: true,
    breakdown: true,
  }
  if (params.metadata) {
    body.metadata = {
      user_id: params.metadata.user_id,
      session_id: params.metadata.session_id,
      ip_address: params.metadata.ip_address,
      internal_request_id: params.metadata.internal_request_id,
    }
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), Math.max(1000, config.lakeraTimeoutMs))
  try {
    const response = await fetch(params.guardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.lakeraKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      let errorDetails: Record<string, unknown> | string | null = null
      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          errorDetails = (await response.json()) as Record<string, unknown>
        } else {
          const text = await response.text()
          errorDetails = text ? text.substring(0, 500) : null
        }
      } catch {
        errorDetails = null
      }
      return { ok: false, status: response.status, errorDetails }
    }
    const data = (await response.json()) as LakeraApiResponse
    return { ok: true, data }
  } finally {
    clearTimeout(t)
  }
}

function patternsToCategoryRecord(patterns: string[]): Record<string, boolean> {
  return patterns.reduce(
    (acc, pattern) => {
      acc[pattern.toLowerCase().replace(/\s+/g, '_')] = true
      return acc
    },
    {} as Record<string, boolean>,
  )
}

export interface GuardChatScanResult {
  scanned: boolean
  flagged: boolean
  categories?: Record<string, boolean>
  scores?: Record<string, number>
  message?: string
  threatLevel?: 'low' | 'medium' | 'high' | 'critical'
  payload?: LakeraApiResponse['payload']
  breakdown?: LakeraApiResponse['breakdown']
  requestUuid?: string
  /** PII vs content moderation vs security — for UX aligned with Lakera policies */
  blockPolicy?: LakeraBlockPolicy
}

export type ChatGuardCallOptions = {
  inputUserQuestionPrefix?: string
  outputPairedUserContent?: string
}

/**
 * Chat input/output screening (pre-scan + message shaping + Guard + merge).
 */
export async function screenChatWithLakera(
  message: string,
  lakeraKey: string,
  lakeraEndpoint: string | null | undefined,
  lakeraProjectId: string | null | undefined,
  context?: 'input' | 'output',
  metadata?: GuardMetadata,
  guardCallOptions?: ChatGuardCallOptions,
): Promise<GuardChatScanResult> {
  if (!lakeraKey?.trim()) {
    return { scanned: false, flagged: false }
  }

  const guardUrl = resolveLakeraGuardEndpoint(lakeraEndpoint)
  const projectId = lakeraProjectIdForGuard(lakeraProjectId)
  const preScan = detectCommonInjectionPatterns(message)

  if (preScan.detected && preScan.severity === 'high') {
    return {
      scanned: true,
      flagged: true,
      categories: {
        prompt_injection: true,
        system_override: true,
        ...patternsToCategoryRecord(preScan.patterns),
      },
      message: `Security threat detected: ${preScan.patterns.join(', ')}. Message blocked.`,
      threatLevel: 'high',
      blockPolicy: 'security',
    }
  }

  const prefix = guardCallOptions?.inputUserQuestionPrefix
  const useSplitInput =
    context === 'input' &&
    typeof prefix === 'string' &&
    prefix.length > 0 &&
    message.length > prefix.length &&
    message.startsWith(prefix)

  const pairedUser = guardCallOptions?.outputPairedUserContent?.trim() ?? ''

  let messagesForGuard: Array<{ role: string; content: string }>
  if (useSplitInput) {
    messagesForGuard = buildGuardMessagesFromAugmentedUserTurn(message, prefix!)
  } else if (context === 'output' && pairedUser.length > 0) {
    messagesForGuard = [
      { role: 'user', content: pairedUser },
      { role: 'assistant', content: message },
    ]
  } else {
    messagesForGuard = [
      {
        role: context === 'output' ? 'assistant' : 'user',
        content: message,
      },
    ]
  }

  if (process.env.NODE_ENV !== 'production' && !projectId) {
    console.warn(
      '[Lakera Guard] No project_id — Lakera applies the default policy, not your project policy. Set Project ID in Settings or LAKERA_PROJECT_ID.',
    )
  }

  try {
    const posted = await postLakeraGuard({
      guardUrl,
      lakeraKey: lakeraKey.trim(),
      messages: messagesForGuard,
      projectId,
      metadata,
    })

    if (!posted.ok) {
      console.error('Lakera API error:', posted.status)
      if (config.lakeraFailClosed) {
        return {
          scanned: true,
          flagged: true,
          categories: { lakera_api_error: true },
          message: `Security scan unavailable (${posted.status}). Request blocked (fail-closed).`,
          threatLevel: 'high',
        }
      }
      if (preScan.detected && preScan.severity === 'medium') {
        return {
          scanned: true,
          flagged: true,
          categories: {
            prompt_injection: true,
            ...patternsToCategoryRecord(preScan.patterns),
          },
          message: `Potential security threat detected: ${preScan.patterns.join(', ')}. Message blocked.`,
          threatLevel: 'medium',
        }
      }
      return {
        scanned: false,
        flagged: false,
        message: `Lakera API error: ${posted.status}`,
      }
    }

    const extracted = extractAggregatedFromLakeraResponse(posted.data)
    let flagged = extracted.flagged
    let categories = extracted.categories
    const scores = extracted.scores
    let payload = extracted.payload
    let breakdown = extracted.breakdown
    const requestUuid = extracted.requestUuid

    if (process.env.NODE_ENV !== 'production') {
      if (breakdown && breakdown.length > 0) {
        console.log('Lakera Guard Breakdown:', {
          request_uuid: requestUuid,
          totalDetectors: breakdown.length,
          detectedCount: breakdown.filter((d) => d.detected).length,
          detectors: breakdown.map((d) => ({
            id: d.detector_id,
            type: d.detector_type,
            detected: d.detected,
          })),
        })
      }
      if (payload && payload.length > 0) {
        console.log('Lakera Guard Payload (Detected Threats):', {
          request_uuid: requestUuid,
          totalMatches: payload.length,
          matches: payload.map((p) => ({
            text: p.text.substring(0, 50) + (p.text.length > 50 ? '...' : ''),
            detector: p.detector_type,
            labels: p.labels,
            position: `${p.start}-${p.end}`,
          })),
        })
      }
    }

    if (preScan.detected && !flagged) {
      if (preScan.severity === 'high' || preScan.severity === 'medium') {
        flagged = true
        categories = {
          ...categories,
          prompt_injection: true,
          ...patternsToCategoryRecord(preScan.patterns),
        }
      }
    }

    const effective = mergeLakeraEffectiveFlag({
      flagged,
      categories,
      payload,
      breakdown,
    })
    flagged = effective.flagged
    categories = effective.categories

    if (context === 'output' && !flagged && message.trim() && detectStructuredSensitiveLeakInAssistantOutput(message)) {
      flagged = true
      categories = {
        ...(categories || {}),
        pii: true,
        structured_sensitive_output: true,
      }
    }

    const threatCategories = categories
      ? sortLakeraThreatCategoriesForDisplay(
          Object.entries(categories)
            .filter(([, value]) => value)
            .map(([key]) => key),
        )
      : []

    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    const classification = classifyLakeraBlock({ categories, payload, breakdown })
    let blockPolicy: LakeraBlockPolicy | undefined

    if (flagged) {
      blockPolicy = classification.policy
      const hasHighRiskCategories = threatCategories.some((cat) => {
        const c = cat.toLowerCase()
        return (
          ['prompt_injection', 'jailbreak', 'system_override', 'pii', 'structured_sensitive_output'].includes(c) ||
          c.includes('phi') ||
          c.includes('medical')
        )
      })
      const maxScore = scores ? Math.max(...Object.values(scores)) : 0

      if (hasHighRiskCategories || maxScore > 0.8) {
        threatLevel = 'critical'
      } else if (maxScore > 0.6 || preScan.severity === 'high') {
        threatLevel = 'high'
      } else if (maxScore > 0.4 || preScan.severity === 'medium') {
        threatLevel = 'medium'
      }
      if (classification.hasContentModeration && !hasHighRiskCategories && threatLevel === 'critical') {
        threatLevel = 'high'
      }
    }

    const ctx: 'input' | 'output' = context === 'output' ? 'output' : 'input'
    return {
      scanned: true,
      flagged,
      categories,
      scores,
      message: flagged
        ? buildLakeraChatBlockMessage(ctx, classification, threatCategories)
        : 'No threats detected',
      threatLevel,
      payload,
      breakdown,
      requestUuid,
      blockPolicy,
    }
  } catch (error) {
    console.error('Lakera check failed:', error)
    if (config.lakeraFailClosed) {
      return {
        scanned: true,
        flagged: true,
        categories: { lakera_client_error: true },
        message: 'Security scan failed. Request blocked (fail-closed).',
        threatLevel: 'high',
      }
    }
    if (preScan.detected && preScan.severity === 'high') {
      return {
        scanned: true,
        flagged: true,
        categories: {
          prompt_injection: true,
          ...patternsToCategoryRecord(preScan.patterns),
        },
        message: `Security threat detected: ${preScan.patterns.join(', ')}. Message blocked.`,
        threatLevel: 'high',
      }
    }
    return {
      scanned: false,
      flagged: false,
      message: error instanceof Error ? error.message : 'Scan failed',
    }
  }
}

/** Align file scan / upload with client /api/scan truncation rules */
export function prepareContentForFileScan(
  fileContent: unknown,
  fileName?: string,
): { contentToScan: string; isBase64Placeholder: boolean } {
  const fc = fileContent
  const isBase64 =
    typeof fc === 'string' &&
    fc.length > 100 &&
    !fc.includes(' ') &&
    !fc.includes('\n') &&
    /^[A-Za-z0-9+/=]+$/.test(fc.substring(0, 100))

  if (isBase64) {
    const ext = fileName?.split('.').pop()?.toUpperCase() || 'UNKNOWN'
    return {
      contentToScan: `[Binary file upload: ${fileName || 'unnamed'}] File type: ${ext}. Content: Binary data (base64 encoded).`,
      isBase64Placeholder: true,
    }
  }

  let contentToScan = String(fc ?? '')
  const maxLength = 50000
  if (contentToScan.length > maxLength) {
    const start = contentToScan.substring(0, maxLength / 2)
    const end = contentToScan.substring(contentToScan.length - maxLength / 2)
    contentToScan = `${start}\n\n...[content truncated for scanning - file too large]...\n\n${end}`
  }
  if (!contentToScan.trim()) {
    contentToScan = `[Empty file: ${fileName || 'unnamed'}]`
  }
  return { contentToScan, isBase64Placeholder: false }
}

export interface FileScreenResult {
  scanned: boolean
  flagged: boolean
  categories?: Record<string, boolean>
  scores?: Record<string, number>
  payload?: LakeraApiResponse['payload']
  breakdown?: LakeraApiResponse['breakdown']
  threatLevel: 'low' | 'medium' | 'high' | 'critical'
  lakeraHttpStatus?: number
  lakeraErrorDetails?: Record<string, unknown> | string | null
  /** True when Guard was not called or network/parse failed without fail-closed block */
  lakeraSkipped?: boolean
  requestUuid?: string
  /** When block came from local pre-scan (regex) before Guard */
  prescanPatterns?: string[]
}

/**
 * Single user-message file / upload screening (used by /api/scan and server-side store).
 */
export async function screenTextAsFileUpload(args: {
  contentToScan: string
  lakeraKey: string
  lakeraEndpoint?: string
  lakeraProjectId?: string | null
  metadata?: GuardMetadata
  /** Extra category names treated as high-risk for threat level (e.g. code_injection) */
  extraHighRiskCategories?: string[]
}): Promise<FileScreenResult> {
  const preScan = detectCommonInjectionPatterns(args.contentToScan)

  if (preScan.detected && preScan.severity === 'high') {
    return {
      scanned: true,
      flagged: true,
      categories: {
        prompt_injection: true,
        system_override: true,
        ...patternsToCategoryRecord(preScan.patterns),
      },
      threatLevel: 'high',
      prescanPatterns: preScan.patterns,
    }
  }

  const guardUrl = resolveLakeraGuardEndpoint(args.lakeraEndpoint)
  const projectId = lakeraProjectIdForGuard(args.lakeraProjectId ?? undefined)

  try {
    const posted = await postLakeraGuard({
      guardUrl,
      lakeraKey: args.lakeraKey.trim(),
      messages: [{ role: 'user', content: args.contentToScan }],
      projectId,
      metadata: args.metadata,
    })

    if (!posted.ok) {
      if (config.lakeraFailClosed) {
        return {
          scanned: true,
          flagged: true,
          categories: { lakera_api_error: true },
          threatLevel: 'high',
          lakeraHttpStatus: posted.status,
          lakeraErrorDetails: posted.errorDetails ?? null,
        }
      }
      if (preScan.detected && (preScan.severity === 'high' || preScan.severity === 'medium')) {
        return {
          scanned: true,
          flagged: true,
          categories: {
            prompt_injection: true,
            ...patternsToCategoryRecord(preScan.patterns),
          },
          threatLevel: preScan.severity === 'high' ? 'high' : 'medium',
          lakeraHttpStatus: posted.status,
          lakeraErrorDetails: posted.errorDetails ?? null,
          prescanPatterns: preScan.patterns,
        }
      }
      return {
        scanned: false,
        flagged: false,
        threatLevel: 'low',
        lakeraSkipped: true,
        lakeraHttpStatus: posted.status,
        lakeraErrorDetails: posted.errorDetails ?? null,
      }
    }

    const extracted = extractAggregatedFromLakeraResponse(posted.data)
    let flagged = extracted.flagged
    let categories = extracted.categories
    const scores = extracted.scores
    let payload = extracted.payload
    let breakdown = extracted.breakdown

    if (process.env.NODE_ENV !== 'production') {
      if (breakdown && breakdown.length > 0) {
        console.log('Lakera Guard Breakdown (file):', {
          request_uuid: extracted.requestUuid,
          totalDetectors: breakdown.length,
          detectedCount: breakdown.filter((d) => d.detected).length,
        })
      }
    }

    if (preScan.detected && !flagged) {
      if (preScan.severity === 'high' || preScan.severity === 'medium') {
        flagged = true
        categories = {
          ...categories,
          prompt_injection: true,
          ...patternsToCategoryRecord(preScan.patterns),
        }
      }
    }

    const effective = mergeLakeraEffectiveFlag({
      flagged,
      categories,
      payload,
      breakdown,
    })
    flagged = effective.flagged
    categories = effective.categories

    const extras = args.extraHighRiskCategories ?? ['code_injection']
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (flagged) {
      const catKeys = categories ? Object.keys(categories) : []
      const hasHighRisk =
        catKeys.some((cat) =>
          ['prompt_injection', 'jailbreak', 'system_override', 'pii', ...extras].includes(cat.toLowerCase()),
        )
      const maxScore = scores && Object.keys(scores).length > 0 ? Math.max(...Object.values(scores)) : 0

      if (hasHighRisk || maxScore > 0.8 || preScan.severity === 'high') {
        threatLevel = 'critical'
      } else if (maxScore > 0.6 || preScan.severity === 'medium') {
        threatLevel = 'high'
      } else if (maxScore > 0.4) {
        threatLevel = 'medium'
      }
    }

    return {
      scanned: true,
      flagged,
      categories,
      scores,
      payload,
      breakdown,
      threatLevel,
      requestUuid: extracted.requestUuid,
    }
  } catch (error) {
    console.error('Lakera file screen failed:', error)
    if (config.lakeraFailClosed) {
      return {
        scanned: true,
        flagged: true,
        categories: { lakera_client_error: true },
        threatLevel: 'high',
      }
    }
    return {
      scanned: false,
      flagged: false,
      threatLevel: 'low',
      lakeraSkipped: true,
    }
  }
}
