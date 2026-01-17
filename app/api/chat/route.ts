import { NextRequest, NextResponse } from 'next/server'
import { getUserIP } from '@/lib/logging'
import { sendLakeraTelemetryFromLog } from '@/lib/lakera-telemetry'
import { callOpenAI as callOpenAIAdapter, validateModel, type ChatMessage as AdapterChatMessage } from '@/lib/aiAdapter'
import { checkRateLimit, getRateLimitStatus } from '@/lib/rate-limiter'
import { 
  validateTokenLimit, 
  validateTokenLimitAsync,
  truncateToTokenLimit,
  truncateToTokenLimitAsync,
  estimateRequestTokens,
  shouldThrottleByTokens,
  getTokenLimitAsync
} from '@/lib/token-counter'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Official Lakera Guard API v2 Response Structure
// Reference: https://docs.lakera.ai/api-reference/lakera-api/guard/screen-content
interface LakeraResponse {
  flagged: boolean
  
  // Official fields (when payload=true)
  payload?: Array<{
    start: number
    end: number
    text: string
    detector_type: string
    labels: string[]
    message_id: number
  }>
  
  // Official fields (when breakdown=true)
  breakdown?: Array<{
    project_id: string
    policy_id: string
    detector_id: string
    detector_type: string
    detected: boolean
    message_id: number
  }>
  
  // Official fields (when dev_info=true)
  dev_info?: {
    git_revision: string
    git_timestamp: string
    model_version: string
    version: string
  }
  
  // Official fields (metadata)
  metadata?: {
    request_uuid: string
  }
  
  // Legacy/custom fields (may still be present for backward compatibility)
  categories?: Record<string, boolean>
  payload_scores?: Record<string, number>
  results?: Array<{
    flagged: boolean
    categories?: Record<string, boolean>
    payload_scores?: Record<string, number>
    payload?: Array<{
      start: number
      end: number
      text: string
      detector_type: string
      labels: string[]
      message_id: number
    }>
    breakdown?: Array<{
      project_id: string
      policy_id: string
      detector_id: string
      detector_type: string
      detected: boolean
      message_id: number
    }>
  }>
  message?: string
  error?: string
}

interface ScanResult {
  scanned: boolean
  flagged: boolean
  categories?: Record<string, boolean>
  scores?: Record<string, number>
  message?: string
  threatLevel?: 'low' | 'medium' | 'high' | 'critical'
  // Official payload data (detected threats with locations)
  payload?: Array<{
    start: number
    end: number
    text: string
    detector_type: string
    labels: string[]
    message_id: number
  }>
  // Official breakdown data (detector results)
  breakdown?: Array<{
    project_id: string
    policy_id: string
    detector_id: string
    detector_type: string
    detected: boolean
    message_id: number
  }>
}

