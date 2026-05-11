import type { GuardChatScanResult } from '@/lib/lakera/guard-client'

/**
 * When `LAKERA_GUARD_MONITORING_ONLY=1`, chat may continue after a Lakera-style flag.
 * We still hard-block local regex prescan hits and infrastructure errors (no Guard policy eval).
 */
export function lakeraChatFlagAllowedInMonitoringMode(r: GuardChatScanResult): boolean {
  if (!r.flagged || !r.scanned) return false
  const msg = r.message ?? ''
  if (msg.startsWith('Security threat detected:')) return false
  if (msg.startsWith('Potential security threat detected:')) return false
  const c = r.categories ?? {}
  if (c.lakera_project_required || c.lakera_api_error || c.lakera_client_error) return false
  return true
}
