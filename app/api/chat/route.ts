export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getUserIP } from '@/lib/logging'
import { sendLakeraTelemetryFromLog } from '@/lib/lakera-telemetry'
import { screenChatWithLakera, type GuardChatScanResult } from '@/lib/lakera/guard-client'
import {
  callOpenAI as callOpenAIAdapter,
  callAnthropic,
  callAzureOpenAI,
  validateModel,
  type ChatMessage as AdapterChatMessage,
} from '@/lib/aiAdapter'
import { callGemini, validateGeminiModelId } from '@/lib/geminiAdapter'
import { checkRateLimit, getRateLimitStatus } from '@/lib/rate-limiter'
import {
  validateTokenLimit,
  validateTokenLimitAsync,
  truncateToTokenLimit,
  truncateToTokenLimitAsync,
  estimateRequestTokens,
  shouldThrottleByTokens,
  getTokenLimitAsync,
} from '@/lib/token-counter'
import { injectRagContext, RAG_DATA_PRIVACY_INSTRUCTIONS } from '@/lib/rag-context'
import { requireSecureChatSession } from '@/lib/app-login'
import {
  effectiveLakeraAiKey,
  effectiveLakeraEndpoint,
  effectiveLakeraProjectId,
} from '@/lib/effective-lakera-client-merge'
import { config } from '@/lib/config'
import { resolveLakeraGuardEndpoint } from '@/lib/lakera-guard-endpoint'
import { lakeraGuardApiKeyEnvVarUsed } from '@/lib/api-keys-storage'
import { lakeraChatFlagAllowedInMonitoringMode } from '@/lib/lakera-guard-monitoring'
import { recordLakeraLastGuard, sanitizeGuardChatScanForClient } from '@/lib/lakera-guard-last'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Returns true only when the user is clearly asking about data/documents (who, list, find, etc.).
 * General knowledge questions (e.g. "what is depression") return false → model-only answer, no RAG, no Sources.
 */
