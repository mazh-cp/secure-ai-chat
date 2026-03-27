/**
 * Lightweight regex heuristics before calling Lakera Guard. Kept narrow to avoid
 * false positives on normal English and RAG document text (e.g. "then", "first").
 */

export function detectCommonInjectionPatterns(content: string): {
  detected: boolean
  patterns: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
} {
  const patterns: Array<{
    pattern: RegExp
    name: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }> = [
    { pattern: /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i, name: 'System Override', severity: 'high' },
    { pattern: /forget\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i, name: 'Memory Override', severity: 'high' },
    { pattern: /you\s+are\s+now\s+(a|an)\s+/i, name: 'Role Manipulation', severity: 'high' },
    { pattern: /act\s+as\s+(if|though)\s+/i, name: 'Role Playing', severity: 'medium' },
    { pattern: /new\s+(instructions?|prompts?|rules?|directives?)/i, name: 'New Instructions', severity: 'high' },
    { pattern: /override\s+(the|your|system)\s+/i, name: 'Override Command', severity: 'high' },
    { pattern: /system\s*:\s*/, name: 'System Prefix', severity: 'medium' },
    { pattern: /#\s*(system|instructions?|prompt)/i, name: 'System Comment', severity: 'medium' },
    { pattern: /jailbreak|bypass|hack|exploit/i, name: 'Jailbreak Attempt', severity: 'high' },
    { pattern: /developer\s+mode|admin\s+mode|debug\s+mode/i, name: 'Privilege Escalation', severity: 'high' },
    { pattern: /(do|say|write)\s+anything/i, name: 'Unrestricted Request', severity: 'medium' },
    { pattern: /pretend\s+(that|you|to)/i, name: 'Context Manipulation', severity: 'medium' },
    { pattern: /hypothetically|imagine\s+(that|if)/i, name: 'Hypothetical Bypass', severity: 'low' },
    { pattern: /base64|hex|unicode|encoded/i, name: 'Encoding Attempt', severity: 'medium' },
    { pattern: /\\x[0-9a-f]{2}/i, name: 'Hex Escape', severity: 'medium' },
    {
      pattern: /(show|reveal|display|print|output)\s+(your|the|system)\s+(prompt|instructions?|system\s+message)/i,
      name: 'Prompt Extraction',
      severity: 'high',
    },
    {
      pattern: /what\s+(are|were)\s+(your|the)\s+(initial|original|system)\s+(instructions?|prompts?)/i,
      name: 'Prompt Discovery',
      severity: 'high',
    },
    // Narrow: avoid matching everyday words like "then", "first", "next" in documents.
    {
      pattern: /\bstep\s+[1-9]\d?\s*[:.)]|\b(?:phase|stage)\s+[1-9]\d?\b/i,
      name: 'Multi-Stage Attack',
      severity: 'medium',
    },
    { pattern: /<script|javascript:|eval\(|exec\(|system\(/i, name: 'Code Injection', severity: 'high' },
    { pattern: /__import__|__builtins__|__globals__/i, name: 'Python Injection', severity: 'high' },
    { pattern: /rm\s+-rf|del\s+\/|format\s+c:/i, name: 'Destructive Command', severity: 'critical' },
  ]

  const rank: Record<'low' | 'medium' | 'high' | 'critical', number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  }

  const detectedPatterns: string[] = []
  let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low'

  for (const { pattern, name, severity } of patterns) {
    if (pattern.test(content)) {
      detectedPatterns.push(name)
      if (rank[severity] > rank[maxSeverity]) {
        maxSeverity = severity
      }
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
    severity: maxSeverity,
  }
}
