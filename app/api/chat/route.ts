import { NextRequest, NextResponse } from 'next/server'
import { getUserIP } from '@/lib/logging'
import { sendLakeraTelemetryFromLog } from '@/lib/lakera-telemetry'
import { callOpenAI as callOpenAIAdapter, validateModel, type ChatMessage as AdapterChatMessage } from '@/lib/aiAdapter'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

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
}

interface ScanResult {
  scanned: boolean
  flagged: boolean
  categories?: Record<string, boolean>
  scores?: Record<string, number>
  message?: string
  threatLevel?: 'low' | 'medium' | 'high' | 'critical'
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

    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      flagged = data.results.some(r => r.flagged === true)
      categories = data.results[0]?.categories
      scores = data.results[0]?.payload_scores
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
    
    // Use server-side keys if available (allows site to work from any browser/device)
    // Fall back to client keys only if server-side keys are not configured (backward compatibility)
    const apiKeys = {
      openAiKey: serverKeys.openAiKey || clientApiKeys?.openAiKey || null,
      lakeraAiKey: serverKeys.lakeraAiKey || clientApiKeys?.lakeraAiKey || null,
      lakeraProjectId: serverKeys.lakeraProjectId || clientApiKeys?.lakeraProjectId || null,
      lakeraEndpoint: serverKeys.lakeraEndpoint || clientApiKeys?.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
    }

    // Validate API key is not a placeholder
    if (!apiKeys.openAiKey || 
        apiKeys.openAiKey.includes('your_ope') || 
        apiKeys.openAiKey.includes('your-api-key') ||
        apiKeys.openAiKey.length < 20) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured or is invalid. Please add a valid key in Settings.' },
        { status: 400 }
      )
    }
    
    // Additional validation: OpenAI keys should start with 'sk-'
    if (!apiKeys.openAiKey.startsWith('sk-')) {
      console.error('Invalid OpenAI API key format detected:', apiKeys.openAiKey.substring(0, 10) + '...')
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
    // SECURITY: Only use files that have passed security scans
    let fileContext = ''
    if (enableRAG !== false && latestUserMessage) {
      try {
        const { listFiles, getFileContent } = await import('@/lib/persistent-storage')
        const uploadedFiles = await listFiles()
        
        if (uploadedFiles.length > 0) {
          // Search for relevant content in uploaded files
          const userQuery = latestUserMessage.content.toLowerCase()
          const relevantFiles: string[] = []
          
          // Check each file for relevant content
          for (const fileMeta of uploadedFiles) {
            // SECURITY ENFORCEMENT: Only use files that passed security scans
            // Block files that:
            // - Have not been scanned (scanStatus: 'pending' or 'not_scanned')
            // - Were flagged as malicious (scanStatus: 'error' or scanResult indicates threat)
            // - Failed Check Point TE scan (checkpointTeDetails.verdict: 'malicious')
            // - Have high/critical threat levels
            
            // Skip unscanned files
            const scanStatus = fileMeta.scanStatus as string
            if (scanStatus === 'pending' || scanStatus === 'not_scanned') {
              console.warn(`RAG: Skipping unscanned file ${fileMeta.name} (security requirement)`)
              continue
            }
            
            // Skip files with errors or that were flagged
            if (scanStatus === 'error' || (fileMeta.scanResult && fileMeta.scanResult.toLowerCase().includes('blocked'))) {
              console.warn(`RAG: Skipping flagged file ${fileMeta.name} (security threat detected)`)
              continue
            }
            
            // Check Check Point TE verdict if available
            if (fileMeta.checkpointTeDetails?.verdict === 'malicious') {
              console.warn(`RAG: Skipping malicious file ${fileMeta.name} (Check Point TE verdict: malicious)`)
              continue
            }
            
            // Check threat level from scan details
            // scanDetails may have threatLevel or we infer from scanStatus
            const scanDetails = fileMeta.scanDetails as { threatLevel?: 'low' | 'medium' | 'high' | 'critical'; categories?: Record<string, boolean>; score?: number } | undefined
            const threatLevel = scanDetails?.threatLevel || 
                               (fileMeta.scanStatus === 'flagged' ? 'high' as const : 'low' as const)
            if (threatLevel === 'critical' || threatLevel === 'high') {
              console.warn(`RAG: Skipping high-risk file ${fileMeta.name} (threat level: ${threatLevel})`)
              continue
            }
            
            // Skip binary files and very large files for RAG
            if (fileMeta.size > 5 * 1024 * 1024) continue // Skip files > 5MB
            
            try {
              const fileContent = await getFileContent(fileMeta.id)
              if (!fileContent) continue
              
              // Simple keyword matching - check if user query mentions terms that might be in the file
              // For files with many individuals, check if query contains names, IDs, or common fields
              const contentLower = fileContent.toLowerCase()
              
              // Check if file might be relevant (contains keywords from query or is a data file)
              const isDataFile = fileMeta.type.includes('csv') || fileMeta.type.includes('json') || fileMeta.name.endsWith('.csv')
              const hasRelevantContent = isDataFile || 
                userQuery.split(/\s+/).some((word: string) => word.length > 3 && contentLower.includes(word))
              
              if (hasRelevantContent) {
                // For large files, include a summary or excerpt
                let contentToInclude = fileContent
                if (fileContent.length > 10000) {
                  // For very large files, include first 5000 and last 5000 chars
                  contentToInclude = fileContent.substring(0, 5000) + '\n\n...[content truncated]...\n\n' + fileContent.substring(fileContent.length - 5000)
                }
                relevantFiles.push(`\n\n[File: ${fileMeta.name}]\n${contentToInclude}`)
                
                // Limit to 3 most relevant files to avoid token limits
                if (relevantFiles.length >= 3) break
              }
            } catch (fileError) {
              // Skip files that can't be read
              console.error(`Failed to read file ${fileMeta.id} for RAG:`, fileError)
            }
          }
          
          if (relevantFiles.length > 0) {
            fileContext = `\n\n[Context from uploaded files (security-scanned and verified):]\n${relevantFiles.join('\n\n---\n\n')}\n\n[End of file context]`
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
    // Validate and normalize model first
    const validatedModel = validateModel(model || 'gpt-4o-mini')
    
    // Convert messages to adapter format
    const adapterMessages: AdapterChatMessage[] = enhancedMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))
    
    // Call adapter with appropriate token limits
    const adapterResult = await callOpenAIAdapter(
      adapterMessages,
      apiKeys.openAiKey,
      validatedModel,
      {
        maxTokens: validatedModel.startsWith('gpt-5') ? 2000 : 1000,
        temperature: 0.7,
      }
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
    const message = error instanceof Error ? error.message : 'An error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
