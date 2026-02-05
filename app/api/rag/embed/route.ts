export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'
import { listFiles } from '@/lib/registry/files-registry'
import { readOwnerFile } from '@/lib/persistent-storage'
import { indexFileForRAG } from '@/lib/rag/registry-index'

/** GET not supported; use POST to index from storage. */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to index files from storage.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}

/**
 * POST /api/rag/embed - Index files into RAG from persistent storage (not client content).
 * Body: { fileIds?: string[] } — if omitted, indexes all non-deleted files for the owner.
 * Reads bytes from ./data/uploads/<ownerId>/<fileId> and upserts into RAG index.
 */
export async function POST(request: NextRequest) {
  try {
    const { ownerId } = await getOwnerId(request)
    const owner = ownerId ?? ''
    const body = await request.json().catch(() => ({}))
    const fileIds = body.fileIds as string[] | undefined

    const files = fileIds?.length
      ? listFiles({ owner_id: owner }).filter((f) => fileIds.includes(f.id))
      : listFiles({ owner_id: owner })

    const results: { fileId: string; indexed: boolean; quarantined?: boolean; error?: string }[] = []

    for (const file of files) {
      try {
        const content = await readOwnerFile(owner, file.id)
        if (content === null) {
          results.push({ fileId: file.id, indexed: false, error: 'File content not found' })
          continue
        }
        const result = await indexFileForRAG(file.id, content, file.name, {
          owner_id: owner,
          session_id: file.session_id ?? undefined,
        })
        results.push({
          fileId: file.id,
          indexed: result.indexed,
          quarantined: result.quarantined,
        })
      } catch (err) {
        results.push({
          fileId: file.id,
          indexed: false,
          error: err instanceof Error ? err.message : 'Index failed',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Embed completed',
      results,
      total: results.length,
      indexed: results.filter((r) => r.indexed).length,
    })
  } catch (error) {
    console.error('RAG embed error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Embed failed' },
      { status: 500 }
    )
  }
}
