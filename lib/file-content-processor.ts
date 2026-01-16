/**
 * File Content Processor Utility
 * 
 * Processes file content for RAG (Retrieval Augmented Generation) with:
 * - Structured data extraction (CSV, JSON fields)
 * - Field-level access for chat queries
 * - Security validation for prompts using file content
 * 
 * NOTE: This is an ADDITIONAL security layer that works alongside
 * Lakera AI and Check Point TE scanning. It does NOT replace them.
 */

/**
 * Extract structured fields from file content
 * Supports CSV, JSON, and structured text formats
 */
export function extractFileFields(fileContent: string, fileName: string, fileType: string): {
  fields: string[]
  structuredData?: Record<string, unknown>[] | Record<string, unknown>
  hasStructuredData: boolean
} {
  const fields: string[] = []
  let structuredData: Record<string, unknown>[] | Record<string, unknown> | undefined
  let hasStructuredData = false

  try {
    // Handle JSON files
    if (fileType.includes('json') || fileName.endsWith('.json')) {
      try {
        const parsed = JSON.parse(fileContent)
        
        if (Array.isArray(parsed)) {
          // Array of objects - extract fields from first object
          if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
            fields.push(...Object.keys(parsed[0]))
            structuredData = parsed
            hasStructuredData = true
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          // Single object - extract top-level keys
          fields.push(...Object.keys(parsed))
          structuredData = parsed
          hasStructuredData = true
        }
      } catch (parseError) {
        // Not valid JSON, treat as plain text
        console.warn(`Failed to parse JSON file ${fileName}:`, parseError)
      }
    }
    
    // Handle CSV files
    else if (fileType.includes('csv') || fileName.endsWith('.csv')) {
      const lines = fileContent.split('\n').filter(line => line.trim())
      if (lines.length > 0) {
        // First line is header
        const headerLine = lines[0]
        const csvFields = headerLine.split(',').map(f => f.trim().replace(/^"|"$/g, ''))
        fields.push(...csvFields)
        hasStructuredData = true
        
        // Parse CSV rows (limit to first 100 rows for performance)
        const rows: Record<string, string>[] = []
        for (let i = 1; i < Math.min(lines.length, 101); i++) {
          const line = lines[i]
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
          const row: Record<string, string> = {}
          csvFields.forEach((field, index) => {
            row[field] = values[index] || ''
          })
          if (csvFields.length > 0) {
            rows.push(row)
          }
        }
        if (rows.length > 0) {
          structuredData = rows
        }
      }
    }
    
    // Handle structured text files (e.g., key: value pairs)
    else if (fileType.includes('text/plain') || fileName.endsWith('.txt')) {
      // Try to detect structured patterns
      const keyValuePattern = /^[\w\s]+:\s*.+$/m
      if (keyValuePattern.test(fileContent)) {
        const lines = fileContent.split('\n')
        for (const line of lines) {
          const match = line.match(/^([\w\s]+):\s*(.+)$/)
          if (match) {
            const key = match[1].trim()
            if (!fields.includes(key)) {
              fields.push(key)
            }
          }
        }
        if (fields.length > 0) {
          hasStructuredData = true
        }
      }
    }
  } catch (error) {
    console.error(`Error extracting fields from ${fileName}:`, error)
  }

  return {
    fields,
    structuredData,
    hasStructuredData,
  }
}

/**
 * Format file content with field information for LLM context
 * Includes structured data when available
 */
export function formatFileContentForRAG(
  fileName: string,
  fileContent: string,
  fileType: string,
  includeAllFields: boolean = false
): string {
  const { fields, structuredData, hasStructuredData } = extractFileFields(fileContent, fileName, fileType)
  
  let formattedContent = `[File: ${fileName}]\n`
  
  // Add field information if structured data is available
  if (hasStructuredData && fields.length > 0) {
    formattedContent += `[Available Fields: ${fields.join(', ')}]\n`
    
    // Include structured data if requested or if file is small
    if (includeAllFields || fileContent.length < 50000) {
      if (structuredData) {
        formattedContent += `[Structured Data:]\n`
        if (Array.isArray(structuredData)) {
          // Limit to first 50 records for context
          const recordsToInclude = structuredData.slice(0, 50)
          formattedContent += JSON.stringify(recordsToInclude, null, 2)
          if (structuredData.length > 50) {
            formattedContent += `\n[Note: Showing first 50 of ${structuredData.length} records. All fields are accessible.]`
          }
        } else {
          formattedContent += JSON.stringify(structuredData, null, 2)
        }
        formattedContent += '\n'
      }
    } else {
      formattedContent += `[Note: File contains structured data with ${fields.length} fields. All fields are accessible for querying. Use the field names when asking about specific data.]\n`
    }
  }
  
  // Add full content (truncated if too large)
  let contentToInclude = fileContent
  if (fileContent.length > 20000 && !includeAllFields) {
    // For very large files, include first 10000 and last 10000 chars
    contentToInclude = fileContent.substring(0, 10000) + '\n\n...[content truncated - showing first and last portions]...\n\n' + fileContent.substring(fileContent.length - 10000)
  }
  
  formattedContent += contentToInclude
  
  return formattedContent
}

/**
 * Validate prompt security for file-based queries
 * Checks for prompt injection attempts when using file content
 * This is ADDITIONAL security on top of Lakera/Check Point TE scanning
 * NOTE: This does NOT replace Lakera AI or Check Point TE - it's a secondary check
 */
export function validateFilePromptSecurity(prompt: string, fileContent: string): {
  safe: boolean
  riskLevel: 'low' | 'medium' | 'high'
  warnings: string[]
} {
  const warnings: string[] = []
  let riskLevel: 'low' | 'medium' | 'high' = 'low'
  
  const promptLower = prompt.toLowerCase()
  const contentLower = fileContent.toLowerCase()
  
  // Check for system override attempts in prompt
  const systemOverridePatterns = [
    /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /act\s+as\s+(if|though)\s+/i,
  ]
  
  for (const pattern of systemOverridePatterns) {
    if (pattern.test(prompt)) {
      warnings.push('Potential system override attempt detected in prompt')
      riskLevel = 'high'
    }
  }
  
  // Check if file content contains suspicious patterns that might be used in injection
  // This is a secondary check - Lakera/Check Point TE are primary security layers
  const suspiciousFilePatterns = [
    /<script|javascript:|eval\(|exec\(/i,
    /__import__|__builtins__|__globals__/i,
    /rm\s+-rf|del\s+\/|format\s+c:/i,
    /system\s*:\s*ignore/i,
    /new\s+instructions?:/i,
  ]
  
  // Only flag if BOTH prompt and file content have suspicious patterns (indicates coordinated attack)
  let fileHasSuspiciousPattern = false
  for (const pattern of suspiciousFilePatterns) {
    if (pattern.test(contentLower)) {
      fileHasSuspiciousPattern = true
      break
    }
  }
  
  // Check for prompt extraction attempts
  if (/show|reveal|display|print|output\s+(your|the|system)\s+(prompt|instructions?)/i.test(promptLower)) {
    warnings.push('Prompt extraction attempt detected')
    if (riskLevel === 'low') riskLevel = 'medium'
  }
  
  // Only escalate to high risk if both prompt and file show suspicious patterns
  // This prevents false positives from legitimate data files
  if (fileHasSuspiciousPattern && warnings.length > 0 && riskLevel === 'low') {
    riskLevel = 'medium'
  }
  
  return {
    safe: riskLevel !== 'high',
    riskLevel,
    warnings,
  }
}