function isFileOrDataQuestion(query: string): boolean {
  if (!query || typeof query !== 'string') return false
  const q = query.trim().toLowerCase()
  // Explicit file/data intent: who, which people, list, find, in the file, from the data, users with, records, etc.
  const fileDataPatterns = [
    /\b(who|which\s+people|which\s+person|list|find|show|get)\s+(is|are|has|have|with|on|using|holding|dealing|suffering|from)/i,
    /\b(in\s+(the\s+)?(file|data|document|upload))/i,
    /\b(from\s+(the\s+)?(file|data|document|upload))/i,
    /\b(users?|people|persons?|records?|rows?)\s+(with|who|that|where)/i,
    /\b(how\s+many)\s+(users?|people|records?)/i,
    /\b(data|records?|file\s+content)\s+(about|for|from)/i,
    /\b(search|look)\s+(in|through)\s+(the\s+)?(file|data|documents?)/i,
    /\b(tell\s+me\s+about|what\s+do\s+you\s+know\s+about|information\s+about|details?\s+(on|for|about))\b/i,
    /\b(who\s+is|who\s+are|who\s+works|who\s+has|who\s+have|which\s+company|which\s+companies)\b/i,
    /\b(visa|h-?1b|h1b|work\s+authorization|immigration|green\s+card|permanent\s+resident)\b/i,
    /\b(uploaded|my\s+upload|I\s+uploaded)\b.*\b(file|document|csv|data|spreadsheet|txt)\b/i,
    /\b(file|document|csv|spreadsheet)\b.*\b(uploaded|I\s+uploaded|my\s+upload)\b/i,
    /\b(according\s+to|based\s+on)\s+(the\s+)?(file|document|upload|csv|data|spreadsheet)\b/i,
    /\b(summarize|outline|parse)\b.*\b(file|document|upload|csv|spreadsheet)\b/i,
    /\bwhat(?:'s|s|\s+is)\s+in\s+(the\s+)?(file|document|upload|csv|spreadsheet)\b/i,
  ]
  if (fileDataPatterns.some(re => re.test(q))) return true
  const entityOrOrgCue =
    /\b(company|companies|corporation|corporate|business|firm|organization|org|individual|individuals|employee|employees|person|people|customer|client|vendor|supplier|contact|profile|stakeholder|director|manager|executive|founder|ceo|cfo|corp\.?|inc\.?|llc|ltd\.?)\b/i.test(
      q
    )
  if (entityOrOrgCue) return true
  // Purely general-knowledge phrasing: "what is X", "define X", "explain X" with no data cue
  const generalOnly =
    /^(what\s+is|what\s+are|define|explain|how\s+does|why\s+do(es)?|when\s+did)\s+/i.test(q) &&
    !/\b(file|data|document|upload|user|record|who|list|find)\b/i.test(q)
  return !generalOnly
}

type ScanResult = GuardChatScanResult

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
  const result = await callOpenAIAdapter(adapterMessages, openAiKey, validatedModel, {
    maxTokens: validatedModel.startsWith('gpt-5') ? 2000 : 1000,
    temperature: 0.7,
  })

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
    const authBlock = requireSecureChatSession(request)
    if (authBlock) return authBlock

    const body = await request.json()
    const {
      messages,
      apiKeys: clientApiKeys,
      scanOptions,
      model,
      enableRAG,
      lakeraRetrievalScan: lakeraRetrievalScanBody,
      provider: requestProvider,
    } = body
    const lakeraRetrievalScan = lakeraRetrievalScanBody !== false
    const provider = (
      requestProvider === 'anthropic'
        ? 'anthropic'
        : requestProvider === 'azure'
          ? 'azure'
          : requestProvider === 'google'
            ? 'google'
            : 'openai'
    ) as 'openai' | 'anthropic' | 'azure' | 'google'

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
    }

    // Get API keys from server-side storage (priority) or client (fallback for backward compatibility)
    const { getApiKeys } = await import('@/lib/api-keys-storage')
    const serverKeys = await getApiKeys()

    // Debug: booleans only — env vars override file storage (see lib/api-keys-storage merge).
    const effLakera = effectiveLakeraAiKey(serverKeys.lakeraAiKey, clientApiKeys?.lakeraAiKey)
    let lakeraResolvedGuardHostname = '(unparsed)'
    try {
      lakeraResolvedGuardHostname = new URL(
        resolveLakeraGuardEndpoint(serverKeys.lakeraEndpoint)
      ).hostname
    } catch {
      /* keep default */
    }
    console.log('API Keys Status:', {
      serverKeys: {
        openAiKey: !!serverKeys.openAiKey,
        lakeraAiKey: !!serverKeys.lakeraAiKey,
        lakeraProjectId: !!serverKeys.lakeraProjectId,
        lakeraEndpoint: !!serverKeys.lakeraEndpoint,
      },
      /** If any is "environment", Settings changes for that field are ignored until env is updated or unset. */
      lakeraEffectiveSources: {
        lakeraAiKey: lakeraGuardApiKeyEnvVarUsed() ? 'environment' : 'encrypted_storage_or_none',
        lakeraProjectId: process.env.LAKERA_PROJECT_ID?.trim() ? 'environment' : 'encrypted_storage_or_none',
        lakeraEndpoint: process.env.LAKERA_ENDPOINT?.trim() ? 'environment' : 'encrypted_storage_or_none',
      },
      lakeraEnvLakeraKeyVar: lakeraGuardApiKeyEnvVarUsed(),
      lakeraResolvedGuardHostname,
      lakeraEnforcement: {
        enforceStrict: config.lakeraEnforceStrict,
        requireProjectId: config.lakeraRequireProjectId,
        enforceInputOutputScan: config.lakeraEnforceInputOutputScan,
        failClosedOnAuthError: config.lakeraFailClosedOnAuthError,
      },
      lakeraEnvSet: {
        LAKERA_AI_KEY: !!process.env.LAKERA_AI_KEY?.trim(),
        LAKERA_API_KEY: !!process.env.LAKERA_API_KEY?.trim(),
        LAKERA_PROJECT_ID: !!process.env.LAKERA_PROJECT_ID?.trim(),
        LAKERA_ENDPOINT: !!process.env.LAKERA_ENDPOINT?.trim(),
      },
      lakeraEffectiveKeyConfigured: !!effLakera,
      clientApiKeys: {
        openAiKey: clientApiKeys?.openAiKey
          ? clientApiKeys.openAiKey === 'configured'
            ? 'configured (placeholder)'
            : 'provided'
          : 'not provided',
      },
    })

    // Use server-side keys if available (allows site to work from any browser/device)
    // IMPORTANT: Never use client keys that are "configured" placeholder - only use actual keys
    // Fall back to client keys only if they are actual keys (not "configured" placeholder)
    const apiKeys = {
      openAiKey:
        serverKeys.openAiKey ||
        (clientApiKeys?.openAiKey && clientApiKeys.openAiKey !== 'configured'
          ? clientApiKeys.openAiKey
          : null),
      azureOpenAiKey:
        serverKeys.azureOpenAiKey ||
        (clientApiKeys?.azureOpenAiKey && clientApiKeys.azureOpenAiKey !== 'configured'
          ? clientApiKeys.azureOpenAiKey
          : null),
      azureOpenAiEndpoint:
        serverKeys.azureOpenAiEndpoint || clientApiKeys?.azureOpenAiEndpoint || null,
      azureOpenAiApiVersion:
        serverKeys.azureOpenAiApiVersion ||
        clientApiKeys?.azureOpenAiApiVersion ||
        '2025-04-01-preview',
      anthropicApiKey:
        serverKeys.anthropicApiKey ||
        (clientApiKeys?.anthropicApiKey && clientApiKeys.anthropicApiKey !== 'configured'
          ? clientApiKeys.anthropicApiKey
          : null),
      geminiApiKey:
        serverKeys.geminiApiKey ||
        (clientApiKeys?.geminiApiKey && clientApiKeys.geminiApiKey !== 'configured'
          ? clientApiKeys.geminiApiKey
          : null),
      lakeraAiKey: effectiveLakeraAiKey(serverKeys.lakeraAiKey, clientApiKeys?.lakeraAiKey),
      lakeraProjectId: effectiveLakeraProjectId(
        serverKeys.lakeraProjectId,
        clientApiKeys?.lakeraProjectId
      ),
      lakeraEndpoint: effectiveLakeraEndpoint(
        serverKeys.lakeraEndpoint,
        clientApiKeys?.lakeraEndpoint
      ),
    }

    if (
      config.lakeraRequireProjectId &&
      apiKeys.lakeraAiKey?.trim() &&
      !apiKeys.lakeraProjectId?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            'Lakera is configured but no project ID is set. Set LAKERA_PROJECT_ID or Settings → Lakera Project ID, or disable LAKERA_REQUIRE_PROJECT_ID / LAKERA_ENFORCE_STRICT.',
        },
        { status: 503 }
      )
    }

    const activeApiKey =
      provider === 'anthropic'
        ? apiKeys.anthropicApiKey
        : provider === 'azure'
          ? apiKeys.azureOpenAiKey
          : provider === 'google'
            ? apiKeys.geminiApiKey
            : apiKeys.openAiKey

    console.log('Active API Key Status:', {
      provider,
      hasKey: !!activeApiKey,
      keyLength: activeApiKey ? activeApiKey.length : 0,
      keyPrefix: activeApiKey ? activeApiKey.substring(0, 8) + '...' : 'none',
    })

    if (provider === 'anthropic') {
      if (!activeApiKey || activeApiKey === 'configured' || activeApiKey.length < 20) {
        return NextResponse.json(
          {
            error:
              'Anthropic API key is not configured or is invalid. Please add a valid key in Settings.',
          },
          { status: 400 }
        )
      }
      if (!activeApiKey.startsWith('sk-ant-')) {
        return NextResponse.json(
          {
            error:
              'Invalid Anthropic API key format. Keys should start with "sk-ant-". Please check your key in Settings.',
          },
          { status: 400 }
        )
      }
    } else if (provider === 'azure') {
      if (
        !activeApiKey ||
        activeApiKey === 'configured' ||
        typeof activeApiKey !== 'string' ||
        activeApiKey.length < 10
      ) {
        return NextResponse.json(
          {
            error:
              'Azure OpenAI API key is not configured or is invalid. Please add a valid Azure key in Settings.',
          },
          { status: 400 }
        )
      }
      if (
        !apiKeys.azureOpenAiEndpoint ||
        typeof apiKeys.azureOpenAiEndpoint !== 'string' ||
        !apiKeys.azureOpenAiEndpoint.startsWith('http')
      ) {
        return NextResponse.json(
          {
            error:
              'Azure OpenAI endpoint is not configured. Please add a valid Azure endpoint in Settings.',
          },
          { status: 400 }
        )
      }
      if (!apiKeys.azureOpenAiApiVersion || typeof apiKeys.azureOpenAiApiVersion !== 'string') {
        return NextResponse.json(
          { error: 'Azure OpenAI API version is missing. Please add it in Settings.' },
          { status: 400 }
        )
      }
    } else if (provider === 'google') {
      if (
        !activeApiKey ||
        activeApiKey === 'configured' ||
        typeof activeApiKey !== 'string' ||
        activeApiKey.length < 20
      ) {
        return NextResponse.json(
          {
            error:
              'Gemini API key is not configured or is invalid. Add a key from Google AI Studio in Settings, or set GEMINI_API_KEY / GOOGLE_API_KEY.',
          },
          { status: 400 }
        )
      }
      const k = activeApiKey.toLowerCase()
      if (k.includes('your') || k.includes('placeholder') || k.includes('example')) {
        return NextResponse.json(
          { error: 'Gemini API key appears invalid. Replace placeholder values in Settings.' },
          { status: 400 }
        )
      }
    } else {
      if (
        !activeApiKey ||
        activeApiKey === 'configured' ||
        activeApiKey.includes('your_ope') ||
        activeApiKey.includes('your-api-key') ||
        activeApiKey.length < 20
      ) {
        console.error('OpenAI validation failed:', {
          hasKey: !!activeApiKey,
          isConfiguredPlaceholder: activeApiKey === 'configured',
          length: activeApiKey ? activeApiKey.length : 0,
          startsWithSk: activeApiKey ? activeApiKey.startsWith('sk-') : false,
        })
        return NextResponse.json(
          {
            error:
              'OpenAI API key is not configured or is invalid. Please add a valid key in Settings.',
          },
          { status: 400 }
        )
      }
      if (!activeApiKey.startsWith('sk-')) {
        console.error(
          'Invalid OpenAI API key format detected:',
          activeApiKey.substring(0, 10) + '...'
        )
        return NextResponse.json(
          {
            error:
              'Invalid OpenAI API key format. Keys should start with "sk-". Please check your key in Settings.',
          },
          { status: 400 }
        )
      }
    }

    // Get the latest user message for security check and RAG
    const latestUserMessage = messages.filter((m: ChatMessage) => m.role === 'user').pop()

    // RAG: Retrieve context from storage (ragRetrieveForChat), then inject into system message
    let fileContext = ''
    let availableFilesList: string[] = []
    let ragChunks: Array<{
      chunkId: string
      fileId: string
      text: string
      citationLabel: string
      source_type?: string
      row_number?: number
      sheet_name?: string
      heading_path?: string[]
    }> = []
    let ragContextFromRetrieve: Awaited<
      ReturnType<typeof import('@/lib/rag-context').buildRagContext>
    > | null = null
    // Always attempt RAG when enabled — buildRagContext relevance scoring handles queries with no matching
    // chunks (returns empty, LLM answers from general knowledge). The old isFileOrDataQuestion gate was
    // too narrow and silently skipped retrieval for legitimate file queries like "explain the results".
    const useRAG = enableRAG !== false && !!latestUserMessage
    if (useRAG) {
      try {
        const { getOwnerId } = await import('@/lib/owner')
        const { listFiles } = await import('@/lib/registry/files-registry')
        const { readOwnerFile, readOwnerFileBuffer } = await import('@/lib/persistent-storage')
        const { buildRagContext } = await import('@/lib/rag-context')
        const { extractTextFromBinaryForRag } = await import('@/lib/extract-text-for-rag')
        const { buildForensicContext, logForensic } = await import('@/lib/forensic-log')
        const { getApiKeys } = await import('@/lib/api-keys-storage')
        const { ownerId } = await getOwnerId(request)
        const uploadedFiles = listFiles({ owner_id: ownerId })
        const owner = ownerId ?? ''
        const ragKeys = await getApiKeys()
        ragContextFromRetrieve = await buildRagContext(
          latestUserMessage.content,
          {
            userId: owner,
            ipAddress: getUserIP(request),
            source: 'chat',
            lakeraApiKey: ragKeys.lakeraAiKey ?? undefined,
            lakeraEndpoint: ragKeys.lakeraEndpoint ?? undefined,
            lakeraProjectId: ragKeys.lakeraProjectId ?? undefined,
          },
          {
            listFiles: opts => listFiles(opts ?? { owner_id: owner }),
            getFileContent: fileId => readOwnerFile(owner, fileId),
            getFileBuffer: fileId => readOwnerFileBuffer(owner, fileId),
            lakeraRetrievalScan,
            maxChunks: 56,
          }
        )
        if (ragContextFromRetrieve.chunks.length > 0) {
          ragChunks = ragContextFromRetrieve.chunks
        }
        if (uploadedFiles.length === 0 && owner) {
          console.warn(
            '[chat RAG] registry has no files for owner_id prefix=',
            owner.slice(0, 12),
            '— uploads use a different browser/session cookie than chat, or registry empty.'
          )
        }
        if (process.env.NODE_ENV !== 'production') {
          const ctx = buildForensicContext(
            request,
            ownerId,
            uploadedFiles.length,
            uploadedFiles.map(f => f.id)
          )
          logForensic('api/chat (RAG)', ctx)
        }

        if (uploadedFiles.length > 0 && ragChunks.length === 0) {
          const { formatFileContentForRAG, validateFilePromptSecurity } =
            await import('@/lib/file-content-processor')
          const userQuery = latestUserMessage.content.toLowerCase()
          const relevantFiles: string[] = []
          const allSafeFiles: string[] = []

          for (const fileMeta of uploadedFiles) {
            const scanStatus = fileMeta.scanStatus as string
            if (scanStatus === 'flagged') continue
            if (fileMeta.checkpointTeDetails?.verdict === 'malicious') continue
            const scanDetails = fileMeta.scanDetails as
              | {
                  threatLevel?: 'low' | 'medium' | 'high' | 'critical'
                  categories?: Record<string, boolean>
                  score?: number
                }
              | undefined
            const threatLevel =
              scanDetails?.threatLevel ||
              (fileMeta.scanStatus === 'flagged' ? ('high' as const) : ('low' as const))
            if (threatLevel === 'critical' || threatLevel === 'high') continue
            if (fileMeta.size > 10 * 1024 * 1024) continue
            try {
              const nameLower = fileMeta.name.toLowerCase()
              const typeLower = (fileMeta.type || '').toLowerCase()
              const needsBinaryText =
                typeLower.includes('pdf') ||
                typeLower.includes('wordprocessing') ||
                typeLower.includes('msword') ||
                nameLower.endsWith('.docx') ||
                nameLower.endsWith('.doc') ||
                nameLower.endsWith('.pdf')
              const isExcel =
                nameLower.endsWith('.xlsx') ||
                nameLower.endsWith('.xls') ||
                nameLower.endsWith('.xlsm') ||
                typeLower.includes('spreadsheetml') ||
                typeLower.includes('ms-excel') ||
                typeLower.includes('vnd.ms-excel')
              let fileContent: string | null = null
              if (needsBinaryText || isExcel) {
                const buf = await readOwnerFileBuffer(owner, fileMeta.id)
                fileContent = await extractTextFromBinaryForRag(fileMeta, buf)
              }
              if (fileContent == null) {
                fileContent = await readOwnerFile(owner, fileMeta.id)
              }
              if (!fileContent) continue

              availableFilesList.push(fileMeta.name)

              const contentLower = fileContent.toLowerCase()

              // ENHANCEMENT: Improved matching algorithm
              // 1. Always include data files (CSV, JSON, TXT) if they're safe
              // 2. Check for keyword matches (more lenient)
              // 3. Check for common data patterns (names, emails, IDs, etc.)
              const isDataFile =
                fileMeta.type.includes('csv') ||
                fileMeta.type.includes('json') ||
                fileMeta.type.includes('wordprocessing') ||
                fileMeta.type.includes('pdf') ||
                fileMeta.type.includes('spreadsheet') ||
                fileMeta.name.endsWith('.csv') ||
                fileMeta.name.endsWith('.json') ||
                fileMeta.name.endsWith('.txt') ||
                fileMeta.name.endsWith('.docx') ||
                fileMeta.name.endsWith('.doc') ||
                fileMeta.name.endsWith('.pdf') ||
                fileMeta.name.endsWith('.xlsx') ||
                fileMeta.name.endsWith('.xls') ||
                fileMeta.name.endsWith('.xlsm')

              // Enhanced keyword matching
              const queryWords = userQuery.split(/\s+/).filter((w: string) => w.length > 2)
              const hasKeywordMatch = queryWords.some((word: string) => contentLower.includes(word))

              // Check for common data patterns in query
              const isDataQuery =
                /user|person|people|name|email|id|record|data|field|column|row|list|count|how many|who|what|where|when|find|search|show|display|visa|h-?1b|h1b|work\s+authorization|immigration/i.test(
                  userQuery
                )

              // ENHANCEMENT: Always include data files, or if query mentions data-related terms
              // OR if there's any keyword match
              const shouldInclude =
                isDataFile || (isDataQuery && isDataFile) || hasKeywordMatch || isDataQuery

              // SECURITY: Validate prompt security for file-based queries (ADDITIONAL security layer)
              // This works alongside Lakera AI and Check Point TE - does NOT replace them
              // Files must still pass Lakera/Check Point TE checks (lines 562-586) before reaching here
              const promptSecurityCheck = validateFilePromptSecurity(
                latestUserMessage.content,
                fileContent
              )

              // Block high-risk prompts (only if both prompt AND file show suspicious patterns)
              if (!promptSecurityCheck.safe) {
                console.warn(
                  `RAG: Blocked potentially unsafe prompt with file ${fileMeta.name} (risk: ${promptSecurityCheck.riskLevel})`
                )
                continue
              }

              if (shouldInclude) {
                // For large files, include a summary or excerpt
                let contentToInclude = fileContent
                if (fileContent.length > 15000) {
                  // For very large files, include first 7500 and last 7500 chars
                  contentToInclude =
                    fileContent.substring(0, 7500) +
                    '\n\n...[content truncated - showing first and last portions]...\n\n' +
                    fileContent.substring(fileContent.length - 7500)
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
                  allSafeFiles.push(
                    `\n\n${formattedContent.replace(/^\[File:/, '[File: (Available for reference)')}`
                  )
                }
              }
            } catch (fileError) {
              // Skip files that can't be read
              console.error(`Failed to read file ${fileMeta.id} for RAG:`, fileError)
            }
          }

          // ENHANCEMENT: Include both relevant files and all safe files
          const allFilesContext =
            relevantFiles.length > 0
              ? relevantFiles.join('\n\n---\n\n')
              : allSafeFiles.slice(0, 10).join('\n\n---\n\n') // If no matches, include first 10 safe files

          if (allFilesContext) {
            fileContext = `\n\n[Context from uploaded files (${uploadedFiles.length} files available, ${relevantFiles.length} directly relevant):]\n${allFilesContext}\n\n[End of file context]`
          } else if (availableFilesList.length > 0) {
            // ENHANCEMENT: Even if no content included, tell LLM about available files
            fileContext = `\n\n[Note: ${availableFilesList.length} uploaded file(s) are available. They may contain data relevant to the user's query. Use the content below when answering questions about users, data, or records. Do not mention file names or row numbers in your answer.]\n\n`
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
    // Use stable owner_id as user_id for Lakera metadata (improves attribution in Lakera analytics).
    let guardUserId: string | undefined
    try {
      const { getOwnerId } = await import('@/lib/owner')
      guardUserId = (await getOwnerId(request)).ownerId
    } catch {
      guardUserId = undefined
    }

    let inputScanResult: ScanResult = { scanned: false, flagged: false }

    // Enhance messages: RAG chunks (from storage) or legacy file context
    let enhancedMessages: Array<{ role: string; content: string }> = [...messages]
    if (ragContextFromRetrieve && ragContextFromRetrieve.chunks.length > 0) {
      enhancedMessages = injectRagContext(
        messages.map(m => ({ role: m.role, content: m.content })),
        ragContextFromRetrieve,
        { groundedOnly: false }
      )
    } else if (fileContext && availableFilesList.length > 0) {
      const hasSystemMessage = enhancedMessages.some(m => m.role === 'system')
      if (!hasSystemMessage) {
        enhancedMessages.unshift({
          role: 'system',
          content: `You are a helpful AI assistant with access to uploaded files.

IMPORTANT INSTRUCTIONS:
1. You have access to ${availableFilesList.length} uploaded file(s). The file content will be provided in the user's message below.
2. For general knowledge questions (e.g. "what is Python?", "how does X work?", "hello") — answer directly from your knowledge. Do NOT restrict answers to files.
3. When the user asks about data, records, users, or content that might be in the uploaded files — search through the file content and answer with the minimum necessary fields. Do NOT mention file names, row numbers, or document identifiers in your answer; only share the substance of the content.
4. If the user asked about file content but it is NOT in the files — say so clearly, then you may use general knowledge if helpful.
5. Use the file content only when the question is about file content or data.${RAG_DATA_PRIVACY_INSTRUCTIONS}`,
        })
      }
      if (latestUserMessage) {
        const lastIndex = enhancedMessages.length - 1
        if (lastIndex >= 0 && enhancedMessages[lastIndex].role === 'user') {
          enhancedMessages[lastIndex] = {
            ...enhancedMessages[lastIndex],
            content: enhancedMessages[lastIndex].content + fileContext,
          }
        }
      }
    }

    // Lakera input scan AFTER RAG/file injection: screen what the model actually receives (user text + file/RAG context) for PII/DLP and prompt attacks.
    const runInputScan =
      Boolean(apiKeys.lakeraAiKey) &&
      (config.lakeraEnforceInputOutputScan || scanOptions?.scanInput !== false)
    if (latestUserMessage && runInputScan && apiKeys.lakeraAiKey) {
      const lakeraKey = apiKeys.lakeraAiKey
      let inputTextForGuard = latestUserMessage.content
      for (let i = enhancedMessages.length - 1; i >= 0; i--) {
        if (enhancedMessages[i].role === 'user') {
          inputTextForGuard = enhancedMessages[i].content
          break
        }
      }

      // Build prior turns for multi-turn Guard coverage (exclude last user msg and system msgs).
      // Guard uses these as context to detect split-payload injection across message boundaries.
      const priorTurnsForGuard = messages
        .slice(0, -1)
        .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
          m.role === 'user' || m.role === 'assistant'
        )

      inputScanResult = await screenChatWithLakera(
        inputTextForGuard,
        lakeraKey,
        apiKeys.lakeraEndpoint,
        apiKeys.lakeraProjectId,
        'input',
        {
          user_id: guardUserId,
          session_id: requestId,
          ip_address: userIP,
          internal_request_id: requestId,
        },
        { inputUserQuestionPrefix: latestUserMessage.content },
        priorTurnsForGuard
      )

      // Record per-process snapshot for GET /api/lakera/last (non-blocking)
      try {
        const guardHostname = new URL(resolveLakeraGuardEndpoint(apiKeys.lakeraEndpoint)).hostname
        recordLakeraLastGuard({
          recordedAt: new Date().toISOString(),
          source: 'chat_input',
          guardHostname,
          inputScope: config.lakeraGuardInputScope,
          monitoringOnly: config.lakeraGuardMonitoringOnly,
          decision: sanitizeGuardChatScanForClient(inputScanResult),
        })
      } catch { /* non-blocking — never fail chat over snapshot */ }

      // Monitoring-only mode: allow eligible Guard flags through without blocking.
      // Hard-blocks (local prescan hits, infra errors) always apply regardless of this mode.
      if (inputScanResult.flagged && config.lakeraGuardMonitoringOnly) {
        if (lakeraChatFlagAllowedInMonitoringMode(inputScanResult)) {
          console.warn('[Lakera Guard monitoring-only] Flag allowed through (not blocked):', {
            categories: inputScanResult.categories,
            threatLevel: inputScanResult.threatLevel,
            requestUuid: inputScanResult.requestUuid,
          })
          inputScanResult = { ...inputScanResult, flagged: false }
        }
      }

      if (inputScanResult.flagged) {
        const { addSystemLog } = await import('@/lib/system-logging')
        addSystemLog(
          'warning',
          'checkpoint-waf',
          `Security threat detected in chat input (including RAG/file context if present) - message blocked`,
          {
            endpoint: '/api/chat',
            method: 'POST',
            statusCode: 403,
            error: 'Security block',
            requestBody: {
              messagePreview: latestUserMessage.content.substring(0, 100),
              scanIncludedAugmentedContext:
                inputTextForGuard.length > latestUserMessage.content.length,
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
        ).catch(error => {
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

    // Lakera input audit as soon as Guard returns — so system logs (service=lakera_guard) and
    // request_uuid exist even when this request fails later (token throttle, rate limit, LLM error).
    // Output audit still runs only after generation (below).
    if (apiKeys.lakeraAiKey && inputScanResult.scanned) {
      sendLakeraTelemetryFromLog(
        {
          userIP,
          type: 'chat',
          source: 'chat',
          action: inputScanResult.flagged ? 'blocked' : 'allowed',
          lakeraDecision: inputScanResult,
          projectId: apiKeys.lakeraProjectId,
          userId: guardUserId,
          sessionId: requestId,
          internalRequestId: requestId,
          requestDetails: {
            message: latestUserMessage?.content,
            threatLevel: inputScanResult.threatLevel,
            detectedPatterns: inputScanResult.categories
              ? Object.keys(inputScanResult.categories).filter(
                  k => inputScanResult.categories![k]
                )
              : undefined,
            lakeraRequestUuid: inputScanResult.requestUuid,
          },
        },
        apiKeys.lakeraAiKey,
        apiKeys.lakeraProjectId,
        { contextOverride: 'chat_input' }
      ).catch(error => {
        console.error('Failed Lakera input audit after scan (non-blocking):', error)
      })
    }

    // Validate and normalize the model per provider
    const validatedModel =
      provider === 'anthropic'
        ? typeof model === 'string' && model.trim()
          ? model.trim()
          : 'claude-3-5-sonnet-20241022'
        : provider === 'azure'
          ? typeof model === 'string' && model.trim()
            ? model.trim()
            : 'gpt-4o'
          : provider === 'google'
            ? validateGeminiModelId(typeof model === 'string' ? model : '')
            : validateModel(model || 'gpt-4o-mini')

    // Convert messages to adapter format
    const adapterMessages: AdapterChatMessage[] = enhancedMessages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }))

    // Prepare adapter options
    const maxOutputTokens =
      provider === 'anthropic'
        ? 1024
        : provider === 'google'
          ? 2048
          : validatedModel.startsWith('gpt-5')
            ? 2000
            : 1000
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
    const throttleCheck = await shouldThrottleByTokens(
      adapterMessages,
      validatedModel,
      maxOutputTokens,
      activeApiKey
    )
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
            recommendation:
              throttleCheck.recommendation || 'Please reduce message length or max_output_tokens.',
          },
        },
        { status: 400 }
      )
    }

    // Validate token limits before making API call (using dynamic limits)
    const tokenValidation = await validateTokenLimitAsync(
      adapterMessages,
      validatedModel,
      maxOutputTokens,
      activeApiKey
    )
    if (!tokenValidation.valid) {
      console.warn('Token limit validation failed:', {
        model: validatedModel,
        inputTokens: tokenValidation.inputTokens,
        totalTokens: tokenValidation.totalTokens,
        limit: tokenValidation.limit,
        error: tokenValidation.error,
      })

      // Try to truncate messages to fit within limit (using dynamic limits)
      const truncationResult = await truncateToTokenLimitAsync(
        adapterMessages,
        validatedModel,
        maxOutputTokens,
        activeApiKey
      )

      if (truncationResult.truncated) {
        console.warn('Messages truncated to fit token limit:', {
          originalTokenCount: truncationResult.originalTokenCount,
          finalTokenCount: truncationResult.finalTokenCount,
          messagesRemoved: adapterMessages.length - truncationResult.messages.length,
        })
        // Use truncated messages
        const truncatedAdapterMessages: AdapterChatMessage[] = truncationResult.messages.map(
          msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })
        )

        // Re-validate with truncated messages (using dynamic limits)
        const revalidation = await validateTokenLimitAsync(
          truncatedAdapterMessages,
          validatedModel,
          maxOutputTokens,
          activeApiKey
        )
        if (!revalidation.valid) {
          // Still exceeds limit even after truncation - return error
          return NextResponse.json(
            {
              error:
                tokenValidation.error ||
                'Message exceeds token limit. Please use a model with a larger context window or reduce message length.',
              tokenDetails: {
                inputTokens: tokenValidation.inputTokens,
                totalTokens: tokenValidation.totalTokens,
                limit: tokenValidation.limit,
                suggestion:
                  'Try using gpt-4-turbo or gpt-4o for larger context windows, or shorten your messages.',
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
            error:
              tokenValidation.error ||
              'Message exceeds token limit. Please use a model with a larger context window or reduce message length.',
            tokenDetails: {
              inputTokens: tokenValidation.inputTokens,
              totalTokens: tokenValidation.totalTokens,
              limit: tokenValidation.limit,
              suggestion:
                'Try using gpt-4-turbo or gpt-4o for larger context windows, or shorten your messages.',
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
            suggestion:
              'Please wait a moment before making another request, or reduce the frequency of your requests.',
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
        utilizationPercent:
          ((tokenEstimation.estimatedTotalTokens / dynamicTokenLimit) * 100).toFixed(2) + '%',
      },
    })

    // Call adapter for the selected provider
    const adapterResult =
      provider === 'anthropic'
        ? await callAnthropic(adapterMessages, activeApiKey!, validatedModel, adapterOptions)
        : provider === 'azure'
          ? await callAzureOpenAI(
              adapterMessages,
              apiKeys.azureOpenAiKey!,
              validatedModel,
              adapterOptions,
              apiKeys.azureOpenAiEndpoint!,
              apiKeys.azureOpenAiApiVersion || '2025-04-01-preview'
            )
          : provider === 'google'
            ? await callGemini(adapterMessages, activeApiKey!, validatedModel, adapterOptions)
            : await callOpenAIAdapter(adapterMessages, activeApiKey, validatedModel, adapterOptions)

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

    // Lakera output scan when key is configured; server can force scans regardless of client toggles.
    const runOutputScan =
      Boolean(apiKeys.lakeraAiKey) &&
      (config.lakeraEnforceInputOutputScan || scanOptions?.scanOutput !== false)
    if (runOutputScan && apiKeys.lakeraAiKey) {
      const lakeraKey = apiKeys.lakeraAiKey
      outputScanResult = await screenChatWithLakera(
        aiResponse,
        lakeraKey,
        apiKeys.lakeraEndpoint,
        apiKeys.lakeraProjectId,
        'output',
        {
          user_id: guardUserId,
          session_id: requestId,
          ip_address: userIP,
          internal_request_id: `${requestId}-output`,
        },
        latestUserMessage?.content
          ? { outputPairedUserContent: latestUserMessage.content }
          : undefined
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
        ).catch(error => {
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

    // Platform-aligned audit for output only (input audit already emitted after input scan).
    if (apiKeys.lakeraAiKey && outputScanResult.scanned) {
      const outputLogData = {
        ...logData,
        action: outputScanResult.flagged ? 'blocked' : 'allowed',
        lakeraDecision: outputScanResult,
        projectId: apiKeys.lakeraProjectId,
        userId: guardUserId,
        sessionId: requestId,
        internalRequestId: `${requestId}-output`,
      }
      sendLakeraTelemetryFromLog(outputLogData, apiKeys.lakeraAiKey, apiKeys.lakeraProjectId, {
        contextOverride: 'chat_output',
      }).catch(error => {
        console.error('Failed Lakera audit/telemetry for output scan (non-blocking):', error)
      })
    }

    // Do not send citation/source list to client - chat shows only the answer text (natural English).
    return NextResponse.json({
      success: true,
      answer: aiResponse,
      content: aiResponse,
      inputScanResult,
      outputScanResult,
      logData,
      rag: { chunks: [] },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    let errorMessage = error instanceof Error ? error.message : 'An error occurred'
    let statusCode = 500

    // Handle network/fetch errors specifically
    if (
      error instanceof Error &&
      (error.message.includes('Failed to connect') ||
        error.message.includes('Network error') ||
        error.message.includes('fetch failed'))
    ) {
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
            suggestion:
              'Please wait a moment before making another request, or reduce the frequency of your requests.',
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
      errorMessage =
        errorMessage ||
        'Token limit exceeded. Please reduce message length or use a model with a larger context window.'

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
            suggestion:
              'Try using gpt-4-turbo or gpt-4o for larger context windows, or shorten your messages.',
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
