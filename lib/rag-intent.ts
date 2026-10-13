/**
 * Decides whether a chat message should pull context from uploaded files (RAG).
 * General-knowledge questions ("what is cholesterol") stay model-only; lookups about
 * people, records or the uploaded documents ("who is taking cholesterol medication") use RAG.
 */

const DOCUMENT_REFERENCE =
  /\b(my|our|the|these|this|uploaded|attached)\s+(files?|documents?|docs?|uploads?|csv|spreadsheets?|sheets?|excel|pdfs?|reports?|records?|data(set)?|tables?|results?|list|roster|notes?)\b/i

const EXPLICIT_SOURCE =
  /\b(in|from|within|according\s+to|based\s+on|using)\s+(the\s+|my\s+|our\s+)?(files?|documents?|uploads?|csv|spreadsheets?|data|records?|reports?)\b/i

const PERSON_LOOKUP = [
  /\bwho\s+(is|are|was|were|has|have|had|takes?|uses?|works?|deals?|got|needs?|else)\b/i,
  /\bwhich\s+(people|persons?|patients?|employees?|users?|customers?|clients?|members?|staff|individuals?|ones?|of\s+them)\b/i,
  /\b(list|find|show|name|identify|get|give\s+me)\s+(me\s+)?(all\s+|the\s+|any\s+)?(people|persons?|patients?|employees?|users?|customers?|clients?|members?|staff|individuals?|names?|records?|rows?|entries)\b/i,
  /\bhow\s+many\s+(people|persons?|patients?|employees?|users?|customers?|clients?|members?|records?|rows?|entries|of\s+them)\b/i,
  /\b(anyone|anybody|someone|somebody|everyone|everybody)\b/i,
  /\b(people|persons?|patients?|employees?|users?|customers?|clients?|members?|staff|individuals?)\s+(with|who|that|taking|on|having|diagnosed|prescribed|suffering)\b/i,
]

const PERSONAL_RECORD =
  /\b(is|are|was|were|being)\s+(taking|prescribed|diagnosed|treated|dealing|suffering|on\s+medication)\b/i

const PERSON_PRONOUN = /\b(his|her|hers|he|she|him)\b/i
const GROUP_PRONOUN = /\b(their|them|they)\b/i

const GENERAL_KNOWLEDGE_OPENER =
  /^(what\s+(is|are|was|were|does|do|causes?)|what's|whats|define|definition\s+of|explain|describe|how\s+(does|do|is|are|can|to)|why\s+(is|are|do|does)|when\s+(is|are|did|do|does)|tell\s+me\s+about|what\s+do\s+you\s+know\s+about|meaning\s+of|symptoms\s+of|causes\s+of|treatments?\s+for|benefits\s+of|risks\s+of|can\s+you\s+explain)\b/i

/** Capitalized word after "of"/"for"/"about", e.g. "dosage for John" — a named person or entity. */
function mentionsNamedEntity(original: string): boolean {
  return /\b(of|for|about)\s+[A-Z][a-z]+\b/.test(original)
}

export function shouldUseRagForQuery(query: string): boolean {
  if (!query || typeof query !== 'string') return false
  const original = query.trim()
  if (!original) return false

  if (DOCUMENT_REFERENCE.test(original) || EXPLICIT_SOURCE.test(original)) return true
  if (PERSON_LOOKUP.some(re => re.test(original))) return true
  if (PERSONAL_RECORD.test(original)) return true
  if (mentionsNamedEntity(original)) return true
  if (PERSON_PRONOUN.test(original)) return true
  if (GROUP_PRONOUN.test(original) && !GENERAL_KNOWLEDGE_OPENER.test(original)) return true

  return false
}