// Pre-scan validation for common prompt injection patterns
function detectCommonInjectionPatterns(content: string): {
  detected: boolean
  patterns: string[]
  severity: 'low' | 'medium' | 'high'
} {
  const patterns: Array<{ pattern: RegExp; name: string; severity: 'low' | 'medium' | 'high' }> = [
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
    { pattern: /in\s+a\s+(fictional|hypothetical|fictional)\s+/i, name: 'Fictional Context', severity: 'low' },
    
    // Encoding attempts
    { pattern: /base64|hex|unicode|encoded/i, name: 'Encoding Attempt', severity: 'medium' },
    { pattern: /\\x[0-9a-f]{2}/i, name: 'Hex Escape', severity: 'medium' },
    
    // Prompt extraction
    { pattern: /(show|reveal|display|print|output)\s+(your|the|system)\s+(prompt|instructions?|system\s+message)/i, name: 'Prompt Extraction', severity: 'high' },
    { pattern: /what\s+(are|were)\s+(your|the)\s+(initial|original|system)\s+(instructions?|prompts?)/i, name: 'Prompt Discovery', severity: 'high' },
    
    // Multi-stage attacks
    { pattern: /step\s+\d+|first|then|next|finally/i, name: 'Multi-Stage Attack', severity: 'medium' },
    { pattern: /task\s+\d+|part\s+\d+/i, name: 'Task Decomposition', severity: 'low' },
  ]

  const detectedPatterns: string[] = []
  let maxSeverity: 'low' | 'medium' | 'high' = 'low'

  for (const { pattern, name, severity } of patterns) {
    if (pattern.test(content)) {
      detectedPatterns.push(name)
      if (severity === 'high' || (severity === 'medium' && maxSeverity === 'low')) {
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

// Enhanced Lakera scanning with comprehensive threat detection
// Compliant with official Lakera Guard API v2 specification
async function checkWithLakera(
  message: string,
  lakeraKey: string,
  lakeraEndpoint: string,
  lakeraProjectId: string,
  context?: 'input' | 'output',
  metadata?: {
    user_id?: string
    session_id?: string
    ip_address?: string
    internal_request_id?: string
  }
): Promise<ScanResult> {
  if (!lakeraKey) {
    return { scanned: false, flagged: false }
  }

  // Pre-scan validation for common patterns
  const preScan = detectCommonInjectionPatterns(message)
  
  // If high-severity patterns detected, flag immediately
  if (preScan.detected && preScan.severity === 'high') {
    return {
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
      message: `Security threat detected: ${preScan.patterns.join(', ')}. Message blocked.`,
      threatLevel: 'high',
    }
  }

  try {
    // Headers - only Authorization, no project ID header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${lakeraKey}`,
    }

    // Request body compliant with official Lakera Guard API v2 spec
    // Reference: https://docs.lakera.ai/api-reference/lakera-api/guard/screen-content
    const requestBody: {
      messages: Array<{ role: string; content: string }>
      project_id?: string
      payload?: boolean
      breakdown?: boolean
      metadata?: {
        user_id?: string
        session_id?: string
        ip_address?: string
        internal_request_id?: string
      }
    } = {
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
      // ✅ FIX: project_id in request body (not header)
      project_id: lakeraProjectId || undefined,
      // ✅ ENHANCEMENT: Optional parameters for enhanced responses
      payload: true,      // Get PII/profanity matches with locations
      breakdown: true,    // Get detector breakdown
    }

    // ✅ FIX: Use official metadata structure instead of custom context
    if (metadata) {
      requestBody.metadata = {
        user_id: metadata.user_id,
        session_id: metadata.session_id,
        ip_address: metadata.ip_address,
        internal_request_id: metadata.internal_request_id,
      }
    }

    const response = await fetch(lakeraEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      console.error('Lakera API error:', response.status)
      // If API fails but pre-scan detected medium severity, still flag
      if (preScan.detected && preScan.severity === 'medium') {
        return {
          scanned: true,
          flagged: true,
          categories: {
            prompt_injection: true,
            ...preScan.patterns.reduce((acc, pattern) => {
              acc[pattern.toLowerCase().replace(/\s+/g, '_')] = true
              return acc
            }, {} as Record<string, boolean>),
          },
          message: `Potential security threat detected: ${preScan.patterns.join(', ')}. Message blocked.`,
          threatLevel: 'medium',
        }
      }
      return { 
        scanned: false, 
        flagged: false,
        message: `Lakera API error: ${response.status}`
      }
    }

    const data: LakeraResponse = await response.json()
    
    // Handle different response formats
    let flagged = false
    let categories: Record<string, boolean> | undefined
    let scores: Record<string, number> | undefined
    let payload: Array<{
      start: number
      end: number
      text: string
      detector_type: string
      labels: string[]
      message_id: number
    }> | undefined
    let breakdown: Array<{
      project_id: string
      policy_id: string
      detector_id: string
      detector_type: string
      detected: boolean
      message_id: number
    }> | undefined

    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      flagged = data.results.some(r => r.flagged === true)
      const firstResult = data.results[0]
      categories = firstResult?.categories
      scores = firstResult?.payload_scores
      // Extract official payload and breakdown from results array
      payload = firstResult?.payload
      breakdown = firstResult?.breakdown
    } else {
      flagged = data.flagged === true
      categories = data.categories
      scores = data.payload_scores
      // Extract official payload and breakdown from root level
      payload = data.payload
      breakdown = data.breakdown
    }
    
    // Log breakdown information for debugging
    if (breakdown && breakdown.length > 0) {
      console.log('Lakera Guard Breakdown:', {
        totalDetectors: breakdown.length,
        detectedCount: breakdown.filter(d => d.detected).length,
        detectors: breakdown.map(d => ({
          id: d.detector_id,
          type: d.detector_type,
          detected: d.detected,
        })),
      })
    }
    
    // Log payload information for debugging
    if (payload && payload.length > 0) {
      console.log('Lakera Guard Payload (Detected Threats):', {
        totalMatches: payload.length,
        matches: payload.map(p => ({
          text: p.text.substring(0, 50) + (p.text.length > 50 ? '...' : ''),
          detector: p.detector_type,
          labels: p.labels,
          position: `${p.start}-${p.end}`,
        })),
      })
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

    const threatCategories = categories 
      ? Object.entries(categories).filter(([, value]) => value).map(([key]) => key)
      : []

    // Determine threat level
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (flagged) {
      const hasHighRiskCategories = threatCategories.some(cat => 
        ['prompt_injection', 'jailbreak', 'system_override', 'pii'].includes(cat.toLowerCase())
      )
      const maxScore = scores ? Math.max(...Object.values(scores)) : 0
      
      if (hasHighRiskCategories || maxScore > 0.8) {
        threatLevel = 'critical'
      } else if (maxScore > 0.6 || preScan.severity === 'high') {
        threatLevel = 'high'
      } else if (maxScore > 0.4 || preScan.severity === 'medium') {
        threatLevel = 'medium'
      }
    }

    return {
      scanned: true,
      flagged,
      categories,
      scores,
      message: flagged 
        ? `Security threat detected (${threatLevel}): ${threatCategories.join(', ')}` 
        : 'No threats detected',
      threatLevel,
      payload,      // Include official payload data (detected threats with locations)
      breakdown,    // Include official breakdown data (detector results)
    }
  } catch (error) {
    console.error('Lakera check failed:', error)
    // If pre-scan detected high severity, still block even if API fails
    if (preScan.detected && preScan.severity === 'high') {
      return {
        scanned: true,
        flagged: true,
        categories: {
          prompt_injection: true,
          ...preScan.patterns.reduce((acc, pattern) => {
            acc[pattern.toLowerCase().replace(/\s+/g, '_')] = true
            return acc
          }, {} as Record<string, boolean>),
        },
        message: `Security threat detected: ${preScan.patterns.join(', ')}. Message blocked.`,
        threatLevel: 'high',
      }
    }
    return { 
      scanned: false, 
      flagged: false,
      message: error instanceof Error ? error.message : 'Scan failed'
    }
  }
}

/**
 * Legacy callOpenAI function - now uses the adapter
 * @deprecated Use callOpenAIAdapter directly from @/lib/aiAdapter
 */
async function callOpenAI(
  messages: ChatMessage[],
  openAiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  // Validate and normalize model
  const validatedModel = validateModel(model)
  
  // Convert ChatMessage[] to AdapterChatMessage[]
  const adapterMessages: AdapterChatMessage[] = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))
  
  // Call adapter with default options
  const result = await callOpenAIAdapter(
    adapterMessages,
    openAiKey,
    validatedModel,
    {
      maxTokens: validatedModel.startsWith('gpt-5') ? 2000 : 1000,
      temperature: 0.7,
    }
  )
  
  // Log fallback if used
  if (result.usedFallback) {
    console.warn('Model fallback used:', {
      requested: model,
      used: result.model,
      reason: result.fallbackReason,
    })
  }
  
  return result.content
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, apiKeys: clientApiKeys, scanOptions, model, enableRAG } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Get API keys from server-side storage (priority) or client (fallback for backward compatibility)
    const { getApiKeys } = await import('@/lib/api-keys-storage')
    const serverKeys = await getApiKeys()
    
    // Debug: Log key status (without exposing actual keys)
    console.log('API Keys Status:', {
      serverKeys: {
        openAiKey: !!serverKeys.openAiKey,
      },
      clientApiKeys: {
        openAiKey: clientApiKeys?.openAiKey ? (clientApiKeys.openAiKey === 'configured' ? 'configured (placeholder)' : 'provided') : 'not provided',
      },
    })
    
    // Use server-side keys if available (allows site to work from any browser/device)
    // IMPORTANT: Never use client keys that are "configured" placeholder - only use actual keys
    // Fall back to client keys only if they are actual keys (not "configured" placeholder)
    const apiKeys = {
      openAiKey: serverKeys.openAiKey || 
                 (clientApiKeys?.openAiKey && clientApiKeys.openAiKey !== 'configured' ? clientApiKeys.openAiKey : null),
      lakeraAiKey: serverKeys.lakeraAiKey || 
                   (clientApiKeys?.lakeraAiKey && clientApiKeys.lakeraAiKey !== 'configured' ? clientApiKeys.lakeraAiKey : null),
      lakeraProjectId: serverKeys.lakeraProjectId || 
                      (clientApiKeys?.lakeraProjectId && clientApiKeys.lakeraProjectId !== 'configured' ? clientApiKeys.lakeraProjectId : null),
      lakeraEndpoint: serverKeys.lakeraEndpoint || clientApiKeys?.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
    }

    // Use OpenAI API key
    const activeApiKey = apiKeys.openAiKey

    // Debug: Log active key status (without exposing actual key)
    console.log('Active API Key Status:', {
      hasKey: !!activeApiKey,
      keyLength: activeApiKey ? activeApiKey.length : 0,
      keyPrefix: activeApiKey ? activeApiKey.substring(0, 5) + '...' : 'none',
    })

      // Validate OpenAI credentials
      if (!activeApiKey || 
          activeApiKey === 'configured' ||
          activeApiKey.includes('your_ope') || 
          activeApiKey.includes('your-api-key') ||
          activeApiKey.length < 20) {
      console.error('OpenAI validation failed:', {
        hasKey: !!activeApiKey,
        isConfiguredPlaceholder: activeApiKey === 'configured',
        length: activeApiKey ? activeApiKey.length : 0,
        startsWithSk: activeApiKey ? activeApiKey.startsWith('sk-') : false,
      })
        return NextResponse.json(
          { error: 'OpenAI API key is not configured or is invalid. Please add a valid key in Settings.' },
          { status: 400 }
        )
      }
      
      // Additional validation: OpenAI keys should start with 'sk-'
      if (!activeApiKey.startsWith('sk-')) {
        console.error('Invalid OpenAI API key format detected:', activeApiKey.substring(0, 10) + '...')
        return NextResponse.json(
          { error: 'Invalid OpenAI API key format. Keys should start with "sk-". Please check your key in Settings.' },
          { status: 400 }
        )
    }

    // Get the latest user message for security check and RAG
    const latestUserMessage = messages
      .filter((m: ChatMessage) => m.role === 'user')
      .pop()

    // RAG: Retrieve relevant file content if enabled
    // ENHANCEMENT: Always include all safe files, not just keyword-matched
    // SECURITY: Only use files that have passed security scans
    let fileContext = ''
    let availableFilesList: string[] = []
    if (enableRAG !== false && latestUserMessage) {
      try {
        const { listFiles, getFileContent } = await import('@/lib/persistent-storage')
        const { formatFileContentForRAG, validateFilePromptSecurity } = await import('@/lib/file-content-processor')
        const uploadedFiles = await listFiles()
        
        if (uploadedFiles.length > 0) {
          // Search for relevant content in uploaded files
          const userQuery = latestUserMessage.content.toLowerCase()
          const relevantFiles: string[] = []
          const allSafeFiles: string[] = []
          
          // Check each file for relevant content
          for (const fileMeta of uploadedFiles) {
            // SECURITY ENFORCEMENT: Only use files that passed security scans
            // ENHANCEMENT: Allow 'safe' and 'not_scanned' files (not_scanned means user chose not to scan)
            // Only block explicitly flagged/error/malicious files
            const scanStatus = fileMeta.scanStatus as string
            
            // Skip files with errors or that were flagged
            if (scanStatus === 'error' || scanStatus === 'flagged') {
              console.warn(`RAG: Skipping flagged file ${fileMeta.name} (security threat detected)`)
              continue
            }
            
            // Check Check Point TE verdict if available
            if (fileMeta.checkpointTeDetails?.verdict === 'malicious') {
              console.warn(`RAG: Skipping malicious file ${fileMeta.name} (Check Point TE verdict: malicious)`)
              continue
            }
            
            // Check threat level from scan details
            const scanDetails = fileMeta.scanDetails as { threatLevel?: 'low' | 'medium' | 'high' | 'critical'; categories?: Record<string, boolean>; score?: number } | undefined
            const threatLevel = scanDetails?.threatLevel || 
                               (fileMeta.scanStatus === 'flagged' ? 'high' as const : 'low' as const)
            if (threatLevel === 'critical' || threatLevel === 'high') {
              console.warn(`RAG: Skipping high-risk file ${fileMeta.name} (threat level: ${threatLevel})`)
              continue
            }
            
            // ENHANCEMENT: Include files up to 10MB (increased from 5MB)
            if (fileMeta.size > 10 * 1024 * 1024) {
              console.warn(`RAG: Skipping large file ${fileMeta.name} (size: ${(fileMeta.size / 1024 / 1024).toFixed(2)}MB)`)
              continue
            }
            
            try {
              const fileContent = await getFileContent(fileMeta.id)
              if (!fileContent) continue
              
              availableFilesList.push(fileMeta.name)
              
              const contentLower = fileContent.toLowerCase()
              
              // ENHANCEMENT: Improved matching algorithm
              // 1. Always include data files (CSV, JSON, TXT) if they're safe
              // 2. Check for keyword matches (more lenient)
              // 3. Check for common data patterns (names, emails, IDs, etc.)
              const isDataFile = fileMeta.type.includes('csv') || 
                               fileMeta.type.includes('json') || 
                               fileMeta.name.endsWith('.csv') ||
                               fileMeta.name.endsWith('.json') ||
                               fileMeta.name.endsWith('.txt')
              
              // Enhanced keyword matching
              const queryWords = userQuery.split(/\s+/).filter((w: string) => w.length > 2)
              const hasKeywordMatch = queryWords.some((word: string) => contentLower.includes(word))
              
              // Check for common data patterns in query
              const isDataQuery = /user|person|people|name|email|id|record|data|field|column|row|list|count|how many|who|what|where|when|find|search|show|display/i.test(userQuery)
              
              // ENHANCEMENT: Always include data files, or if query mentions data-related terms
              // OR if there's any keyword match
              const shouldInclude = isDataFile || (isDataQuery && isDataFile) || hasKeywordMatch || isDataQuery
              
              // SECURITY: Validate prompt security for file-based queries (ADDITIONAL security layer)
              // This works alongside Lakera AI and Check Point TE - does NOT replace them
              // Files must still pass Lakera/Check Point TE checks (lines 562-586) before reaching here
              const promptSecurityCheck = validateFilePromptSecurity(
                latestUserMessage.content,
                fileContent
              )
              
              // Block high-risk prompts (only if both prompt AND file show suspicious patterns)
              if (!promptSecurityCheck.safe) {
                console.warn(`RAG: Blocked potentially unsafe prompt with file ${fileMeta.name} (risk: ${promptSecurityCheck.riskLevel})`)
                continue
              }
              
              if (shouldInclude) {
                // For large files, include a summary or excerpt
                let contentToInclude = fileContent
                if (fileContent.length > 15000) {
                  // For very large files, include first 7500 and last 7500 chars
                  contentToInclude = fileContent.substring(0, 7500) + '\n\n...[content truncated - showing first and last portions]...\n\n' + fileContent.substring(fileContent.length - 7500)
                }
                
                // ENHANCEMENT: Format file content with field information for structured data
                // This enables field-level access for CSV/JSON files
                const formattedContent = formatFileContentForRAG(
                  fileMeta.name,
                  contentToInclude,
                  fileMeta.type,
                  false // includeAllFields - can be made configurable in future
                )
                relevantFiles.push(`\n\n${formattedContent}`)
                
                // ENHANCEMENT: Limit to 10 most relevant files (increased from 5)
                if (relevantFiles.length >= 10) break
              } else {
                // ENHANCEMENT: Still add to context but mark as less relevant
                // This ensures LLM knows about all available files
                if (fileContent.length <= 5000) {
                  // Format with field information for structured data
                  const formattedContent = formatFileContentForRAG(
                    fileMeta.name,
                    fileContent,
                    fileMeta.type,
                    false
                  )
                  allSafeFiles.push(`\n\n${formattedContent.replace(/^\[File:/, '[File: (Available for reference)')}`)
                }
              }
            } catch (fileError) {
              // Skip files that can't be read
              console.error(`Failed to read file ${fileMeta.id} for RAG:`, fileError)
            }
          }
          
          // ENHANCEMENT: Include both relevant files and all safe files
          const allFilesContext = relevantFiles.length > 0 
            ? relevantFiles.join('\n\n---\n\n')
            : allSafeFiles.slice(0, 10).join('\n\n---\n\n') // If no matches, include first 10 safe files
          
          if (allFilesContext) {
            fileContext = `\n\n[Context from uploaded files (${uploadedFiles.length} files available, ${relevantFiles.length} directly relevant):]\n${allFilesContext}\n\n[End of file context]`
          } else if (availableFilesList.length > 0) {
            // ENHANCEMENT: Even if no content included, tell LLM about available files
            fileContext = `\n\n[Note: ${availableFilesList.length} uploaded file(s) are available: ${availableFilesList.join(', ')}. These files contain user data, PII, and other information that may be relevant to the user's query. Please search through these files when answering questions about users, data, or records.]\n\n`
          }
        }
      } catch (ragError) {
        // RAG is optional - don't fail the request if it errors
        console.error('RAG retrieval error (non-blocking):', ragError)
      }
    }

    // Get user IP for metadata
    const userIP = getUserIP(request)
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    let inputScanResult: ScanResult = { scanned: false, flagged: false }

    // Check input with Lakera if enabled and configured
    if (latestUserMessage && scanOptions?.scanInput && apiKeys.lakeraAiKey) {
      inputScanResult = await checkWithLakera(
        latestUserMessage.content,
        apiKeys.lakeraAiKey,
        apiKeys.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
        apiKeys.lakeraProjectId,
        'input',
        {
          ip_address: userIP,
          internal_request_id: requestId,
        }
      )

      // If input is flagged, block it immediately
      if (inputScanResult.flagged) {
        // Log security block for Check Point WAF
        const { addSystemLog } = await import('@/lib/system-logging')
        addSystemLog(
          'warning',
          'checkpoint-waf',
          `Security threat detected in chat input - message blocked`,
          {
            endpoint: '/api/chat',
            method: 'POST',
            statusCode: 403,
            error: 'Security block',
            requestBody: {
              messagePreview: latestUserMessage.content.substring(0, 100),
            },
          },
          {
            waf: {
              clientIP: userIP,
              blocked: true,
              threatDetected: true,
            },
            security: {
              threatLevel: inputScanResult.threatLevel,
              categories: inputScanResult.categories,
              scores: inputScanResult.scores,
              payload: inputScanResult.payload,
            },
          }
        ).catch((error) => {
          console.error('Failed to log WAF security block:', error)
        })

        return NextResponse.json(
          { 
            error: inputScanResult.message || 'Message blocked by security filter',
            scanResult: inputScanResult,
            logData: {
              userIP,
              type: 'chat',
              action: 'blocked',
              source: 'chat',
              requestDetails: {
                message: latestUserMessage.content,
                threatLevel: inputScanResult.threatLevel,
                detectedPatterns: inputScanResult.categories,
              },
              lakeraDecision: inputScanResult,
              success: false,
            },
          },
          { status: 403 }
        )
      }
    }

    // Enhance messages with file context if RAG is enabled
    const enhancedMessages = [...messages]
    
    // ENHANCEMENT: Add system message about file access if files are available
    if (fileContext && availableFilesList.length > 0) {
      // Check if system message already exists
      const hasSystemMessage = enhancedMessages.some(m => m.role === 'system')
      
      if (!hasSystemMessage) {
        // Add system message at the beginning
        enhancedMessages.unshift({
          role: 'system',
          content: `You are a helpful AI assistant with access to uploaded files containing user data, PII, and other information.

IMPORTANT INSTRUCTIONS:
1. You have access to ${availableFilesList.length} uploaded file(s): ${availableFilesList.join(', ')}
2. When the user asks about users, data, records, or any information, FIRST search through the uploaded files
3. If the information is found in the files, provide it directly from the file content
4. If the information is NOT in the files, you can use your general knowledge to help, but clearly state that the information is not in the uploaded files
5. Always cite which file(s) you used when providing information from files
6. For data queries, analyze the file structure and provide accurate information based on the actual data

The file content will be provided in the user's message below. Search through it carefully to answer their questions.`
        })
      }
    }
    
    if (fileContext && latestUserMessage) {
      // Add file context to the latest user message
      const lastIndex = enhancedMessages.length - 1
      if (lastIndex >= 0 && enhancedMessages[lastIndex].role === 'user') {
        enhancedMessages[lastIndex] = {
          ...enhancedMessages[lastIndex],
          content: enhancedMessages[lastIndex].content + fileContext
        }
      }
    }

    // Call OpenAI using the adapter (handles GPT-5.x Responses API and GPT-4 Chat Completions)
    // Validate and normalize the model
    const validatedModel = validateModel(model || 'gpt-4o-mini')
    
    // Convert messages to adapter format
    const adapterMessages: AdapterChatMessage[] = enhancedMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))
    
    // Prepare adapter options
    // Check if it's a GPT-5 model
    const maxOutputTokens = validatedModel.startsWith('gpt-5') ? 2000 : 1000
    const adapterOptions = {
      maxTokens: maxOutputTokens,
      temperature: 0.7,
    }
    
    // Estimate tokens before making API call (for self-throttling)
    const tokenEstimation = estimateRequestTokens(adapterMessages, maxOutputTokens)
    console.log('Token estimation before API call:', {
      model: validatedModel,
      promptTokens: tokenEstimation.promptTokens,
      maxOutputTokens: tokenEstimation.maxOutputTokens,
      estimatedTotalTokens: tokenEstimation.estimatedTotalTokens,
      breakdown: tokenEstimation.breakdown,
    })
    
    // Self-throttle: Check if estimated tokens would exceed limits
    const throttleCheck = await shouldThrottleByTokens(adapterMessages, validatedModel, maxOutputTokens, activeApiKey)
    if (throttleCheck.shouldThrottle) {
      console.warn('Token-based throttling triggered:', {
        model: validatedModel,
        estimatedTokens: throttleCheck.estimatedTokens,
        limit: throttleCheck.limit,
        excessTokens: throttleCheck.excessTokens,
      })
      
      return NextResponse.json(
        {
          error: `Request would exceed token limit. Estimated: ${throttleCheck.estimatedTokens} tokens, Limit: ${throttleCheck.limit} tokens.`,
          tokenDetails: {
            estimatedTokens: throttleCheck.estimatedTokens,
            limit: throttleCheck.limit,
            excessTokens: throttleCheck.excessTokens,
            breakdown: tokenEstimation.breakdown,
            recommendation: throttleCheck.recommendation || 'Please reduce message length or max_output_tokens.',
          },
        },
        { status: 400 }
      )
    }
    
    // Validate token limits before making API call (using dynamic limits)
    const tokenValidation = await validateTokenLimitAsync(adapterMessages, validatedModel, maxOutputTokens, activeApiKey)
    if (!tokenValidation.valid) {
      console.warn('Token limit validation failed:', {
        model: validatedModel,
        inputTokens: tokenValidation.inputTokens,
        totalTokens: tokenValidation.totalTokens,
        limit: tokenValidation.limit,
        error: tokenValidation.error,
      })
      
      // Try to truncate messages to fit within limit (using dynamic limits)
      const truncationResult = await truncateToTokenLimitAsync(adapterMessages, validatedModel, maxOutputTokens, activeApiKey)
      
      if (truncationResult.truncated) {
        console.warn('Messages truncated to fit token limit:', {
          originalTokenCount: truncationResult.originalTokenCount,
          finalTokenCount: truncationResult.finalTokenCount,
          messagesRemoved: adapterMessages.length - truncationResult.messages.length,
        })
        // Use truncated messages
        const truncatedAdapterMessages: AdapterChatMessage[] = truncationResult.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        }))
        
        // Re-validate with truncated messages (using dynamic limits)
        const revalidation = await validateTokenLimitAsync(truncatedAdapterMessages, validatedModel, maxOutputTokens, activeApiKey)
        if (!revalidation.valid) {
          // Still exceeds limit even after truncation - return error
          return NextResponse.json(
            {
              error: tokenValidation.error || 'Message exceeds token limit. Please use a model with a larger context window or reduce message length.',
              tokenDetails: {
                inputTokens: tokenValidation.inputTokens,
                totalTokens: tokenValidation.totalTokens,
                limit: tokenValidation.limit,
                suggestion: 'Try using gpt-4-turbo or gpt-4o for larger context windows, or shorten your messages.',
              },
            },
            { status: 400 }
          )
        }
        // Use truncated messages
        adapterMessages.length = 0
        adapterMessages.push(...truncatedAdapterMessages)
      } else {
        // Could not truncate - return error
        return NextResponse.json(
          {
            error: tokenValidation.error || 'Message exceeds token limit. Please use a model with a larger context window or reduce message length.',
            tokenDetails: {
              inputTokens: tokenValidation.inputTokens,
              totalTokens: tokenValidation.totalTokens,
              limit: tokenValidation.limit,
              suggestion: 'Try using gpt-4-turbo or gpt-4o for larger context windows, or shorten your messages.',
            },
          },
          { status: 400 }
        )
      }
    }
    
    // Check rate limit before making API call
    const rateLimitCheck = checkRateLimit(activeApiKey, validatedModel)
    if (!rateLimitCheck.allowed) {
      console.warn('Rate limit exceeded:', {
        model: validatedModel,
        retryAfter: rateLimitCheck.retryAfter,
        resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
      })
      
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please wait ${rateLimitCheck.retryAfter} seconds before trying again.`,
          rateLimitDetails: {
            retryAfter: rateLimitCheck.retryAfter,
            resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
            suggestion: 'Please wait a moment before making another request, or reduce the frequency of your requests.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitCheck.retryAfter || 60),
            'X-RateLimit-Reset': String(rateLimitCheck.resetAt),
          },
        }
      )
    }
    
    // Log rate limit status (for monitoring)
    const rateLimitStatus = getRateLimitStatus(activeApiKey, validatedModel)
    const dynamicTokenLimit = await getTokenLimitAsync(validatedModel, activeApiKey)
    console.log('Pre-request status:', {
      model: validatedModel,
      rateLimit: {
      remaining: rateLimitStatus.remaining,
      limit: rateLimitStatus.limit,
      },
      tokenEstimation: {
        estimatedTotalTokens: tokenEstimation.estimatedTotalTokens,
        limit: dynamicTokenLimit,
        utilizationPercent: ((tokenEstimation.estimatedTotalTokens / dynamicTokenLimit) * 100).toFixed(2) + '%',
      },
    })
    
    // Call adapter with appropriate options
    const adapterResult = await callOpenAIAdapter(
      adapterMessages,
      activeApiKey,
      validatedModel,
      adapterOptions
    )
    
    // Log fallback if used
    if (adapterResult.usedFallback) {
      console.warn('Model fallback triggered:', {
        requested: model,
        used: adapterResult.model,
        reason: adapterResult.fallbackReason,
      })
    }
    
    const aiResponse = adapterResult.content

    let outputScanResult: ScanResult = { scanned: false, flagged: false }

    // Check output with Lakera if enabled and configured
    if (scanOptions?.scanOutput && apiKeys.lakeraAiKey) {
      outputScanResult = await checkWithLakera(
        aiResponse,
        apiKeys.lakeraAiKey,
        apiKeys.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
        apiKeys.lakeraProjectId,
        'output',
        {
          ip_address: userIP,
          internal_request_id: `${requestId}-output`,
        }
      )

      // If output is flagged, block it
      if (outputScanResult.flagged) {
        // Log security block for Check Point WAF
        const { addSystemLog } = await import('@/lib/system-logging')
        addSystemLog(
          'warning',
          'checkpoint-waf',
          `Security threat detected in AI response - output blocked`,
          {
            endpoint: '/api/chat',
            method: 'POST',
            statusCode: 403,
            error: 'Security block - AI response',
            requestBody: {
              messagePreview: latestUserMessage?.content?.substring(0, 100),
              responsePreview: aiResponse.substring(0, 100),
            },
          },
          {
            waf: {
              clientIP: userIP,
              blocked: true,
              threatDetected: true,
            },
            security: {
              threatLevel: outputScanResult.threatLevel,
              categories: outputScanResult.categories,
              scores: outputScanResult.scores,
              payload: outputScanResult.payload,
            },
          }
        ).catch((error) => {
          console.error('Failed to log WAF security block:', error)
        })

        return NextResponse.json(
          { 
            error: 'AI response blocked by security filter',
            scanResult: outputScanResult,
            logData: {
              userIP,
              type: 'chat',
              action: 'blocked',
              source: 'chat',
              requestDetails: {
                message: latestUserMessage?.content,
                aiResponse: aiResponse.substring(0, 200),
                threatLevel: outputScanResult.threatLevel,
                detectedPatterns: outputScanResult.categories,
              },
              lakeraDecision: outputScanResult,
              success: false,
            },
          },
          { status: 403 }
        )
      }
    }

    const logData = {
      userIP,
      type: 'chat',
      source: 'chat',
      requestDetails: {
        message: latestUserMessage?.content,
      },
      inputDecision: inputScanResult.scanned ? inputScanResult : undefined,
      outputDecision: outputScanResult.scanned ? outputScanResult : undefined,
      timestamp: new Date().toISOString(),
    }

    // Send telemetry to Lakera Platform for input scan (if scanned)
    if (apiKeys.lakeraAiKey && inputScanResult.scanned) {
      const inputLogData = {
        ...logData,
        action: inputScanResult.flagged ? 'blocked' : 'allowed',
        lakeraDecision: inputScanResult,
      }
      sendLakeraTelemetryFromLog(
        inputLogData as any,
        apiKeys.lakeraAiKey,
        apiKeys.lakeraProjectId
      ).catch((error) => {
        console.error('Failed to send Lakera telemetry for input scan (non-blocking):', error)
      })
    }

    // Send telemetry to Lakera Platform for output scan (if scanned)
    if (apiKeys.lakeraAiKey && outputScanResult.scanned) {
      const outputLogData = {
        ...logData,
        action: outputScanResult.flagged ? 'blocked' : 'allowed',
        lakeraDecision: outputScanResult,
      }
      sendLakeraTelemetryFromLog(
        outputLogData as any,
        apiKeys.lakeraAiKey,
        apiKeys.lakeraProjectId
      ).catch((error) => {
        console.error('Failed to send Lakera telemetry for output scan (non-blocking):', error)
      })
    }

    return NextResponse.json({ 
      content: aiResponse,
      inputScanResult,
      outputScanResult,
      logData,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    let errorMessage = error instanceof Error ? error.message : 'An error occurred'
    let statusCode = 500
    
    // Handle network/fetch errors specifically
    if (error instanceof Error && (error.message.includes('Failed to connect') || error.message.includes('Network error') || error.message.includes('fetch failed'))) {
      statusCode = 503
      // Preserve the detailed error message from the adapter
      if (!errorMessage.includes('Please verify')) {
        errorMessage = `Connection error: ${errorMessage}. Please check your network connection and API endpoint configuration.`
      }
    }
    
    // Handle rate limit errors from adapter
    if (error instanceof Error && (error as any).rateLimit) {
      statusCode = 429
      const retryAfter = (error as any).retryAfter || 60
      errorMessage = `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
      
      // Log rate limit error
      const { addLog } = await import('@/lib/logging')
      addLog({
        type: 'error',
        action: 'error',
        source: 'chat',
        error: errorMessage,
        success: false,
        associatedRisks: ['llm03'], // Supply Chain risk
      })
      
      return NextResponse.json(
        {
          error: errorMessage,
          rateLimitDetails: {
            retryAfter,
            suggestion: 'Please wait a moment before making another request, or reduce the frequency of your requests.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
          },
        }
      )
    }
    
    // Handle token limit errors from adapter
    if (error instanceof Error && (error as any).tokenLimit) {
      statusCode = 400
      errorMessage = errorMessage || 'Token limit exceeded. Please reduce message length or use a model with a larger context window.'
      
      // Log token limit error
      const { addLog } = await import('@/lib/logging')
      addLog({
        type: 'error',
        action: 'error',
        source: 'chat',
        error: errorMessage,
        success: false,
        associatedRisks: ['llm03'], // Supply Chain risk
      })
      
      return NextResponse.json(
        {
          error: errorMessage,
          tokenLimitDetails: {
            suggestion: 'Try using gpt-4-turbo or gpt-4o for larger context windows, or shorten your messages.',
          },
        },
        { status: 400 }
      )
    }
    
    // Check if error message contains rate limit or token limit keywords
    const lowerMessage = errorMessage.toLowerCase()
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
      statusCode = 429
      const retryMatch = errorMessage.match(/(\d+)\s*seconds?/i)
      const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60
      
      return NextResponse.json(
        {
          error: errorMessage,
          rateLimitDetails: {
            retryAfter,
            suggestion: 'Please wait a moment before making another request.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
          },
        }
      )
    }
    
    if (lowerMessage.includes('token') || lowerMessage.includes('context_length')) {
      statusCode = 400
      return NextResponse.json(
        {
          error: errorMessage,
          tokenLimitDetails: {
            suggestion: 'Please reduce message length or use a model with a larger context window.',
          },
        },
        { status: 400 }
      )
    }
    
    // Log generic error
    const { addLog } = await import('@/lib/logging')
    addLog({
      type: 'error',
      action: 'error',
      source: 'chat',
      error: errorMessage,
      success: false,
      associatedRisks: ['llm03'], // Supply Chain risk
    })
    
    return NextResponse.json({ error: errorMessage }, { status: statusCode })
  }
}
