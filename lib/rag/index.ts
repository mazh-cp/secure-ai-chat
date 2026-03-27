/**
 * RAG indexing: extract text → scanIngestion → chunk → embed → upsert (Secure RAG - Phase B).
 *
 * Phase B: Module boundary and interfaces. Phase D will add:
 * - Real text extraction (PDF, DOCX, etc.)
 * - scanIngestion gate (if blocked: quarantine, do not index)
 * - Embeddings adapter + vector store upsert
 * - Idempotency by content hash (re-upload = no duplicate)
 */

import crypto from 'crypto'
import { chunkText, type TextChunk, type ChunkingOptions } from './chunking'
import { scanIngestion, type ScanMeta } from '@/lib/security/rag-scan'

export interface IndexResult {
  success: boolean
  docId: string
  chunksIndexed: number
  quarantined?: boolean
  reason?: string
}

export interface EmbeddingsAdapter {
  embed(texts: string[]): Promise<number[][]>
}

export interface VectorStoreAdapter {
  upsert(vectors: number[][], chunks: TextChunk[]): Promise<void>
  deleteByDocId(docId: string): Promise<void>
}

/**
 * Placeholder: no vector store in Phase B. Phase D will plug in real adapter.
 */
let embeddingsAdapter: EmbeddingsAdapter | null = null
let vectorStoreAdapter: VectorStoreAdapter | null = null

export function setEmbeddingsAdapter(adapter: EmbeddingsAdapter | null): void {
  embeddingsAdapter = adapter
}

export function setVectorStoreAdapter(adapter: VectorStoreAdapter | null): void {
  vectorStoreAdapter = adapter
}

/**
 * Hash content for idempotency (same content = same hash, re-upload does not duplicate).
 */
export function contentHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
}

/**
 * Ingest document: extract text (caller responsibility in Phase B), scan, chunk, embed, upsert.
 *
 * 1) Extract text (caller passes extracted text).
 * 2) scanIngestion(text) via Lakera → if blocked, return quarantined and STOP.
 * 3) Chunk cleaned text.
 * 4) Embed chunks (if adapter set); upsert to vector store (if adapter set).
 *
 * Phase B: Only scan + chunk; no embed/upsert until Phase D.
 */
export async function ingestDocument(
  extractedText: string,
  meta: ScanMeta & { filename: string; docId: string; tenantId?: string }
): Promise<IndexResult> {
  const docId = meta.docId

  // 1) Scan at ingestion
  const scanResult = await scanIngestion(extractedText, {
    docId: meta.docId,
    filename: meta.filename,
    tenantId: meta.tenantId,
    userId: meta.userId,
    sessionId: meta.sessionId,
    ipAddress: meta.ipAddress,
    source: meta.source ?? 'file_upload',
    lakeraApiKeyOverride: meta.lakeraApiKeyOverride,
    lakeraEndpointOverride: meta.lakeraEndpointOverride,
    lakeraProjectIdOverride: meta.lakeraProjectIdOverride,
  })

  if (!scanResult.allowed) {
    return {
      success: false,
      docId,
      chunksIndexed: 0,
      quarantined: true,
      reason: 'Content blocked by security policy (ingestion scan).',
    }
  }

  // 2) Chunk
  const opts: ChunkingOptions = {
    docId: meta.docId,
    filename: meta.filename,
    tenantId: meta.tenantId,
  }
  const chunks = chunkText(extractedText, opts)

  if (chunks.length === 0) {
    return {
      success: true,
      docId,
      chunksIndexed: 0,
      reason: 'No chunks produced (empty or too short).',
    }
  }

  // 3) Embed + upsert (Phase D)
  if (embeddingsAdapter && vectorStoreAdapter) {
    const texts = chunks.map((c) => c.text)
    const vectors = await embeddingsAdapter.embed(texts)
    await vectorStoreAdapter.upsert(vectors, chunks)
  }

  return {
    success: true,
    docId,
    chunksIndexed: chunks.length,
  }
}

/**
 * Remove document from RAG (vector store / chunks) by file_id.
 * No-op if no vector store adapter is set.
 */
export async function removeDocumentFromRAG(docId: string): Promise<void> {
  if (vectorStoreAdapter) {
    await vectorStoreAdapter.deleteByDocId(docId)
  }
}
