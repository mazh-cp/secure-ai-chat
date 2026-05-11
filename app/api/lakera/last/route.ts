import { NextRequest, NextResponse } from 'next/server'

import { requireSecureChatSession } from '@/lib/app-login'
import { getLakeraLastGuardSnapshot } from '@/lib/lakera-guard-last'

/**
 * GET — Best-effort snapshot of the last Lakera Guard evaluation on this Node process
 * (similar to guard-demo-client `GET /lakera/last`). Not shared across horizontal replicas.
 */
export async function GET(request: NextRequest) {
  const auth = requireSecureChatSession(request)
  if (auth) return auth

  const last = getLakeraLastGuardSnapshot()
  return NextResponse.json({
    ok: true,
    last,
    note: 'Single-process memory only; use for demos and single-instance ops.',
  })
}
