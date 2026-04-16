/**
 * Apple Numbers (.numbers) to CSV conversion via LibreOffice headless.
 * Produces one CSV per sheet; each CSV is parsed into row chunks with sheet metadata.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { parseCsvToChunks, type CsvRowChunk } from './csv-parser'

const execFileAsync = promisify(execFile)

export interface NumbersSheetChunk {
  text: string
  metadata: {
    source_type: 'numbers'
    original_filename: string
    derived_sheet: string
    row_number: number
    chunk_type: 'numbers_csv_row'
    file_id: string
    type: 'csv_row'
    chunk_type_legacy: 'csv_row'
    column_count: number
    row_hash: string
  }
}

export interface NumbersConversionResult {
  success: boolean
  sheets: Array<{ sheetName: string; csvContent: string }>
  error?: string
}

const SOFFICE_NAMES = ['soffice', 'libreoffice']

/**
 * Detect soffice on PATH. Prefer LibreOffice's soffice.
 */
async function findSoffice(): Promise<string | null> {
  const pathEnv = process.env.PATH ?? ''
  const pathSep = process.platform === 'win32' ? ';' : ':'
  const dirs = pathEnv.split(pathSep)
  for (const name of SOFFICE_NAMES) {
    for (const dir of dirs) {
      const candidate = path.join(dir, name)
      try {
        await fs.access(candidate, fs.constants.X_OK)
        return candidate
      } catch {
        if (process.platform === 'win32') {
          const exe = path.join(dir, `${name}.exe`)
          try {
            await fs.access(exe, fs.constants.X_OK)
            return exe
          } catch {
            // continue
          }
        }
      }
    }
  }
  return null
}

/**
 * Convert .numbers buffer to one or more CSV files using LibreOffice headless.
 * Writes to temp dir, runs soffice --convert-to csv, reads all *.csv from outdir.
 */
export async function convertNumbersToCsv(
  fileId: string,
  numbersBuffer: Buffer,
  originalFilename: string
): Promise<NumbersConversionResult> {
  const soffice = await findSoffice()
  if (!soffice) {
    return {
      success: false,
      sheets: [],
      error:
        'Numbers conversion requires LibreOffice (soffice). Install with: sudo apt-get install -y libreoffice (Linux) or brew install libreoffice (macOS).',
    }
  }

  const tmpBase = path.join(os.tmpdir(), `numbers-${fileId.replace(/[^a-zA-Z0-9_.-]/g, '_')}`)
  const numbersPath = path.join(tmpBase, 'input.numbers')
  const outDir = tmpBase

  try {
    await fs.mkdir(outDir, { recursive: true, mode: 0o755 })
    await fs.writeFile(numbersPath, numbersBuffer, { mode: 0o644 })

    await execFileAsync(
      soffice,
      [
        '--headless',
        '--norestore',
        '--invisible',
        '--nodefault',
        '--nolockcheck',
        '--convert-to',
        'csv',
        '--outdir',
        outDir,
        numbersPath,
      ],
      { timeout: 120000, maxBuffer: 50 * 1024 * 1024 }
    )

    const entries = await fs.readdir(outDir, { withFileTypes: true })
    const csvFiles = entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.csv'))
      .map(e => path.join(outDir, e.name))
      .sort()

    const sheets: Array<{ sheetName: string; csvContent: string }> = []
    for (const csvPath of csvFiles) {
      const csvContent = await fs.readFile(csvPath, 'utf-8')
      const sheetName = path.basename(csvPath, '.csv')
      sheets.push({ sheetName, csvContent })
    }

    return { success: true, sheets }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      sheets: [],
      error: `LibreOffice conversion failed: ${message}. Ensure soffice is installed (soffice --version).`,
    }
  } finally {
    try {
      await fs.rm(tmpBase, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Parse converted CSV sheets into row chunks with Numbers-specific metadata.
 * Chunk text format: "Sheet: <name> | Row N | col1: val1 | ..."
 */
export function parseNumbersSheetsToChunks(
  sheets: Array<{ sheetName: string; csvContent: string }>,
  fileId: string,
  originalFilename: string
): NumbersSheetChunk[] {
  const chunks: NumbersSheetChunk[] = []
  for (const { sheetName, csvContent } of sheets) {
    const rowChunks: CsvRowChunk[] = parseCsvToChunks(csvContent, fileId)
    for (const r of rowChunks) {
      const text = `Sheet: ${sheetName} | ${r.text}`
      chunks.push({
        text,
        metadata: {
          source_type: 'numbers',
          original_filename: originalFilename,
          derived_sheet: sheetName,
          row_number: r.metadata.row_number,
          chunk_type: 'numbers_csv_row',
          file_id: fileId,
          type: 'csv_row',
          chunk_type_legacy: 'csv_row',
          column_count: r.metadata.column_count,
          row_hash: r.metadata.row_hash,
        },
      })
    }
  }
  return chunks
}

/**
 * Full pipeline: convert .numbers buffer to row chunks.
 * Returns chunks or throws/returns error if soffice missing or conversion fails.
 */
export async function numbersBufferToChunks(
  fileId: string,
  numbersBuffer: Buffer,
  originalFilename: string
): Promise<{ chunks: NumbersSheetChunk[]; error?: string }> {
  const result = await convertNumbersToCsv(fileId, numbersBuffer, originalFilename)
  if (!result.success || result.sheets.length === 0) {
    return { chunks: [], error: result.error ?? 'No CSV sheets produced from Numbers file.' }
  }
  const chunks = parseNumbersSheetsToChunks(result.sheets, fileId, originalFilename)
  return { chunks }
}
