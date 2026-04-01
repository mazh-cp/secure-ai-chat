import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId, isSharedOrgCorpusMode } from '@/lib/owner'

/**
 * GET /api/owner
 * Returns the current owner_id (and sets the cookie if new).
 * When shared_org_corpus is true, SHARED_ORG_OWNER_ID is set — all browsers share one file/RAG corpus.
 */
export async function GET(request: NextRequest) {
  const { ownerId } = await getOwnerId(request)
  return NextResponse.json({
    owner_id: ownerId,
    shared_org_corpus: isSharedOrgCorpusMode(),
  })
}
