/**
 * Turn stored file bytes into searchable UTF-8 text for RAG (DOCX/PDF/XLSX).
 * CSV/JSON/TXT stay on readOwnerFile string path in rag-context.
 *
 * Excel text uses exceljs (not the unmaintained `xlsx` package) to avoid known
 * prototype-pollution / ReDoS advisories on user-supplied workbooks.
 */

import type { RegistryFile } from '@/lib/registry/files-registry'

function ext(name: string): string {
  return ('.' + (name.split('.').pop() || '')).toLowerCase()
}

/** Best-effort string for RAG from an ExcelJS cell value */
function cellValueToString(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map(r => r.text ?? '').join('')
    }
    if (typeof o.text === 'string') return o.text
    if ('result' in o && o.result != null) return String(o.result)
    if ('hyperlink' in o && typeof o.text === 'string') return o.text
  }
  return ''
}

export async function extractTextFromBinaryForRag(
  fileMeta: Pick<RegistryFile, 'name' | 'type'>,
  buffer: Buffer | null
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
    // Legacy BIFF .xls is not supported (avoids vulnerable SheetJS-style parsers).
    if (e === '.xls' && !t.includes('spreadsheetml')) {
      console.warn(
        '[RAG] Legacy Excel .xls is not indexed for RAG; save as .xlsx for extraction:',
        fileMeta.name
      )
      return null
    }
    const canTryOoxml = e === '.xlsx' || e === '.xlsm' || t.includes('spreadsheetml')
    if (!canTryOoxml) {
      return null
    }
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      // exceljs .d.ts Buffer predates Node 22+ generic Buffer; value is a byte buffer at runtime
      await wb.xlsx.load(Buffer.from(buffer) as never)
      const parts: string[] = []
      for (const worksheet of wb.worksheets) {
        const lines: string[] = []
        worksheet.eachRow(row => {
          const cells: string[] = []
          row.eachCell({ includeEmpty: true }, cell => {
            cells.push(cellValueToString(cell.value))
          })
          if (cells.some(c => c.length > 0)) {
            lines.push(cells.join('\t'))
          }
        })
        const block = lines.join('\n').trim()
        if (block.length > 0) {
          parts.push(`--- Sheet: ${worksheet.name} ---\n${block}`)
        }
      }
      const text = parts.join('\n\n').trim()
      return text.length > 0 ? text : null
    } catch (err) {
      console.warn('[RAG] exceljs read failed for', fileMeta.name, err)
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
