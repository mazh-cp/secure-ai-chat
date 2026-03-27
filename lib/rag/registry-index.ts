/**
 * Index a file into RAG after store: ingestDocument by file_id.
 * Updates registry rag_indexed_at on success.
 */

import { ingestDocument } from './index'
import { updateFileMetadata } from '@/lib/registry/files-registry'

export async function indexFileForRAG(
  fileId: string,
  fileContent: string,
  fileName: string,
  meta?: {
    owner_id?: string
    session_id?: string
    ipAddress?: string
    lakeraApiKeyOverride?: string
    lakeraEndpointOverride?: string
    lakeraProjectIdOverride?: string | null
  }
): Promise<{ indexed: boolean; quarantined?: boolean }> {
  const result = await ingestDocument(fileContent, {
    docId: fileId,
    filename: fileName,
    userId: meta?.owner_id ?? undefined,
    sessionId: meta?.session_id ?? undefined,
    ipAddress: meta?.ipAddress ?? undefined,
    source: 'file_upload',
    lakeraApiKeyOverride: meta?.lakeraApiKeyOverride,
    lakeraEndpointOverride: meta?.lakeraEndpointOverride,
    lakeraProjectIdOverride: meta?.lakeraProjectIdOverride,
  })
  if (result.quarantined) {
    return { indexed: false, quarantined: true }
  }
  if (result.success && result.chunksIndexed >= 0) {
    updateFileMetadata(fileId, { rag_indexed_at: new Date().toISOString() })
    return { indexed: true }
  }
  return { indexed: false }
}
