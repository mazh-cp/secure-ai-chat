import { NextRequest, NextResponse } from 'next/server'
import { getUserIP } from '@/lib/logging'
import { sendLakeraTelemetryFromLog } from '@/lib/lakera-telemetry'

interface LakeraResponse {
  flagged: boolean
  categories?: Record<string, boolean>
  payload_scores?: Record<string, number>
  results?: Array<{
    flagged: boolean
    categories?: Record<string, boolean>
    payload_scores?: Record<string, number>
  }>
  message?: string
  error?: string
}

interface LakeraRequestBody {
  messages: Array<{ role: string; content: string }>
  context?: {
    type?: string
    fileName?: string
    fileType?: string
    isBinary?: boolean
  }
}

// Pre-scan validation for common prompt injection patterns in files
function detectCommonInjectionPatterns(content: string): {
  detected: boolean
  patterns: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
} {
  const patterns: Array<{ pattern: RegExp; name: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = [
    // System override attempts
    { pattern: /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i, name: 'System Override', severity: 'high' },
    { pattern: /forget\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i, name: 'Memory Override', severity: 'high' },
    { pattern: /you\s+are\s+now\s+(a|an)\s+/i, name: 'Role Manipulation', severity: 'high' },
    { pattern: /act\s+as\s+(if|though)\s+/i, name: 'Role Playing', severity: 'medium' },
    
    // Instruction manipulation
    { pattern: /new\s+(instructions?|prompts?|rules?|directives?)/i, name: 'New Instructions', severity: 'high' },
    { pattern: /override\s+(the|your|system)\s+/i, name: 'Override Command', severity: 'high' },
    { pattern: /system\s*:\s*/, name: 'System Prefix', severity: 'medium' },
    { pattern: /#\s*(system|instructions?|prompt)/i, name: 'System Comment', severity: 'medium' },
    
    // Jailbreak attempts
    { pattern: /jailbreak|bypass|hack|exploit/i, name: 'Jailbreak Attempt', severity: 'high' },
    { pattern: /developer\s+mode|admin\s+mode|debug\s+mode/i, name: 'Privilege Escalation', severity: 'high' },
    { pattern: /(do|say|write)\s+anything/i, name: 'Unrestricted Request', severity: 'medium' },
    
    // Context manipulation
    { pattern: /pretend\s+(that|you|to)/i, name: 'Context Manipulation', severity: 'medium' },
    { pattern: /hypothetically|imagine\s+(that|if)/i, name: 'Hypothetical Bypass', severity: 'low' },
    
    // Encoding attempts
    { pattern: /base64|hex|unicode|encoded/i, name: 'Encoding Attempt', severity: 'medium' },
    { pattern: /\\x[0-9a-f]{2}/i, name: 'Hex Escape', severity: 'medium' },
    
    // Prompt extraction
    { pattern: /(show|reveal|display|print|output)\s+(your|the|system)\s+(prompt|instructions?|system\s+message)/i, name: 'Prompt Extraction', severity: 'high' },
    { pattern: /what\s+(are|were)\s+(your|the)\s+(initial|original|system)\s+(instructions?|prompts?)/i, name: 'Prompt Discovery', severity: 'high' },
    
    // Multi-stage attacks
    { pattern: /step\s+\d+|first|then|next|finally/i, name: 'Multi-Stage Attack', severity: 'medium' },
    
    // Code injection in documents
    { pattern: /<script|javascript:|eval\(|exec\(|system\(/i, name: 'Code Injection', severity: 'high' },
    { pattern: /__import__|__builtins__|__globals__/i, name: 'Python Injection', severity: 'high' },
    { pattern: /rm\s+-rf|del\s+\/|format\s+c:/i, name: 'Destructive Command', severity: 'critical' },
  ]

  const detectedPatterns: string[] = []
  let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low'

  for (const { pattern, name, severity } of patterns) {
    if (pattern.test(content)) {
      detectedPatterns.push(name)
      // Update max severity based on priority: critical > high > medium > low
      if (severity === 'critical' || 
          (severity === 'high' && maxSeverity !== 'critical') ||
          (severity === 'medium' && maxSeverity === 'low') ||
          (severity === 'low' && maxSeverity === 'low')) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileContent, fileName, apiKeys } = body

    if (!fileContent) {
      return NextResponse.json(
        { error: 'File content is required' },
        { status: 400 }
      )
    }

    if (!apiKeys?.lakeraAiKey) {
      return NextResponse.json(
        { error: 'Lakera API key is not configured. Please add it in Settings.' },
        { status: 400 }
      )
    }

    // Prepare content for scanning
    let contentToScan: string = ''

    // Detect if content is base64 encoded (binary files like PDF, DOCX)
    const isBase64 = typeof fileContent === 'string' && 
                     fileContent.length > 100 && 
                     !fileContent.includes(' ') && 
                     !fileContent.includes('\n') &&
                     /^[A-Za-z0-9+/=]+$/.test(fileContent.substring(0, 100))

    if (isBase64) {
      // For binary files, we can't scan the raw content effectively
      // Send a description that includes filename for context
      const fileExtension = fileName?.split('.').pop()?.toUpperCase() || 'UNKNOWN'
      contentToScan = `[Binary file upload: ${fileName || 'unnamed'}] File type: ${fileExtension}. Content: Binary data (base64 encoded).`
    } else {
      // For text files, scan the actual content
      contentToScan = String(fileContent)
      
      // Truncate very long content for API limits
      // Lakera typically has limits around 10K-50K characters
      const maxLength = 50000
      if (contentToScan.length > maxLength) {
        // Scan both beginning and end of file (common attack vectors)
        const start = contentToScan.substring(0, maxLength / 2)
        const end = contentToScan.substring(contentToScan.length - maxLength / 2)
        contentToScan = `${start}\n\n...[content truncated for scanning - file too large]...\n\n${end}`
      }
      
      // Ensure we have some content
      if (!contentToScan.trim()) {
        contentToScan = `[Empty file: ${fileName || 'unnamed'}]`
      }
    }

    // Pre-scan validation for common patterns
    const preScan = detectCommonInjectionPatterns(contentToScan)
    
    // If high-severity patterns detected, flag immediately
    if (preScan.detected && preScan.severity === 'high') {
      const userIP = getUserIP(request)
      return NextResponse.json({
        flagged: true,
        message: `Security threat detected: ${preScan.patterns.join(', ')}. File blocked.`,
        details: {
          categories: {
            prompt_injection: true,
            system_override: true,
            ...preScan.patterns.reduce((acc, pattern) => {
              acc[pattern.toLowerCase().replace(/\s+/g, '_')] = true
              return acc
            }, {} as Record<string, boolean>),
          },
          score: 0.9, // High confidence for pre-scan detection
        },
        logData: {
          userIP,
          type: 'file_scan',
          action: 'blocked',
          source: 'file_upload',
          requestDetails: {
            fileName,
            fileType: fileName?.split('.').pop() || 'unknown',
            fileSize: fileContent.length,
            threatLevel: 'high',
            detectedPatterns: preScan.patterns,
          },
          lakeraDecision: {
            scanned: true,
            flagged: true,
            categories: {
              prompt_injection: true,
              system_override: true,
              ...preScan.patterns.reduce((acc, pattern) => {
                acc[pattern.toLowerCase().replace(/\s+/g, '_')] = true
                return acc
              }, {} as Record<string, boolean>),
            },
            message: `Security threat detected: ${preScan.patterns.join(', ')}. File blocked.`,
          },
          success: false,
        },
      })
    }

    const lakeraEndpoint = apiKeys.lakeraEndpoint || 'https://api.lakera.ai/v2/guard'

    // Validate endpoint
    if (!lakeraEndpoint.startsWith('http://') && !lakeraEndpoint.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid Lakera endpoint. Must start with http:// or https://' },
        { status: 400 }
      )
    }

    // Enhanced request with file context
    const requestBody: LakeraRequestBody = {
      messages: [
        {
          role: 'user',
          content: contentToScan,
        },
      ],
      context: {
        type: 'file_upload',
        fileName: fileName || 'unnamed',
        fileType: fileName?.split('.').pop() || 'unknown',
        isBinary: isBase64,
      },
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKeys.lakeraAiKey.trim()}`,
    }

    // Add project ID as header if provided
    if (apiKeys.lakeraProjectId && apiKeys.lakeraProjectId.trim()) {
      headers['X-Lakera-Project'] = apiKeys.lakeraProjectId.trim()
    }

    console.log('Scanning with Lakera:', {
      endpoint: lakeraEndpoint,
      contentLength: contentToScan.length,
      hasProjectId: !!apiKeys.lakeraProjectId,
      fileType: isBase64 ? 'binary' : 'text',
      preScanDetected: preScan.detected,
      preScanPatterns: preScan.patterns,
    })

    const response = await fetch(lakeraEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      let errorMessage = `Lakera API error: ${response.status} ${response.statusText}`
      let errorDetails: Record<string, unknown> | string | null = null

      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const jsonError = await response.json() as Record<string, unknown>
          errorDetails = jsonError
          const msg = jsonError.message || jsonError.error || jsonError.detail
          errorMessage = (typeof msg === 'string' ? msg : errorMessage) || errorMessage
          
          if (jsonError.errors) {
            errorMessage += ` - ${JSON.stringify(jsonError.errors)}`
          }
        } else {
          const text = await response.text()
          if (text) {
            errorDetails = text
            errorMessage += ` - ${text.substring(0, 200)}`
          }
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
      }

      // If API fails but pre-scan detected medium/high severity, still flag
      if (preScan.detected && (preScan.severity === 'high' || preScan.severity === 'medium')) {
        const userIP = getUserIP(request)
        return NextResponse.json({
          flagged: true,
          message: `Potential security threat detected: ${preScan.patterns.join(', ')}. File blocked.`,
          details: {
            categories: {
              prompt_injection: true,
              ...preScan.patterns.reduce((acc, pattern) => {
                acc[pattern.toLowerCase().replace(/\s+/g, '_')] = true
                return acc
              }, {} as Record<string, boolean>),
            },
            score: preScan.severity === 'high' ? 0.9 : 0.7,
          },
          logData: {
            userIP,
            type: 'file_scan',
            action: 'blocked',
            source: 'file_upload',
            requestDetails: {
              fileName,
              fileType: fileName?.split('.').pop() || 'unknown',
              fileSize: fileContent.length,
              threatLevel: preScan.severity,
              detectedPatterns: preScan.patterns,
            },
            lakeraDecision: {
              scanned: true,
              flagged: true,
              categories: {
                prompt_injection: true,
                ...preScan.patterns.reduce((acc, pattern) => {
                  acc[pattern.toLowerCase().replace(/\s+/g, '_')] = true
                  return acc
                }, {} as Record<string, boolean>),
              },
              message: `Potential security threat detected: ${preScan.patterns.join(', ')}. File blocked.`,
            },
            success: false,
          },
        })
      }

      // Return specific error messages based on status code
      if (response.status === 401) {
        return NextResponse.json(
          { 
            error: 'Invalid Lakera API key. Please verify your API key in Settings.',
            details: errorDetails,
          },
          { status: 401 }
        )
      }

      if (response.status === 403) {
        return NextResponse.json(
          { 
            error: 'Lakera API access denied. Check your API key, project ID, and permissions in Settings.',
            details: errorDetails,
          },
          { status: 403 }
        )
      }

      if (response.status === 400) {
        return NextResponse.json(
          { 
            error: `Bad request: ${errorMessage}. Please check your API configuration and file content.`,
            details: errorDetails,
          },
          { status: 400 }
        )
      }

      if (response.status === 404) {
        return NextResponse.json(
          { 
            error: 'Lakera endpoint not found. Please check your endpoint URL in Settings.',
            details: errorDetails,
          },
          { status: 404 }
        )
      }

      if (response.status === 429) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please wait a moment and try again.',
            details: errorDetails,
          },
          { status: 429 }
        )
      }

      if (response.status >= 500) {
        return NextResponse.json(
          { 
            error: 'Lakera API server error. Please try again later.',
            details: errorDetails,
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails,
        },
        { status: response.status }
      )
    }

    let data: LakeraResponse
    try {
      data = await response.json()
    } catch (parseError) {
      console.error('Failed to parse Lakera response:', parseError)
      return NextResponse.json(
        { error: 'Invalid response format from Lakera API. The API may have returned an unexpected format.' },
        { status: 500 }
      )
    }

    // Handle different response formats
    let flagged = false
    let categories: Record<string, boolean> | undefined
    let scores: Record<string, number> | undefined

    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      flagged = data.results.some((r) => r.flagged === true)
      const firstResult = data.results[0]
      categories = firstResult?.categories
      scores = firstResult?.payload_scores
    } else {
      flagged = data.flagged === true
      categories = data.categories
      scores = data.payload_scores
    }

    // Combine pre-scan results with Lakera results
    if (preScan.detected && !flagged) {
      // If pre-scan detected something but Lakera didn't, still flag for medium/high
      if (preScan.severity === 'high' || preScan.severity === 'medium') {
        flagged = true
        categories = {
          ...categories,
          prompt_injection: true,
          ...preScan.patterns.reduce((acc, pattern) => {
            acc[pattern.toLowerCase().replace(/\s+/g, '_')] = true
            return acc
          }, {} as Record<string, boolean>),
        }
      }
    }

    // Determine threat level
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (flagged) {
      const hasHighRiskCategories = categories && Object.keys(categories).some(cat => 
        ['prompt_injection', 'jailbreak', 'system_override', 'pii', 'code_injection'].includes(cat.toLowerCase())
      )
      const maxScore = scores && Object.keys(scores).length > 0 ? Math.max(...Object.values(scores)) : 0
      
      if (hasHighRiskCategories || maxScore > 0.8 || preScan.severity === 'high') {
        threatLevel = 'critical'
      } else if (maxScore > 0.6 || preScan.severity === 'medium') {
        threatLevel = 'high'
      } else if (maxScore > 0.4) {
        threatLevel = 'medium'
      }
    }

    const userIP = getUserIP(request)

    const logData = {
      userIP,
      type: 'file_scan',
      action: flagged ? 'blocked' : 'scanned',
      source: 'file_upload',
      requestDetails: {
        fileName,
        fileType: fileName?.split('.').pop() || 'unknown',
        fileSize: fileContent.length,
        threatLevel: flagged ? threatLevel : undefined,
        detectedPatterns: preScan.detected ? preScan.patterns : undefined,
      },
      lakeraDecision: {
        scanned: true,
        flagged,
        categories,
        scores,
        message: flagged
          ? `Security threats detected (${threatLevel})`
          : 'File content appears safe',
      },
      success: true,
      timestamp: new Date().toISOString(),
    }

    // Send telemetry to Lakera Platform (fire and forget, non-blocking)
    if (apiKeys.lakeraAiKey) {
      sendLakeraTelemetryFromLog(
        logData,
        apiKeys.lakeraAiKey,
        apiKeys.lakeraProjectId
      ).catch((error) => {
        console.error('Failed to send Lakera telemetry (non-blocking):', error)
      })
    }

    return NextResponse.json({
      flagged,
      message: flagged
        ? `Security threats detected (${threatLevel}): ${categories ? Object.keys(categories).filter(k => categories![k]).join(', ') : 'unknown'}`
        : 'File content appears safe',
      details: {
        categories,
        score: scores && Object.keys(scores).length > 0 
          ? Math.max(...Object.values(scores)) 
          : undefined,
        threatLevel,
      },
      logData,
    })
  } catch (error) {
    console.error('Scan API error:', error)
    
    let errorMessage = 'An error occurred during scanning'
    let statusCode = 500

    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = 'Network error: Could not connect to Lakera API. Check your internet connection, API endpoint, and firewall settings.'
        statusCode = 503
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Failed to parse response. Check your API endpoint configuration.'
        statusCode = 500
      }
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    const userIP = getUserIP(request)

    return NextResponse.json(
      { 
        error: errorMessage,
        type: error instanceof TypeError ? 'network_error' : 'unknown_error',
        logData: {
          userIP,
          type: 'error',
          action: 'error',
          source: 'file_upload',
          error: errorMessage,
          success: false,
        },
      },
      { status: statusCode }
    )
  }
}
