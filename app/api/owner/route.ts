import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'

/**
 * GET /api/owner
 * Returns the current owner_id (and sets the cookie if new).
 * Client should call this once, store owner_id (e.g. sessionStorage), and send
 * X-Client-ID: <owner_id> on requests to /api/files/list, /api/files/store, /api/rag/status, /api/chat.
 */
export async function GET(request: NextRequest) {
  const { ownerId } = await getOwnerId(request)
  return NextResponse.json({ owner_id: ownerId })
}
