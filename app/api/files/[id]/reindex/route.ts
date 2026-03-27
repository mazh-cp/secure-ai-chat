export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getById, updateFileMetadata } from '@/lib/registry/files-registry'
import { readOwnerFile } from '@/lib/persistent-storage'
import { removeDocumentFromRAG } from '@/lib/rag/index'
import { indexFileForRAG } from '@/lib/rag/registry-index'
import { getApiKeys } from '@/lib/api-keys-storage'
import { getUserIP } from '@/lib/logging'

/**
 * POST /api/files/:id/reindex - Rebuild RAG index for a file (reads from storage).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'File id is required' }, { status: 400 })
    }
    const file = getById(id)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const owner = file.owner_id ?? ''
    const content = await readOwnerFile(owner, id)
    if (content === null) {
      return NextResponse.json({ error: 'File content not found' }, { status: 404 })
    }

    // Mark as queued during reindex
    updateFileMetadata(id, { rag_indexed_at: null })
    await removeDocumentFromRAG(id)
    const keys = await getApiKeys()
    const result = await indexFileForRAG(id, content, file.name, {
      owner_id: file.owner_id ?? undefined,
      session_id: file.session_id ?? undefined,
      ipAddress: getUserIP(request),
      lakeraApiKeyOverride: keys.lakeraAiKey ?? undefined,
      lakeraEndpointOverride: keys.lakeraEndpoint ?? undefined,
      lakeraProjectIdOverride: keys.lakeraProjectId ?? undefined,
    })

    return NextResponse.json({
      success: true,
      fileId: id,
      indexed: result.indexed,
      quarantined: result.quarantined ?? false,
      message: result.indexed ? 'RAG index rebuilt' : result.quarantined ? 'Content quarantined by policy' : 'Reindex completed with no chunks',
    })
  } catch (error) {
    console.error('Failed to reindex file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reindex file' },
      { status: 500 }
    )
  }
}
