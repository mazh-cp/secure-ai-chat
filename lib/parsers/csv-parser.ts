/**
 * CSV parser for RAG: row-level chunks with structured text and metadata.
 * Handles quoted fields (RFC 4180 style). One row = one chunk; rows > 2000 chars split by columns.
 */

import crypto from 'crypto'
import { formatTabularRowAsFields } from '@/lib/tabular-field-projection'
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
    headers: string[]
    row_record: Record<string, string>
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
 * Each chunk: one line per column (Row N + "Header: value" lines) for independent fields.
 */
export function parseCsvToChunks(fileContent: string, fileId: string): CsvRowChunk[] {
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
    let rowText = formatTabularRowAsFields(r, row, headers)
    if (rowText.length > MAX_ROW_CHARS) {
      const cap = headers.slice(0, Math.min(12, headers.length))
      const shortRow: Record<string, string> = {}
      for (const h of cap) shortRow[h] = (row[h] ?? '').slice(0, 200)
      rowText = `${formatTabularRowAsFields(r, shortRow, cap)}\n[truncated]`
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
        headers,
        row_record: { ...row },
      },
    })
  }
  return chunks
}

/**
 * Parse delimiter-separated tabular text (comma or tab) into the same row chunks as CSV.
 * Used for Excel sheet_to_csv output and TSV files.
 */
export function parseDelimitedTableToChunks(
  raw: string,
  fileId: string,
  delimiter: ',' | '\t'
): CsvRowChunk[] {
  const lines = delimiter === '\t' ? splitTsvLines(raw) : splitCsvLines(raw)
  if (lines.length < 2) return []

  const splitLine = delimiter === '\t' ? parseTsvLine : parseCsvLine
  const headerLine = lines[0]
  const headers = splitLine(headerLine)
  const columnCount = headers.length
  const chunks: CsvRowChunk[] = []

  for (let r = 1; r < lines.length; r++) {
    const values = splitLine(lines[r])
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    let rowText = formatTabularRowAsFields(r, row, headers)
    if (rowText.length > MAX_ROW_CHARS) {
      const cap = headers.slice(0, Math.min(12, headers.length))
      const shortRow: Record<string, string> = {}
      for (const h of cap) shortRow[h] = (row[h] ?? '').slice(0, 200)
      rowText = `${formatTabularRowAsFields(r, shortRow, cap)}\n[truncated]`
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
        headers,
        row_record: { ...row },
      },
    })
  }
  return chunks
}

function parseTsvLine(line: string): string[] {
  return line.split('\t').map(c => c.trim())
}

function splitTsvLines(raw: string): string[] {
  return raw.split(/\r?\n/).filter(l => l.trim().length > 0)
}

/** If the first line has multiple tabs and few commas, treat as TSV; else CSV. */
export function parseAutoDelimitedTableToChunks(raw: string, fileId: string): CsvRowChunk[] {
  const first = raw.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
  const tabCount = (first.match(/\t/g) ?? []).length
  const commaCount = (first.match(/,/g) ?? []).length
  if (tabCount >= 2 && tabCount >= commaCount) {
    return parseDelimitedTableToChunks(raw, fileId, '\t')
  }
  return parseCsvToChunks(raw, fileId)
}
