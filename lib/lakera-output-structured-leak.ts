/**
 * Defense-in-depth when Lakera Guard returns unflagged assistant text but the reply
 * still looks like an HR / benefits / PHI roster (typical RAG leak from spreadsheets).
 * Intentionally conservative: requires combinations of markers, not single keywords.
 */

function hasDollarAmount(s: string): boolean {
  return /\$\s*[\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\s*[\d]+\.\d{2}\b/.test(s)
}

/**
 * Returns true when the assistant message strongly resembles structured sensitive records.
 */
export function detectStructuredSensitiveLeakInAssistantOutput(text: string): boolean {
  const t = text.trim()
  if (t.length < 80) return false

  const lower = t.toLowerCase()

  const med =
    /\bmedical\s+condition\b/i.test(lower) ||
    /\bdiagnos(is|ed)\b/i.test(lower) ||
    /\bprotected\s+health\b/i.test(lower) ||
    /\bhipaa\b/i.test(lower)
  const rx =
    /\bprescription\s+(medicine|medication|drug)\b/i.test(lower) ||
    /\bcurrent\s+medications?\b/i.test(lower)

  const inc =
    (/\bannual\s+income\b/i.test(lower) || /\bhousehold\s+income\b/i.test(lower)) && hasDollarAmount(t)
  const dob = /\bdate\s+of\s+birth\b/i.test(lower) || /\bd\.?o\.?b\.?\s*[:-]/i.test(lower)
  const ssn = /\b(ssn|social\s+security(\s+number)?)\b/i.test(lower) && /[:-]/.test(t)
  const pol = /\bpolitical\s+affiliation\b/i.test(lower)
  const rel = /\breligious\s+belief\b/i.test(lower)
  const race = /\brace\s*[:-]/i.test(lower) || /\*\*race\*\*/i.test(t)
  const zip = /\bzip\s+code\b/i.test(lower) || /\bpostal\s+code\b/i.test(lower)

  if (ssn) return true
  if ((med || rx) && (inc || dob)) return true
  if (inc && dob && (zip || pol || rel || race)) return true

  let rosterSignals = 0
  if (med) rosterSignals++
  if (rx) rosterSignals++
  if (inc) rosterSignals++
  if (dob) rosterSignals++
  if (pol) rosterSignals++
  if (rel) rosterSignals++
  if (race) rosterSignals++
  if (zip) rosterSignals++
  if (/\bhealth\s+insurance\b/i.test(lower)) rosterSignals++
  if (/\bemployer\s+paid\s+benefits\b/i.test(lower)) rosterSignals++
  if (/\bemployer\s+size\b/i.test(lower)) rosterSignals++
  if (/\bvisa\b/i.test(lower) && /\bemployer\b/i.test(lower)) rosterSignals++

  return rosterSignals >= 4
}
