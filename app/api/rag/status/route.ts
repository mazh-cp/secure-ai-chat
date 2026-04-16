export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { listFiles } from '@/lib/registry/files-registry'
import { getOwnerId } from '@/lib/owner'
import { buildForensicContext, logForensic } from '@/lib/forensic-log'

/**
 * GET /api/rag/status
 * Returns RAG readiness for the same owner_id scope as /api/files/list and chat.
 */
export async function GET(request: NextRequest) {
  try {
    const { ownerId } = await getOwnerId(request)
    const files = listFiles({ owner_id: ownerId })
    const total = files.length

    const ctx = buildForensicContext(
      request,
      ownerId,
      total,
      files.map(f => f.id)
    )
    logForensic('rag/status', ctx)

    if (process.env.NODE_ENV !== 'production') {
      const registryTotal = listFiles().length
      if (total === 0 && registryTotal > 0) {
        console.warn('[RAG status mismatch]', {
          owner_id: ownerId,
          registry_count: registryTotal,
          scoped_count: total,
        })
      }
    }
    const indexed = files.filter(f => f.rag_indexed_at).length
    const ready = total > 0
    const filesDetail = files.map(f => {
      const scanDetails = (f.scanDetails ?? {}) as Record<string, unknown>
      const chunksCount =
        typeof scanDetails.rag_chunk_count === 'number' ? scanDetails.rag_chunk_count : 1
      const sourceType =
        f.type?.includes('csv') || f.name?.endsWith('.csv')
          ? 'csv'
          : f.type?.includes('markdown') || f.name?.endsWith('.md')
            ? 'markdown'
            : f.type?.includes('apple.numbers') || f.name?.endsWith('.numbers')
              ? 'numbers'
              : 'other'
      const embeddingsCount = chunksCount
      return {
        file_id: f.id,
        name: f.name,
        source_type: sourceType,
        chunks_clean_count: chunksCount,
        embeddings_count: embeddingsCount,
        last_indexed_at: f.rag_indexed_at ?? null,
        ready: embeddingsCount > 0,
      }
    })
    return NextResponse.json(
      {
        status: ready ? 'ready' : 'no_files',
        healthy: true,
        totalFiles: total,
        indexedFiles: indexed,
        files: filesDetail,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('RAG status error:', error)
    return NextResponse.json(
      {
        status: 'error',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
