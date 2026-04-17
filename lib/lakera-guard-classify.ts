/**
 * Classify Lakera Guard results into PII vs content moderation vs security buckets for chat UX.
 *
 * Content moderation categories align with Lakera Guard documentation:
 * @see https://docs.lakera.ai/docs/content-moderation
 * (crime, hate, profanity, sexual, violence, weapons; plus custom policy detectors.)
 */

/** Normalise Lakera category or detector strings for matching */
function norm(s: string): string {
  return s.toLowerCase().replace(/-/g, '_')
}

/** PII / DLP / secrets — not the same as content moderation */
export function isPiiOrDlpCategoryOrDetector(s: string): boolean {
  const t = norm(s)
  return (
    t.includes('email_address') ||
    t.includes('phone_number') ||
    t.includes('street_address') ||
    t.includes('mailing_address') ||
    t.includes('physical_address') ||
    t.includes('national_id') ||
    t.includes('tax_id') ||
    t.includes('bank_account') ||
    t.includes('payment_method') ||
    t.includes('contact_info') ||
    t.includes('contact_information') ||
    t.includes('customer_identifier') ||
    t.includes('personal_identifier') ||
    t.includes('sensitive_data') ||
    t.includes('data_leak') ||
    t.includes('gdpr') ||
    t.includes('pii') ||
    t.includes('personal_data') ||
    t.includes('phi') ||
    t.includes('hipaa') ||
    t.includes('medical_record') ||
    t.includes('financial') ||
    t.includes('income') ||
    t.includes('salary') ||
    t.includes('payment_card') ||
    t.includes('credit_card') ||
    t.includes('iban') ||
    t.includes('ssn') ||
    t.includes('dlp') ||
    t.includes('secret') ||
    t.includes('credential') ||
    t.includes('api_key') ||
    t.includes('apikey') ||
    t.includes('password') ||
    t.includes('token') ||
    t.includes('structured_sensitive')
  )
}

/**
 * Lakera content moderation family: crime, hate, profanity, sexual, violence, weapons
 * and common API spellings.
 */
export function isContentModerationCategoryOrDetector(s: string): boolean {
  const t = norm(s)
  if (t.includes('prompt_injection') || t.includes('jailbreak') || t.includes('system_override')) {
    return false
  }
  if (isPiiOrDlpCategoryOrDetector(s)) return false

  return (
    t.includes('crime') ||
    t.includes('illicit') ||
    t.includes('fraud') ||
    t.includes('terror') ||
    t.includes('malware') ||
    t.includes('phish') ||
    t.includes('hate') ||
    t.includes('harassment') ||
    t.includes('profanity') ||
    t.includes('obscene') ||
    t.includes('vulgar') ||
    t.includes('sexual') ||
    t.includes('erotic') ||
    t.includes('violence') ||
    t.includes('self_harm') ||
    t.includes('selfharm') ||
    t.includes('suicide') ||
    t.includes('weapon') ||
    t.includes('firearm') ||
    t.includes('gun') ||
    t.includes('knife') ||
    t.includes('bomb') ||
    t.includes('ammunition') ||
    t.includes('moderation') ||
    t.includes('toxic') ||
    t.includes('nsfw')
  )
}

export function isSecurityCategoryOrDetector(s: string): boolean {
  const t = norm(s)
  return (
    t.includes('prompt') ||
    t.includes('jailbreak') ||
    t.includes('injection') ||
    t.includes('multistage') ||
    t.includes('system_override') ||
    t.includes('unknown_link') ||
    t.includes('lakera_api_error') ||
    t.includes('lakera_client')
  )
}

export type LakeraBlockPolicy = 'pii' | 'content_moderation' | 'security' | 'mixed'

export interface LakeraClassification {
  hasPii: boolean
  hasContentModeration: boolean
  hasSecurity: boolean
  policy: LakeraBlockPolicy
}

export function classifyLakeraBlock(args: {
  categories?: Record<string, boolean>
  payload?: Array<{ detector_type?: string; labels?: string[] }>
  breakdown?: Array<{ detector_type?: string; detected?: boolean }>
}): LakeraClassification {
  const { categories, payload, breakdown } = args
  let hasPii = false
  let hasContentModeration = false
  let hasSecurity = false

  if (categories) {
    for (const [key, val] of Object.entries(categories)) {
      if (!val) continue
      if (isSecurityCategoryOrDetector(key)) hasSecurity = true
      else if (isPiiOrDlpCategoryOrDetector(key)) hasPii = true
      else if (isContentModerationCategoryOrDetector(key)) hasContentModeration = true
    }
  }

  const considerDetector = (detectorType: string | undefined) => {
    if (!detectorType) return
    if (isSecurityCategoryOrDetector(detectorType)) hasSecurity = true
    else if (isPiiOrDlpCategoryOrDetector(detectorType)) hasPii = true
    else if (isContentModerationCategoryOrDetector(detectorType)) hasContentModeration = true
  }

  for (const p of payload ?? []) {
    considerDetector(p.detector_type)
    for (const label of p.labels ?? []) {
      if (typeof label === 'string') considerDetector(label)
    }
  }

  for (const b of breakdown ?? []) {
    if (b.detected === true) considerDetector(b.detector_type)
  }

  const count = [hasPii, hasContentModeration, hasSecurity].filter(Boolean).length
  let policy: LakeraBlockPolicy = 'mixed'
  if (count <= 1) {
    if (hasPii) policy = 'pii'
    else if (hasContentModeration) policy = 'content_moderation'
    else if (hasSecurity) policy = 'security'
    else policy = 'mixed'
  }

  return { hasPii, hasContentModeration, hasSecurity, policy }
}

/**
 * User-facing explanation when chat input or output is blocked (no raw examples per Lakera guidance).
 */
export function buildLakeraChatBlockMessage(
  context: 'input' | 'output',
  classification: LakeraClassification,
  threatCategories: string[]
): string {
  const detail =
    threatCategories.length > 0 ? ` Categories flagged: ${threatCategories.join(', ')}.` : ''

  if (
    classification.policy === 'pii' ||
    (classification.hasPii && !classification.hasContentModeration && !classification.hasSecurity)
  ) {
    return context === 'input'
      ? `This message was blocked because it may contain sensitive personal or confidential data. Please remove or redact PII and try again.${detail}`
      : `The assistant reply was blocked because it may expose sensitive personal or confidential data.${detail}`
  }

  if (
    classification.policy === 'content_moderation' ||
    (classification.hasContentModeration && !classification.hasPii && !classification.hasSecurity)
  ) {
    return context === 'input'
      ? `This message was blocked by content moderation (e.g. disallowed topics such as crime, hate, profanity, sexual content, violence, or weapons). Please rephrase your question.${detail}`
      : `The assistant reply was blocked by content moderation so harmful or policy-violating content is not shown.${detail}`
  }

  if (
    classification.policy === 'security' ||
    (classification.hasSecurity && !classification.hasPii && !classification.hasContentModeration)
  ) {
    return context === 'input'
      ? `This message was blocked for security reasons (possible prompt injection or unsafe instructions).${detail}`
      : `The assistant reply was blocked for security reasons.${detail}`
  }

  return context === 'input'
    ? `This message was blocked by the security filter (multiple policy areas may apply).${detail}`
    : `The assistant reply was blocked by the security filter.${detail}`
}
