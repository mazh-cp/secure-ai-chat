import type { GuardChatScanResult } from '@/lib/lakera/guard-client'

/**
 * When LAKERA_GUARD_MONITORING_ONLY=1, chat continues even after a Guard flag.
 * Hard-blocks still apply for: local regex prescan hits and infrastructure errors.
 * Intended for policy calibration during staged rollout — not for hardened production.
 */
export function lakeraChatFlagAllowedInMonitoringMode(r: GuardChatScanResult): boolean {
  if (!r.flagged || !r.scanned) return false
  const msg = r.message ?? ''
  // Always block local prescan hits — these never reach the Guard API
  if (msg.startsWith('Security threat detected:')) return false
  if (msg.startsWith('Potential security threat detected:')) return false
  // Always block infrastructure categories (missing project, API error, client error)
  const c = r.categories ?? {}
  if (c.lakera_project_required || c.lakera_api_error || c.lakera_client_error) return false
  // Guard flagged — allow through in monitoring mode only
  return true
}
