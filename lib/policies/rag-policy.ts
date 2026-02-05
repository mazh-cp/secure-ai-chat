/**
 * RAG security policy: thresholds, actions, allow/block rules (Secure RAG - Phase B).
 *
 * - HIGH (or categories: prompt_injection, system_override, data_poisoning):
 *   ingestion → QUARANTINE / do not index
 *   retrieval → DROP chunk, mark tainted
 *   generation → BLOCK response, return safe message
 * - MEDIUM: ingestion → allow_restricted or require approval; retrieval → redact; generation → allow with stricter grounding
 * - LOW: allow
 *
 * Always create an audit event record (docId/userId/layer/outcome/categories/severity/timestamp; no sensitive content).
 */

export type ScanLayer = 'ingestion' | 'retrieval' | 'generation'

export type PolicyDecision =
  | 'allow'
  | 'allow_restricted'
  | 'quarantine'
  | 'drop'
  | 'block'

export type PolicySeverity = 'low' | 'medium' | 'high'

const HIGH_RISK_CATEGORIES = ['prompt_injection', 'jailbreak', 'system_override', 'data_poisoning']

function isHighRiskCategory(categories: string[]): boolean {
  return categories.some((c) => HIGH_RISK_CATEGORIES.includes(c.toLowerCase()))
}

/**
 * Apply policy for a given layer, severity, and categories.
 * Returns the decision (allow, allow_restricted, quarantine, drop, block).
 */
export function applyPolicy(
  layer: ScanLayer,
  severity: PolicySeverity,
  categories: string[]
): PolicyDecision {
  const highRisk = severity === 'high' || isHighRiskCategory(categories)

  if (highRisk) {
    switch (layer) {
      case 'ingestion':
        return 'quarantine'
      case 'retrieval':
        return 'drop'
      case 'generation':
        return 'block'
      default:
        return 'block'
    }
  }

  if (severity === 'medium') {
    switch (layer) {
      case 'ingestion':
        return 'allow_restricted'
      case 'retrieval':
        return 'allow_restricted'
      case 'generation':
        return 'allow_restricted'
      default:
        return 'allow_restricted'
    }
  }

  return 'allow'
}

export interface AuditEvent {
  docId?: string
  userId?: string
  tenantId?: string
  layer: ScanLayer
  outcome: string
  categories: string[]
  severity: string
  timestamp: string
}

/**
 * Create an audit event record (no sensitive content).
 * Caller is responsible for persisting (e.g. system log or telemetry).
 */
export function createAuditEvent(params: {
  docId?: string
  userId?: string
  tenantId?: string
  layer: ScanLayer
  outcome: string
  categories: string[]
  severity: string
}): AuditEvent {
  return {
    docId: params.docId,
    userId: params.userId,
    tenantId: params.tenantId,
    layer: params.layer,
    outcome: params.outcome,
    categories: params.categories,
    severity: params.severity,
    timestamp: new Date().toISOString(),
  }
}
