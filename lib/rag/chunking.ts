/**
 * RAG chunking: clean text, chunk by structure/token-length, attach metadata (Secure RAG - Phase B).
 *
 * - Clean: remove boilerplate headers/footers, de-dup repeated lines, normalize whitespace.
 * - Chunk by headings/semantic boundaries when possible; fallback to token-length chunks.
 * - Target ~300–700 tokens per chunk, overlap 50–100 tokens (configurable).
 * - Each chunk gets metadata: docId, filename, sectionTitle, page?, createdAt, tenantId, classification, chunkIndex.
 */

export interface ChunkMetadata {
  docId: string
  filename: string
  sectionTitle?: string
  page?: number
  createdAt: string
  tenantId?: string
  classification?: string
  chunkIndex: number
}

export interface TextChunk {
  id: string
  text: string
  metadata: ChunkMetadata
}

/** Approximate tokens per chunk (configurable). */
const DEFAULT_CHUNK_SIZE = 500
/** Overlap in tokens. */
const DEFAULT_OVERLAP = 75

/** Rough chars per token for Latin text. */
const CHARS_PER_TOKEN = 4

/**
 * Clean text: remove boilerplate, de-dup repeated lines, normalize whitespace.
 */
export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return ''

  let out = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // De-dup consecutive identical lines
  const lines = out.split('\n')
  const deduped: string[] = []
  let prev = ''
  for (const line of lines) {
    const t = line.trim()
    if (t && t !== prev) {
      deduped.push(line)
      prev = t
    }
  }
  out = deduped.join('\n')

  // Remove common boilerplate patterns (best-effort)
  out = out
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*confidential\s*$/gim, '')
    .replace(/^\s*page\s+\d+\s*$/gim, '')
    .trim()

  return out
}

/**
 * Estimate token count (rough).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Split text by heading-like boundaries (##, ###, or lines that look like titles).
 */
function splitByHeadings(text: string): string[] {
  const parts: string[] = []
  const lines = text.split('\n')
  let current: string[] = []

  for (const line of lines) {
    const isHeading =
      /^#{1,6}\s/.test(line) ||
      /^[A-Z][^.!?]*:\s*$/.test(line.trim()) ||
      /^[IVXLC]+\.\s+/.test(line.trim())

    if (isHeading && current.length > 0) {
      parts.push(current.join('\n').trim())
      current = []
    }
    current.push(line)
  }

  if (current.length > 0) {
    parts.push(current.join('\n').trim())
  }

  return parts.filter(p => p.length > 0)
}

/**
 * Split text into fixed-size chunks with overlap (by char length ~ tokens).
 */
function splitByTokenLength(
  text: string,
  chunkSizeTokens: number,
  overlapTokens: number
): string[] {
  const chunkSize = chunkSizeTokens * CHARS_PER_TOKEN
  const overlap = overlapTokens * CHARS_PER_TOKEN
  const step = chunkSize - overlap
  const chunks: string[] = []

  for (let i = 0; i < text.length; i += step) {
    const slice = text.slice(i, i + chunkSize)
    if (slice.trim().length > 0) {
      chunks.push(slice.trim())
    }
  }

  return chunks
}

export interface ChunkingOptions {
  chunkSizeTokens?: number
  overlapTokens?: number
  docId: string
  filename: string
  sectionTitle?: string
  page?: number
  tenantId?: string
  classification?: string
}

/**
 * Chunk cleaned text; prefer heading boundaries, then token-length split.
 * Returns chunks with stable ids and metadata.
 */
export function chunkText(text: string, options: ChunkingOptions): TextChunk[] {
  const cleaned = cleanText(text)
  if (!cleaned) return []

  const chunkSizeTokens = options.chunkSizeTokens ?? DEFAULT_CHUNK_SIZE
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP
  const createdAt = new Date().toISOString()

  const byHeadings = splitByHeadings(cleaned)
  const rawChunks: string[] = []

  for (const part of byHeadings) {
    const estimated = estimateTokens(part)
    if (estimated <= chunkSizeTokens * 1.2) {
      rawChunks.push(part)
    } else {
      rawChunks.push(...splitByTokenLength(part, chunkSizeTokens, overlapTokens))
    }
  }

  if (rawChunks.length === 0 && cleaned.length > 0) {
    rawChunks.push(...splitByTokenLength(cleaned, chunkSizeTokens, overlapTokens))
  }

  return rawChunks.map((t, i) => ({
    id: `${options.docId}:${i}`,
    text: t,
    metadata: {
      docId: options.docId,
      filename: options.filename,
      sectionTitle: options.sectionTitle,
      page: options.page,
      createdAt,
      tenantId: options.tenantId,
      classification: options.classification,
      chunkIndex: i,
    },
  }))
}
