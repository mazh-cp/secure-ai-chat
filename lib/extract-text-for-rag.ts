/**
 * Turn stored file bytes into searchable UTF-8 text for RAG (DOCX/PDF).
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
