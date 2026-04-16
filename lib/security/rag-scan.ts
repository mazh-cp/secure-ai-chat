/**
 * 3-layer RAG scan orchestration (Secure RAG - Phase B boundary).
 *
 * - scanIngestion: before indexing (file upload / doc ingest).
 * - scanRetrieval: on retrieved chunks before passing to LLM.
 * - scanGeneration: on final answer before returning to user.
 *
 * Phase C will wire these to Lakera + rag-policy; Phase B provides the interface.
 */

import { scanTextWithLakera, type LakeraScanInput, type LakeraScanResult } from './lakera'
import { applyPolicy, type ScanLayer, type PolicyDecision } from '@/lib/policies/rag-policy'
import { recordLakeraGuardAudit } from '@/lib/lakera-guard-audit'

function categoriesListToRecord(categories: string[]): Record<string, boolean> {
  return Object.fromEntries(categories.map(c => [c, true]))
}

export type ScanMeta = {
  userId?: string
  sessionId?: string
  ipAddress?: string
  docId?: string
  filename?: string
  tenantId?: string
  source?: string
  /** Prefer server keys from getApiKeys(); overrides env when set (e.g. chat RAG / embed). */
  lakeraApiKeyOverride?: string
  lakeraEndpointOverride?: string
  lakeraProjectIdOverride?: string | null
}

export interface IngestionScanResult {
  allowed: boolean
  decision: PolicyDecision
  lakeraResult?: LakeraScanResult
  auditRecord: {
    docId?: string
    layer: ScanLayer
    outcome: string
    categories: string[]
    severity: string
    timestamp: string
  }
}

export interface RetrievalScanResult {
  /** Chunks that passed the scan (safe to send to LLM). */
  safeChunks: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>
  /** Chunks that were dropped or redacted. */
  droppedCount: number
  /** Whether retrieval is considered tainted (too many drops). */
  tainted: boolean
  auditRecord: { layer: ScanLayer; outcome: string; droppedCount: number; timestamp: string }
}

export interface GenerationScanResult {
  allowed: boolean
  decision: PolicyDecision
  lakeraResult?: LakeraScanResult
  /** Safe message to show user when blocked. */
  safeMessage?: string
  auditRecord: {
    layer: ScanLayer
    outcome: string
    categories: string[]
    severity: string
    timestamp: string
  }
}

/**
 * Scan content at ingestion (before indexing).
 * If blocked: do not index; store quarantine record.
 */
export async function scanIngestion(text: string, meta: ScanMeta): Promise<IngestionScanResult> {
  const lakeraInput: LakeraScanInput = {
    text,
    context: 'ingestion',
    source: meta.source ?? 'file_upload',
    meta: {
      docId: meta.docId,
      filename: meta.filename,
      tenantId: meta.tenantId,
      ip_address: meta.ipAddress,
      user_id: meta.userId,
      session_id: meta.sessionId,
    },
    lakeraApiKeyOverride: meta.lakeraApiKeyOverride,
    lakeraEndpointOverride: meta.lakeraEndpointOverride,
    lakeraProjectIdOverride: meta.lakeraProjectIdOverride,
  }

  const lakeraResult = await scanTextWithLakera(lakeraInput)
  const decision = applyPolicy('ingestion', lakeraResult.severity, lakeraResult.categories)
  const allowed = decision === 'allow' || decision === 'allow_restricted'

  const auditRecord = {
    docId: meta.docId,
    layer: 'ingestion' as ScanLayer,
    outcome: allowed ? 'allowed' : 'blocked',
    categories: lakeraResult.categories,
    severity: lakeraResult.severity,
    timestamp: new Date().toISOString(),
  }

  if (lakeraResult.requestUuid) {
    let projectId: string | null | undefined = meta.lakeraProjectIdOverride ?? undefined
    if (projectId === undefined) {
      const { getApiKeys } = await import('@/lib/api-keys-storage')
      projectId = (await getApiKeys()).lakeraProjectId ?? null
    }
    recordLakeraGuardAudit({
      context: 'rag_ingestion',
      projectId,
      requestUuid: lakeraResult.requestUuid,
      flagged: lakeraResult.flagged,
      categories:
        lakeraResult.categories.length > 0
          ? categoriesListToRecord(lakeraResult.categories)
          : undefined,
      breakdown: lakeraResult.breakdown,
      internalRequestId: meta.sessionId,
      userId: meta.userId,
      sessionId: meta.sessionId,
      ip: meta.ipAddress,
    }).catch(() => {})
  }

  return {
    allowed,
    decision,
    lakeraResult,
    auditRecord,
  }
}

