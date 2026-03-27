/**
 * Lakera Guard sometimes returns PII (and other sensitive) hits in `payload` or per-detector
 * `breakdown` while top-level `flagged` is still false — e.g. policy tuned for "detect/mask"
 * or detector-specific behavior. Chat/file flows previously only blocked on `flagged`, so
 * model output could leak PII despite a working Guard call.
 *
 * @see https://docs.lakera.ai/docs/api/guard — payload & breakdown
 */

export function isSensitiveLakeraDetectorType(detectorType: string | undefined): boolean {
  if (!detectorType) return false
  const t = detectorType.toLowerCase().replace(/-/g, '_')
  return (
    t.includes('pii') ||
    t.includes('personal_data') ||
    t.includes('phi') ||
    t.includes('hipaa') ||
    t.includes('medical') ||
    t.includes('health') ||
    t.includes('financial') ||
    t.includes('income') ||
    t.includes('salary') ||
    t.includes('payment_card') ||
    t.includes('political') ||
    t.includes('religion') ||
    t.includes('race') ||
    t.includes('ethnic') ||
    t.includes('demographic') ||
    t.includes('dlp') ||
    t.includes('secret') ||
    t.includes('credential') ||
    t.includes('api_key') ||
    t.includes('apikey') ||
    t.includes('credit_card') ||
    t.includes('creditcard') ||
    t.includes('ssn') ||
    t.includes('iban') ||
    t.includes('profanity') ||
    t.includes('moderation') ||
    t.includes('token') ||
    t.includes('password')
  )
}

export function isSensitiveLakeraPayloadMatch(entry: {
  detector_type?: string
  labels?: string[]
}): boolean {
  if (isSensitiveLakeraDetectorType(entry.detector_type)) return true
  const labelStr = (entry.labels || []).join(' ').toLowerCase()
  return (
    labelStr.includes('pii') ||
    labelStr.includes('phi') ||
    labelStr.includes('hipaa') ||
    labelStr.includes('medical') ||
    labelStr.includes('health') ||
    labelStr.includes('financial') ||
    labelStr.includes('income') ||
    labelStr.includes('salary') ||
    labelStr.includes('political') ||
    labelStr.includes('religion') ||
    labelStr.includes('race') ||
    labelStr.includes('ethnic') ||
    labelStr.includes('email') ||
    labelStr.includes('phone') ||
    labelStr.includes('ssn') ||
    labelStr.includes('credit') ||
    labelStr.includes('secret') ||
    labelStr.includes('password') ||
    labelStr.includes('address') ||
    labelStr.includes('dob') ||
    labelStr.includes('date_of_birth')
  )
}

/**
 * If Guard did not set `flagged` but sensitive detectors fired in breakdown or payload, treat as flagged
 * so the app blocks (or file scan fails) consistently with prompt-injection style blocks.
 */
function isSensitiveCategoryKey(key: string): boolean {
  const k = key.toLowerCase().replace(/-/g, '_')
  return (
    k.includes('pii') ||
    k.includes('phi') ||
    k.includes('hipaa') ||
    k.includes('medical') ||
    k.includes('health') ||
    k.includes('financial') ||
    k.includes('income') ||
    k.includes('dlp') ||
    k.includes('personal') ||
    k.includes('secret') ||
    k.includes('credential') ||
    k.includes('moderation') ||
    k.includes('profanity') ||
    k.includes('political') ||
    k.includes('religion') ||
    k.includes('race') ||
    k.includes('ethnic')
  )
}

export function mergeLakeraEffectiveFlag(args: {
  flagged: boolean
  categories?: Record<string, boolean>
  payload?: Array<{ detector_type?: string; labels?: string[] }>
  breakdown?: Array<{ detector_type?: string; detected?: boolean }>
}): { flagged: boolean; categories?: Record<string, boolean> } {
  const { flagged, categories, payload, breakdown } = args
  if (flagged) {
    return { flagged: true, categories: categories ? { ...categories } : undefined }
  }

  if (categories) {
    const sensitiveCategoryHit = Object.entries(categories).some(
      ([key, val]) => val === true && isSensitiveCategoryKey(key),
    )
    if (sensitiveCategoryHit) {
      return { flagged: true, categories: { ...categories } }
    }
  }

  const fromBreakdown = breakdown?.some(
    (d) => d.detected === true && isSensitiveLakeraDetectorType(d.detector_type),
  )
  const fromPayload = payload?.some((p) => isSensitiveLakeraPayloadMatch(p))

  if (!fromBreakdown && !fromPayload) {
    return { flagged: false, categories: categories ? { ...categories } : undefined }
  }

  return {
    flagged: true,
    categories: {
      ...(categories || {}),
      pii: true,
    },
  }
}

/** Lower score = listed first in user-facing messages when multiple detectors fire. */
function threatCategoryDisplayScore(key: string): number {
  const k = key.toLowerCase().replace(/-/g, '_')
  if (k.includes('pii') || k.includes('personal_data')) return 0
  if (
    k.includes('secret') ||
    k.includes('credential') ||
    k.includes('password') ||
    k.includes('api_key') ||
    k.includes('credit_card') ||
    k.includes('iban') ||
    k.includes('ssn') ||
    k.includes('token')
  ) {
    return 1
  }
  if (k.includes('moderation') || k.includes('profanity') || k.includes('hate') || k.includes('violence')) {
    return 2
  }
  if (k.includes('unknown_link')) return 3
  if (
    k.includes('prompt') ||
    k.includes('jailbreak') ||
    k.includes('injection') ||
    k.includes('multistage') ||
    k.includes('system_override')
  ) {
    return 10
  }
  return 50
}

/**
 * When Lakera returns several true categories, surface PII/DLP-related ones first so UI/logs
 * match analyst expectations (e.g. not only "multistage_attack" when PII also matched).
 */
export function sortLakeraThreatCategoriesForDisplay(keys: string[]): string[] {
  return [...keys].sort(
    (a, b) => threatCategoryDisplayScore(a) - threatCategoryDisplayScore(b) || a.localeCompare(b),
  )
}
