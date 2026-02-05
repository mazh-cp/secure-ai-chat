/**
 * Server-side forensic logging for file/registry debugging.
 * Log request_id, owner_id, cookie presence (never cookie value), registry_count, fileIds (first 3).
 */

import type { NextRequest } from 'next/server'

const LOG_PREFIX = '[persist]'

export interface ForensicContext {
  request_id: string
  owner_id: string
  cookie_present: boolean
  namespace?: string
  registry_count: number
  fileIds: string[]
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Build forensic context from request and current registry stats.
 * Do NOT log cookie value; only cookie_present true/false.
 */
export function buildForensicContext(
  request: NextRequest | null,
  ownerId: string,
  registryCount: number,
  fileIds: string[],
  namespace?: string
): ForensicContext {
  const cookieHeader = request?.headers.get('cookie')
  return {
    request_id: randomId(),
    owner_id: ownerId,
    cookie_present: Boolean(cookieHeader != null && cookieHeader.length > 0),
    namespace: namespace ?? undefined,
    registry_count: registryCount,
    fileIds: fileIds.slice(0, 3),
  }
}

/**
 * Log forensic context (server-side only). Use for store, list, rag/status, chat.
 */
export function logForensic(route: string, ctx: ForensicContext): void {
  if (process.env.NODE_ENV === 'production') return
  console.log(LOG_PREFIX, route, JSON.stringify(ctx))
}
