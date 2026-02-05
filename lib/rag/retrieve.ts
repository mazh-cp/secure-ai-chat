/**
 * RAG retrieval: embed question → query vector store → filters → scanRetrieval → optional rerank (Secure RAG - Phase B).
 *
 * Phase B: Interface and placeholder. Phase D will add:
 * - Embed query, topK 8–15, metadata filters (tenantId, doc allowlist, classification)
 * - scanRetrieval on retrieved chunks; drop/redact flagged
 * - Optional rerank (cosine + keyword + recency)
 * - NOT_ENOUGH_CONTEXT when <2 safe chunks or low confidence
 */

import { scanRetrieval, type ScanMeta } from '@/lib/security/rag-scan'

export interface RetrievedChunk {
  id: string
  text: string
  metadata?: Record<string, unknown>
  score?: number
}

export interface RetrieveResult {
  chunks: RetrievedChunk[]
  notEnoughContext: boolean
  droppedBySecurity: number
  tainted: boolean
}

export interface VectorStoreQueryAdapter {
  query(vector: number[], topK: number, filters?: Record<string, unknown>): Promise<RetrievedChunk[]>
}

let vectorStoreQueryAdapter: VectorStoreQueryAdapter | null = null

export function setVectorStoreQueryAdapter(adapter: VectorStoreQueryAdapter | null): void {
  vectorStoreQueryAdapter = adapter
}

/**
 * Retrieve chunks for a question: query store (if adapter set), then scanRetrieval.
 * If no store or <2 safe chunks after scan → notEnoughContext.
 */
export async function retrieve(
  question: string,
  meta: ScanMeta & { tenantId?: string; topK?: number },
  options?: {
    embed?: (text: string) => Promise<number[]>
    filters?: Record<string, unknown>
  }
): Promise<RetrieveResult> {
  const topK = meta.topK ?? 12

  if (!vectorStoreQueryAdapter || !options?.embed) {
    return {
      chunks: [],
      notEnoughContext: true,
      droppedBySecurity: 0,
      tainted: false,
    }
  }

  const queryVector = await options.embed(question)
  const rawChunks = await vectorStoreQueryAdapter.query(
    queryVector,
    Math.min(topK + 5, 20),
    options.filters
  )

  const chunksForScan = rawChunks.map((c) => ({
    id: c.id,
    text: c.text,
    metadata: c.metadata,
  }))

  const scanResult = await scanRetrieval(chunksForScan, meta)
  const safeChunks: RetrievedChunk[] = scanResult.safeChunks.map((c) => ({
    id: c.id,
    text: c.text,
    metadata: c.metadata,
  }))

  const notEnoughContext = safeChunks.length < 2 || scanResult.tainted

  return {
    chunks: safeChunks,
    notEnoughContext,
    droppedBySecurity: scanResult.droppedCount,
    tainted: scanResult.tainted,
  }
}
