/**
 * Tabular RAG: treat each spreadsheet/CSV column as its own field, and optionally
 * project rows to a subset of columns from the user question (e.g. name-only).
 */

export type TabularProjection = { mode: 'all' } | { mode: 'name_only'; allowedHeaders: string[] }

function wantsAllDetailsQuery(q: string): boolean {
  const s = q.trim()
  if (
    /\b(list|show|export|dump|print)\s+(all|every)\b/i.test(s) ||
    /\b(all|every)\s+(columns?|fields?|rows?)\b/i.test(s)
  ) {
    return true
  }
  if (/\b(summarize|summary|overview)\s+(of\s+)?(the\s+)?(file|data|spreadsheet|upload)/i.test(s)) return true
  return /\b(all|full|complete|entire|everything)\s+(details?|profile|record|information|data|fields?)\b/i.test(s)
}

/** Headers that look like a person's name (not "company name", etc.). */
const NAME_HEADER_RES = [
  /^first\s*name$/i,
  /^last\s*name$/i,
  /^given\s*name$/i,
  /^family\s*name$/i,
  /^surname$/i,
  /^(preferred\s*)?name$/i,
]

function isNameLikeHeader(h: string): boolean {
  const t = h.trim()
  if (!t) return false
  if (/\bcompany\b|\bemployer\s+name\b/i.test(t)) return false
  return NAME_HEADER_RES.some((re) => re.test(t))
}

/**
 * From the user query, decide whether retrieved tabular rows should expose only name columns.
 * Name-only when the question is clearly about a person's name and not a broad data request.
 */
export function resolveTabularProjection(query: string, headers: string[]): TabularProjection {
  const q = query.trim()
  if (!q || headers.length === 0) return { mode: 'all' }
  if (wantsAllDetailsQuery(q)) return { mode: 'all' }

  const nameHeaders = headers.filter(isNameLikeHeader)
  if (nameHeaders.length === 0) return { mode: 'all' }

  const qLower = q.toLowerCase()
  const asksName =
    /\b(first|last|given|family|sur)\s*name\b/i.test(q) ||
    /\bwhat\s*[’']?s\s+.{0,60}\s+name\b/i.test(q) ||
    /\bwhat\s+is\s+.{0,60}\s+name\b/i.test(q) ||
    /\b(his|her|their)\s+name\b/i.test(q) ||
    /\bname\s+of\s+/i.test(q) ||
    /\bonly\s+(the\s+)?name\b/i.test(qLower) ||
    /\bjust\s+(the\s+)?name\b/i.test(qLower)

  if (!asksName) return { mode: 'all' }

  return { mode: 'name_only', allowedHeaders: nameHeaders }
}

export function formatTabularRowAsFields(
  rowNumber: number,
  row: Record<string, string>,
  headers: string[],
  allowedHeaders?: string[],
): string {
  const use = allowedHeaders?.length ? headers.filter((h) => allowedHeaders.includes(h)) : headers
  const lines = use.map((h) => `${h}: ${row[h] ?? ''}`)
  return `Row ${rowNumber}\n${lines.join('\n')}`
}
