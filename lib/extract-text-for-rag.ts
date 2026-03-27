/**
 * Turn stored file bytes into searchable UTF-8 text for RAG (DOCX/PDF/XLSX).
 * CSV/JSON/TXT stay on readOwnerFile string path in rag-context.
 */

import type { RegistryFile } from '@/lib/registry/files-registry'

function ext(name: string): string {
  return ('.' + (name.split('.').pop() || '')).toLowerCase()
}

export async function extractTextFromBinaryForRag(
  fileMeta: Pick<RegistryFile, 'name' | 'type'>,
  buffer: Buffer | null,
): Promise<string | null> {
  if (!buffer || buffer.length === 0) return null
  const e = ext(fileMeta.name)
  const t = (fileMeta.type || '').toLowerCase()

  const isDocx =
    t.includes('wordprocessing') || t.includes('msword') || e === '.docx' || e === '.doc'
  const isPdf = t.includes('pdf') || e === '.pdf'
  const isExcel =
    e === '.xlsx' ||
    e === '.xls' ||
    e === '.xlsm' ||
    t.includes('spreadsheetml') ||
    t.includes('ms-excel') ||
    t.includes('vnd.ms-excel')

  if (isExcel) {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const parts: string[] = []
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName]
        if (!sheet) continue
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) {
          parts.push(`--- Sheet: ${sheetName} ---\n${csv}`)
        }
      }
      const text = parts.join('\n\n').trim()
      return text.length > 0 ? text : null
    } catch (err) {
      console.warn('[RAG] xlsx read failed for', fileMeta.name, err)
      return null
    }
  }

  if (isDocx) {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value?.trim()
      return text && text.length > 0 ? text : null
    } catch (err) {
      console.warn('[RAG] mammoth extract failed for', fileMeta.name, err)
      return null
    }
  }

  if (isPdf) {
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const textResult = await parser.getText()
        const text = textResult.text?.trim()
        return text && text.length > 0 ? text : null
      } finally {
        await parser.destroy()
      }
    } catch (err) {
      console.warn('[RAG] pdf-parse failed for', fileMeta.name, err)
      return null
    }
  }

  return null
}
