/**
 * RAG answer: generate response grounded in retrieved chunks, citations, then scanGeneration (Secure RAG - Phase B).
 *
 * - Generate strictly from retrieved chunks.
 * - Citations per key claim (chunkId + doc label).
 * - "Not found in uploaded documents" when not supported by sources.
 * - scanGeneration on final answer; if blocked, return safe refusal UX.
 *
 * Phase B: Interface and helpers. Phase D will wire to LLM; Phase F will add citations UI.
 */

import { scanGeneration, type ScanMeta } from '@/lib/security/rag-scan'
import type { RetrievedChunk } from './retrieve'

export interface Citation {
  chunkId: string
  docLabel: string
  excerpt?: string
  page?: number
}

export interface AnswerResult {
  answer: string
  citations: Citation[]
  blocked: boolean
  safeMessage?: string
  notEnoughContext: boolean
}

/**
 * Build context string for LLM from retrieved chunks (with source labels for citation).
 */
export function buildContextFromChunks(chunks: RetrievedChunk[]): string {
  return chunks
    .map(c => {
      const label = (c.metadata?.filename as string) ?? c.id
      const page = c.metadata?.page as number | undefined
      const part = page != null ? ` [${label}, page ${page}]` : ` [${label}]`
      return `[${c.id}]${part}\n${c.text}`
    })
    .join('\n\n---\n\n')
}

/**
 * Build citation list from chunk metadata (Phase F will use for UI).
 */
export function buildCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map(c => ({
    chunkId: c.id,
    docLabel: (c.metadata?.filename as string) ?? c.id,
    excerpt: c.text.slice(0, 150) + (c.text.length > 150 ? '...' : ''),
    page: c.metadata?.page as number | undefined,
  }))
}

/**
 * After generating an answer, run scanGeneration and optionally replace with safe message.
 */
export async function scanAndSanitizeAnswer(
  answer: string,
  meta: ScanMeta
): Promise<{ answer: string; blocked: boolean; safeMessage?: string }> {
  const result = await scanGeneration(answer, meta)
  if (result.allowed) {
    return { answer, blocked: false }
  }
  return {
    answer: result.safeMessage ?? 'This response was blocked by the content security policy.',
    blocked: true,
    safeMessage: result.safeMessage,
  }
}

/**
 * Placeholder: actual LLM call happens in Phase D (chat route or dedicated answer route).
 * Returns structure for Phase F (citations, blocked, notEnoughContext).
 */
export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  meta: ScanMeta,
  options?: {
    generate?: (context: string, question: string) => Promise<string>
  }
): Promise<AnswerResult> {
  const notEnoughContext = chunks.length < 2

  if (notEnoughContext) {
    return {
      answer:
        'Not enough context from uploaded documents to answer. Please upload more relevant files or rephrase.',
      citations: [],
      blocked: false,
      notEnoughContext: true,
    }
  }

  const context = buildContextFromChunks(chunks)
  const citations = buildCitations(chunks)

  let rawAnswer: string
  if (options?.generate) {
    rawAnswer = await options.generate(context, question)
  } else {
    rawAnswer = 'Not found in uploaded documents.' // Phase D will call LLM
  }

  const sanitized = await scanAndSanitizeAnswer(rawAnswer, meta)

  return {
    answer: sanitized.answer,
    citations,
    blocked: sanitized.blocked,
    safeMessage: sanitized.safeMessage,
    notEnoughContext: false,
  }
}
