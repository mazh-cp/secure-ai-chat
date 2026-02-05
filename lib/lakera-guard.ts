/**
 * Lakera Guard wrapper: single entry point for ingestion, retrieval, and chat input/output scanning.
 * Delegates to lib/security/lakera and lib/security/rag-scan so RAG flow stays consistent.
 */

import { scanTextWithLakera, getLakeraApiKey, type LakeraScanResult } from './security/lakera'
import { scanIngestion, scanRetrieval, scanGeneration, type ScanMeta } from './security/rag-scan'

export const LAKERA_ENABLED = !!getLakeraApiKey()

/**
 * Scan multiple chunks (e.g. at ingestion or retrieval). Returns only chunks that pass; drops flagged.
 */
export async function guardMany(
  chunks: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>,
  meta: ScanMeta & { layer?: 'ingestion' | 'retrieval' }
): Promise<{ safeChunks: typeof chunks; droppedCount: number }> {
  if (chunks.length === 0) return { safeChunks: [], droppedCount: 0 }
  if (meta.layer === 'ingestion') {
    const results = await Promise.all(
      chunks.map(async (c) => {
        const r = await scanIngestion(c.text, { ...meta, docId: c.metadata?.docId as string })
        return { chunk: c, allowed: r.allowed }
      })
    )
    const safeChunks = results.filter((r) => r.allowed).map((r) => r.chunk)
    return { safeChunks, droppedCount: chunks.length - safeChunks.length }
  }
  const result = await scanRetrieval(chunks, meta)
  return { safeChunks: result.safeChunks, droppedCount: result.droppedCount }
}

/**
 * Scan single text (user input or model output).
 */
export async function guardText(
  text: string,
  context: 'input' | 'output',
  meta?: { ip_address?: string; user_id?: string; session_id?: string; internal_request_id?: string }
): Promise<LakeraScanResult> {
  return scanTextWithLakera({
    text,
    context,
    source: context === 'input' ? 'chat' : 'chat_output',
    meta,
  })
}

export type { ScanMeta }
export { scanIngestion, scanRetrieval, scanGeneration, getLakeraApiKey }
