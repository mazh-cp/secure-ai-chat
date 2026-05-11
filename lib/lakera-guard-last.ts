/**
 * Best-effort in-process snapshot of the last Lakera Guard decision (demo-style `GET /lakera/last`).
 * In multi-instance deployments each Node process has its own snapshot only.
 */

import type { GuardChatScanResult } from '@/lib/lakera/guard-client'

export type SanitizedLakeraDecision = {
  scanned: boolean
  flagged: boolean
  requestUuid?: string
  threatLevel?: string
  blockPolicy?: string
  categoryKeys?: string[]
}

export type LakeraLastGuardRecord = {
  recordedAt: string
  source: 'chat_input' | 'chat_output' | 'lakera_verify'
  guardHostname: string
  inputScope?: 'raw' | 'augmented'
  monitoringOnly?: boolean
  decision: SanitizedLakeraDecision
}

let last: LakeraLastGuardRecord | null = null

export function sanitizeGuardChatScanForClient(r: GuardChatScanResult): SanitizedLakeraDecision {
  const categoryKeys = r.categories
    ? Object.keys(r.categories).filter(k => r.categories![k])
    : undefined
  return {
    scanned: r.scanned,
    flagged: r.flagged,
    requestUuid: r.requestUuid,
    threatLevel: r.threatLevel,
    blockPolicy: r.blockPolicy,
    categoryKeys: categoryKeys && categoryKeys.length > 0 ? categoryKeys : undefined,
  }
}

export function recordLakeraLastGuard(entry: LakeraLastGuardRecord): void {
  last = entry
}

export function getLakeraLastGuardSnapshot(): LakeraLastGuardRecord | null {
  return last
}