/**
 * Scan retrieved chunks before passing to LLM.
 * Drops or redacts flagged chunks; marks retrieval tainted if too many dropped.
 */
export async function scanRetrieval(
  chunks: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>,
  meta: ScanMeta
): Promise<RetrievalScanResult> {
  const safeChunks: typeof chunks = []
  let droppedCount = 0

  for (const chunk of chunks) {
    const lakeraInput: LakeraScanInput = {
      text: chunk.text,
      context: 'retrieval',
      source: meta.source ?? 'rag_retrieval',
      meta: {
        docId: chunk.metadata?.docId as string | undefined,
        tenantId: meta.tenantId,
        ip_address: meta.ipAddress,
        user_id: meta.userId,
        session_id: meta.sessionId,
      },
      lakeraApiKeyOverride: meta.lakeraApiKeyOverride,
      lakeraEndpointOverride: meta.lakeraEndpointOverride,
      lakeraProjectIdOverride: meta.lakeraProjectIdOverride,
    }

    const result = await scanTextWithLakera(lakeraInput)
    const decision = applyPolicy('retrieval', result.severity, result.categories)

    if (decision === 'allow' || decision === 'allow_restricted') {
      safeChunks.push(chunk)
    } else {
      droppedCount++
      if (result.requestUuid) {
        let projectId: string | null | undefined = meta.lakeraProjectIdOverride ?? undefined
        if (projectId === undefined) {
          const { getApiKeys } = await import('@/lib/api-keys-storage')
          projectId = (await getApiKeys()).lakeraProjectId ?? null
        }
        recordLakeraGuardAudit({
          context: 'rag_retrieval',
          projectId,
          requestUuid: result.requestUuid,
          flagged: true,
          categories:
            result.categories.length > 0 ? categoriesListToRecord(result.categories) : undefined,
          breakdown: result.breakdown,
          userId: meta.userId,
          sessionId: meta.sessionId,
          ip: meta.ipAddress,
        }).catch(() => {})
      }
    }
  }

  const tainted = droppedCount > 0 && safeChunks.length < 2

  return {
    safeChunks,
    droppedCount,
    tainted,
    auditRecord: {
      layer: 'retrieval',
      outcome: tainted ? 'tainted' : 'ok',
      droppedCount,
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Scan generated answer before returning to user.
 * If blocked: return safe refusal message and do not show raw answer.
 */
export async function scanGeneration(
  answer: string,
  meta: ScanMeta
): Promise<GenerationScanResult> {
  const lakeraInput: LakeraScanInput = {
    text: answer,
    context: 'generation',
    source: meta.source ?? 'rag_generation',
    meta: {
      ip_address: meta.ipAddress,
      user_id: meta.userId,
      session_id: meta.sessionId,
    },
    lakeraApiKeyOverride: meta.lakeraApiKeyOverride,
    lakeraEndpointOverride: meta.lakeraEndpointOverride,
    lakeraProjectIdOverride: meta.lakeraProjectIdOverride,
  }

  const lakeraResult = await scanTextWithLakera(lakeraInput)
  const decision = applyPolicy('generation', lakeraResult.severity, lakeraResult.categories)
  const allowed = decision === 'allow' || decision === 'allow_restricted'

  const safeMessage =
    'This response was blocked by the content security policy. Please rephrase your question or try a different topic.'

  return {
    allowed,
    decision,
    lakeraResult,
    safeMessage: allowed ? undefined : safeMessage,
    auditRecord: {
      layer: 'generation',
      outcome: allowed ? 'allowed' : 'blocked',
      categories: lakeraResult.categories,
      severity: lakeraResult.severity,
      timestamp: new Date().toISOString(),
    },
  }
}
