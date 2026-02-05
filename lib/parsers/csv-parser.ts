/**
 * CSV parser for RAG: row-level chunks with structured text and metadata.
 * Handles quoted fields (RFC 4180 style). One row = one chunk; rows > 2000 chars split by columns.
 */

import crypto from 'crypto'
import { normalizeAndValidateChunkText } from './normalize'

export interface CsvRowChunk {
  text: string
  metadata: {
    type: 'csv_row'
    chunk_type: 'csv_row'
    row_number: number
    file_id: string
    column_count: number
    row_hash: string
  }
}

/**
 * Parse a single CSV line respecting quoted fields (handles commas and newlines inside quotes).
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (inQuotes) {
      current += c
      continue
    }
    if (c === ',') {
      result.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
      continue
    }
    current += c
  }
  result.push(current.trim().replace(/^"|"$/g, ''))
  return result
}

/**
 * Split raw CSV content into lines, handling quoted newlines.
 */
function splitCsvLines(raw: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '"') {
      inQuotes = !inQuotes
      current += c
      continue
    }
    if (!inQuotes && (c === '\n' || c === '\r')) {
      const next = raw[i + 1]
      if (c === '\r' && next === '\n') i++
      if (current.trim()) lines.push(current)
      current = ''
      continue
    }
    current += c
  }
  if (current.trim()) lines.push(current)
  return lines
}

function rowHash(row: string[]): string {
  return crypto.createHash('sha256').update(row.join('|'), 'utf8').digest('hex').slice(0, 12)
}

const MAX_ROW_CHARS = 2000

/**
 * Parse CSV content into row-level chunks. First row = headers.
 * Each chunk: "Row N | Header1: value1 | Header2: value2 | ..."
 */
export function parseCsvToChunks(
  fileContent: string,
  fileId: string
): CsvRowChunk[] {
  const lines = splitCsvLines(fileContent)
  if (lines.length < 2) return []

  const headerLine = lines[0]
  const headers = parseCsvLine(headerLine)
  const columnCount = headers.length
  const chunks: CsvRowChunk[] = []

  for (let r = 1; r < lines.length; r++) {
    const values = parseCsvLine(lines[r])
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    const parts = headers.map((h) => `${h}: ${row[h] ?? ''}`)
    let rowText = `Row ${r} | ${parts.join(' | ')}`
    if (rowText.length > MAX_ROW_CHARS) {
      const safeParts = headers.slice(0, Math.min(10, headers.length)).map((h) => `${h}: ${(row[h] ?? '').slice(0, 200)}`)
      rowText = `Row ${r} | ${safeParts.join(' | ')} | [truncated]`
    }
    const normalized = normalizeAndValidateChunkText(rowText)
    if (!normalized) continue
    const hash = rowHash(values)
    chunks.push({
      text: normalized,
      metadata: {
        type: 'csv_row',
        chunk_type: 'csv_row',
        row_number: r,
        file_id: fileId,
        column_count: columnCount,
        row_hash: hash,
      },
    })
  }
  return chunks
}
