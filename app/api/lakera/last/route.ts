import { NextResponse } from 'next/server'
import { getLakeraLastGuardSnapshot } from '@/lib/lakera-guard-last'

/**
 * GET /api/lakera/last
 * Returns the last Lakera Guard decision recorded by this process.
 * Useful for operator dashboards, live debugging, and verifying Guard is active.
 * Note: in multi-instance deployments, each process has its own snapshot.
 */
export async function GET() {
  const snap = getLakeraLastGuardSnapshot()
  if (!snap) {
    return NextResponse.json({ snapshot: null, note: 'No Guard decision recorded yet in this process.' })
  }
  return NextResponse.json({ snapshot: snap })
}
