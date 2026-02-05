/**
 * Normalize chunk text before Lakera scan and embedding.
 * - Trim excessive whitespace
 * - Normalize line endings
 * - Remove zero-width characters
 * - Enforce minimum length (skip noise)
 */

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u00AD]/g
const MIN_CHUNK_LENGTH = 20

export function normalizeChunkText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  let out = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(ZERO_WIDTH, '')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return out
}

/**
 * Returns normalized text if it passes minimum length; otherwise null (skip chunk).
 */
export function normalizeAndValidateChunkText(text: string): string | null {
  const normalized = normalizeChunkText(text)
  if (normalized.length < MIN_CHUNK_LENGTH) return null
  return normalized
}
