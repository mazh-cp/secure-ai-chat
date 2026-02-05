/**
 * Markdown parser for RAG: section-level chunks with heading hierarchy preserved.
 * Splits by ## / ### headings; preserves lists and tables (tables as readable rows).
 */

import { normalizeAndValidateChunkText } from './normalize'

export interface MarkdownSectionChunk {
  text: string
  metadata: {
    type: 'markdown_section'
    heading_path: string[]
    file_id: string
    section_index: number
  }
}

/**
 * Detect markdown table (line of | ... |) and convert to readable rows.
 */
function formatTableBlock(tableText: string): string {
  const lines = tableText.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return tableText
  const sep = lines.findIndex((l) => /^\s*\|?[-:\s|]+\|?\s*$/.test(l))
  if (sep < 0) return tableText
  const headerCells = lines[0].split('|').map((c) => c.trim()).filter(Boolean)
  const rows: string[] = []
  for (let i = sep + 1; i < lines.length; i++) {
    const cells = lines[i].split('|').map((c) => c.trim()).filter(Boolean)
    if (cells.length === 0) continue
    const rowStr = headerCells.map((h, j) => `${h}: ${cells[j] ?? ''}`).join(' | ')
    rows.push(rowStr)
  }
  return rows.length ? `Table:\n${rows.join('\n')}` : tableText
}

/**
 * Format a code block for context: "Code Block (language=js): ..."
 */
function formatCodeBlock(_full: string, lang?: string, code?: string): string {
  const l = (lang ?? '').trim() || 'text'
  const c = (code ?? '').trim().slice(0, 2000)
  return `Code Block (language=${l}):\n${c}`
}

/**
 * Parse markdown into sections by headings (# ## ###). Preserve heading path.
 */
export function parseMarkdownToChunks(
  fileContent: string,
  fileId: string
): MarkdownSectionChunk[] {
  const normalized = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const sections: { headingPath: string[]; content: string }[] = []
  const headingStack: { level: number; title: string }[] = []

  const headingRe = /^(#{1,6})\s+(.+)$/
  const codeBlockRe = /```(\w*)\n([\s\S]*?)```/g
  const lines = normalized.split('\n')
  let currentContent: string[] = []
  let currentPath: string[] = []

  function flushSection() {
    if (currentContent.length === 0) return
    let text = currentContent.join('\n').trim()
    text = text.replace(codeBlockRe, formatCodeBlock)
    if (/^\s*\|/m.test(text)) text = formatTableBlock(text)
    const validated = normalizeAndValidateChunkText(text)
    if (validated) {
      sections.push({ headingPath: [...currentPath], content: validated })
    }
    currentContent = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headingMatch = line.match(headingRe)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      flushSection()
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop()
      }
      headingStack.push({ level, title })
      currentPath = headingStack.map((h) => h.title)
      currentContent.push(`Section: ${'#'.repeat(level)} ${title}`)
      continue
    }
    currentContent.push(line)
  }
  flushSection()

  return sections.map((s, idx) => ({
    text: s.content,
    metadata: {
      type: 'markdown_section' as const,
      heading_path: s.headingPath,
      file_id: fileId,
      section_index: idx,
    },
  }))
}
