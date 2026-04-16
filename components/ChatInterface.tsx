'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ModelSelector, { type ChatProvider } from './ModelSelector'
import { Message } from '@/types/chat'
import { addLog } from '@/lib/logging'
import { getAssociatedRisksFromLakeraDecision } from '@/types/risks'
import { DEFAULT_AZURE_DEPLOYMENT_ID } from '@/lib/azure-openai'
import {
  LS_CHAT_USE_UPLOADS,
  readChatUseUploadsInChat,
  readEffectiveLakeraRetrievalScan,
} from '@/lib/chat-local-preferences'

interface ApiKeys {
  openAiKey: string
  anthropicApiKey?: string
  azureOpenAiKey?: string
  azureOpenAiEndpoint?: string
  azureOpenAiApiVersion?: string
  lakeraAiKey: string
  lakeraEndpoint: string
  lakeraProjectId: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your secure AI assistant. How can I help you today?",
      role: 'assistant',
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null)
  const [inputScanEnabled, setInputScanEnabled] = useState(true)
  const [outputScanEnabled, setOutputScanEnabled] = useState(true)
  /** File/RAG context in answers — independent of Lakera file-upload toggles */
  const [useUploadsInChat, setUseUploadsInChat] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini')
  const [provider, setProvider] = useState<ChatProvider>('openai')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleProviderChange = (p: ChatProvider) => {
    setProvider(p)
    if (p === 'azure') {
      setSelectedModel(prev => {
        const looksLikeOpenAiDefault = new Set([
          'gpt-4o-mini',
          'gpt-4o',
          'gpt-4-turbo',
          'gpt-4-turbo-preview',
          'gpt-4',
          'gpt-3.5-turbo',
          '',
        ])
        if (looksLikeOpenAiDefault.has(prev) || !prev.trim()) {
          return DEFAULT_AZURE_DEPLOYMENT_ID
        }
        return prev
      })
    }
  }

  // Load API keys from server-side storage (fallback to localStorage for backward compatibility)
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        // Try to get keys from server-side storage first
        // Add cache-busting query parameter to ensure fresh data
        const cacheBuster = `?t=${Date.now()}`
        const response = await fetch(`/api/keys/retrieve${cacheBuster}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        }).catch(() => null)

        if (response?.ok) {
          const data = await response.json()

          // Debug logging in development
          if (process.env.NODE_ENV === 'development') {
            console.log('🔑 Keys status from API:', {
              configured: data.configured,
              keys: data.keys,
              hasOpenAi: data.configured?.openAiKey || data.keys?.openAiKey === 'configured',
            })
          }

          // Check if keys are configured (server returns configured status and keys object)
          // data.configured.openAiKey is boolean, data.keys.openAiKey is 'configured' or null
          // For endpoints, data.keys contains the actual URL value (safe to expose)
          const hasOpenAiKey =
            data.configured?.openAiKey === true || data.keys?.openAiKey === 'configured'
          const hasAnthropicKey =
            data.configured?.anthropicApiKey === true || data.keys?.anthropicApiKey === 'configured'
          const hasAzureKey =
            data.configured?.azureOpenAiKey === true || data.keys?.azureOpenAiKey === 'configured'
          const hasLakeraKey =
            data.configured?.lakeraAiKey === true || data.keys?.lakeraAiKey === 'configured'

          // Set apiKeys when any chat or Lakera key is configured so UI can show correct provider/model options
          if (hasOpenAiKey || hasAnthropicKey || hasAzureKey || hasLakeraKey) {
            setApiKeys({
              openAiKey: data.configured?.openAiKey ? 'configured' : '',
              anthropicApiKey: data.configured?.anthropicApiKey ? 'configured' : '',
              azureOpenAiKey: data.configured?.azureOpenAiKey ? 'configured' : '',
              azureOpenAiEndpoint: data.keys?.azureOpenAiEndpoint || '',
              azureOpenAiApiVersion: data.keys?.azureOpenAiApiVersion || '2025-04-01-preview',
              lakeraAiKey: data.configured?.lakeraAiKey ? 'configured' : '',
              lakeraEndpoint: data.keys?.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
              lakeraProjectId: data.configured?.lakeraProjectId ? 'configured' : '',
            })
            return
          } else {
            // Log detailed info for debugging
            console.warn('⚠️ Keys not configured yet. API response:', {
              configured: data.configured,
              keys: data.keys,
              status: response.status,
            })

            // Clear any stale state if API says no keys
            if (apiKeys?.openAiKey === 'configured') {
              setApiKeys(null)
            }
          }
        } else if (response) {
          // API responded but with error
          console.error('⚠️ Failed to fetch keys status:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('❌ Failed to load API keys from server:', error)
      }

      // Fallback to localStorage for backward compatibility (only if no server-side keys found)
      if (typeof window !== 'undefined' && !apiKeys) {
        const stored = localStorage.getItem('apiKeys')
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            // Only use localStorage if it has actual keys (not just placeholders)
            if (parsed.openAiKey && parsed.openAiKey !== 'configured') {
              setApiKeys(parsed)
            }
          } catch (e) {
            console.error('Failed to load API keys from localStorage:', e)
          }
        }
      }
    }

    // Load immediately
    loadApiKeys()

    // Periodically check for key updates (every 5 seconds) with retry logic
    const interval = setInterval(() => {
      loadApiKeys().catch(err => {
        console.error('Periodic key check failed:', err)
      })
    }, 5000)

    return () => clearInterval(interval)
    // Intentional: run on mount and every 5s only; adding apiKeys would re-run on every key change and duplicate intervals
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load toggle states from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const toggleStored = localStorage.getItem('lakeraToggles')
      if (toggleStored) {
        try {
          const parsed = JSON.parse(toggleStored)
          setInputScanEnabled(parsed.inputScan !== false)
          setOutputScanEnabled(parsed.outputScan !== false)
        } catch (e) {
          console.error('Failed to load toggle states:', e)
        }
      }

      const modelStored = localStorage.getItem('selectedModel')
      if (modelStored) setSelectedModel(modelStored)

      const providerStored = localStorage.getItem('selectedProvider') as ChatProvider | null
      if (
        providerStored === 'openai' ||
        providerStored === 'anthropic' ||
        providerStored === 'azure'
      )
        setProvider(providerStored)
    }
  }, [])

  // When apiKeys loads: default to the provider that has a key so user can use OpenAI when only OpenAI is configured
  useEffect(() => {
    if (!apiKeys) return
    const hasOpenAi =
      apiKeys.openAiKey === 'configured' || (apiKeys.openAiKey && apiKeys.openAiKey !== '')
    const hasAnthropic =
      apiKeys.anthropicApiKey === 'configured' ||
      (apiKeys.anthropicApiKey && apiKeys.anthropicApiKey !== '')
    const hasAzure =
      apiKeys.azureOpenAiKey === 'configured' ||
      (apiKeys.azureOpenAiKey && apiKeys.azureOpenAiKey !== '')
    setProvider(current => {
      if (current === 'anthropic' && !hasAnthropic && (hasOpenAi || hasAzure))
        return hasOpenAi ? 'openai' : 'azure'
      if (current === 'openai' && !hasOpenAi && (hasAnthropic || hasAzure))
        return hasAnthropic ? 'anthropic' : 'azure'
      if (current === 'azure' && !hasAzure && (hasOpenAi || hasAnthropic))
        return hasOpenAi ? 'openai' : 'anthropic'
      return current
    })
  }, [apiKeys])

  useEffect(() => {
    if (typeof window !== 'undefined' && selectedModel) {
      localStorage.setItem('selectedModel', selectedModel)
    }
  }, [selectedModel])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedProvider', provider)
    }
  }, [provider])

  // Listen for changes to toggle states
  useEffect(() => {
    const handleStorageChange = () => {
      const toggleStored = localStorage.getItem('lakeraToggles')
      if (toggleStored) {
        try {
          const parsed = JSON.parse(toggleStored)
          setInputScanEnabled(parsed.inputScan !== false)
          setOutputScanEnabled(parsed.outputScan !== false)
        } catch (e) {
          console.error('Failed to load toggle states:', e)
        }
      }
      setUseUploadsInChat(readChatUseUploadsInChat())
    }

    window.addEventListener('storage', handleStorageChange)
    // Also check periodically for changes (since storage event only fires in other tabs)
    const interval = setInterval(handleStorageChange, 500)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(LS_CHAT_USE_UPLOADS) === null) {
      localStorage.setItem(LS_CHAT_USE_UPLOADS, 'true')
    }
    setUseUploadsInChat(readChatUseUploadsInChat())
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    setError(null)

    const hasOpenAiKey =
      apiKeys?.openAiKey === 'configured' || (apiKeys?.openAiKey && apiKeys.openAiKey !== '')
    const hasAnthropicKey =
      apiKeys?.anthropicApiKey === 'configured' ||
      (apiKeys?.anthropicApiKey && apiKeys.anthropicApiKey !== '')
    const hasAzureKey =
      apiKeys?.azureOpenAiKey === 'configured' ||
      (apiKeys?.azureOpenAiKey && apiKeys.azureOpenAiKey !== '')
    const hasChatKey =
      provider === 'anthropic' ? hasAnthropicKey : provider === 'azure' ? hasAzureKey : hasOpenAiKey
    if (!hasChatKey) {
      setError(
        provider === 'anthropic'
          ? 'Anthropic API key is not configured. Please go to Settings to add your API key.'
          : provider === 'azure'
            ? 'Azure OpenAI API key/endpoint is not configured. Please go to Settings to add your Azure credentials.'
            : 'OpenAI API key is not configured. Please go to Settings to add your API key.'
      )
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Prepare messages for API (convert to format expected by OpenAI)
      const chatMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const enableRAG = typeof window !== 'undefined' ? useUploadsInChat : true
      const lakeraRetrievalScan =
        typeof window !== 'undefined' ? readEffectiveLakeraRetrievalScan() : true

      const { ownerHeaders, apiFetchOptions } = await import('@/lib/owner-client')
      const response = await fetch('/api/chat', {
        ...apiFetchOptions,
        method: 'POST',
        headers: {
          ...ownerHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          apiKeys: apiKeys,
          provider,
          model: selectedModel,
          // Let the server run Lakera when keys exist; toggles only control user preference.
          // Do not gate on apiKeys.lakeraAiKey here — client may show stale state; server merges real keys from storage/env.
          scanOptions: {
            scanInput: inputScanEnabled,
            scanOutput: outputScanEnabled,
          },
          enableRAG,
          lakeraRetrievalScan,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Log blocked request
        if (data.logData) {
          const associatedRisks = getAssociatedRisksFromLakeraDecision(
            data.logData.lakeraDecision?.categories,
            'blocked',
            'chat'
          )
          addLog({
            ...data.logData,
            associatedRisks,
          })
        } else if (response.status === 403 && data.scanResult) {
          const associatedRisks = getAssociatedRisksFromLakeraDecision(
            data.scanResult.categories,
            'blocked',
            'chat'
          )
          addLog({
            type: 'chat',
            action: 'blocked',
            source: 'chat',
            requestDetails: { message: content },
            lakeraDecision: data.scanResult,
            success: false,
            associatedRisks,
          })
        } else {
          addLog({
            type: 'error',
            action: 'error',
            source: 'chat',
            error: data.error || 'Failed to get response',
            success: false,
            associatedRisks: ['llm03'], // Supply Chain risk
          })
        }

        // If it's a security error, show it as a blocked message
        if (response.status === 403 && data.scanResult) {
          const blockedMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: `🚫 ${data.error || 'Message blocked by security filter'}`,
            role: 'assistant',
            timestamp: new Date(),
            scanResult: data.scanResult,
          }
          setMessages(prev => [...prev, blockedMessage])
          return
        }
        throw new Error(data.error || 'Failed to get response')
      }

      // Log successful request with Lakera decisions
      if (data.logData) {
        const associatedRisks = getAssociatedRisksFromLakeraDecision(
          data.logData.inputDecision?.categories || data.logData.outputDecision?.categories,
          'allowed',
          'chat'
        )
        addLog({
          ...data.logData,
          action: 'allowed',
          success: true,
          associatedRisks,
        })
      } else {
        addLog({
          type: 'chat',
          action: 'allowed',
          source: 'chat',
          requestDetails: { message: content },
          success: true,
        })
      }

      // Update user message with scan result if available
      if (data.inputScanResult) {
        setMessages(prev =>
          prev.map(m => (m.id === userMessage.id ? { ...m, scanResult: data.inputScanResult } : m))
        )
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.answer ?? data.content ?? '',
        role: 'assistant',
        timestamp: new Date(),
        scanResult: data.outputScanResult,
        ragCitations: data.rag?.chunks,
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)

      // Log error
      addLog({
        type: 'error',
        action: 'error',
        source: 'chat',
        error: errorMessage,
        success: false,
        associatedRisks: ['llm03'], // Supply Chain risk
      })

      // Add error message to chat
      const errorAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `⚠️ Error: ${errorMessage}`,
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorAiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const hasOpenAiKey =
    apiKeys?.openAiKey === 'configured' || (apiKeys?.openAiKey && apiKeys.openAiKey !== '')
  const hasAnthropicKey =
    apiKeys?.anthropicApiKey === 'configured' ||
    (apiKeys?.anthropicApiKey && apiKeys.anthropicApiKey !== '')
  const hasAzureKey =
    apiKeys?.azureOpenAiKey === 'configured' ||
    (apiKeys?.azureOpenAiKey && apiKeys.azureOpenAiKey !== '')
  const hasChatKey = hasOpenAiKey || hasAnthropicKey || hasAzureKey

  return (
    <div className="flex flex-col h-full">
      {/* API Key Warning */}
      {!hasChatKey && (
        <div
          className="glass-card rounded-xl p-4 border-yellow-400/30 mb-4"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <p className="text-base text-theme">
            ⚠️ No chat API key configured. Add an OpenAI or Anthropic key in{' '}
            <Link href="/settings" className="underline hover:text-brand-berry transition-colors">
              Settings
            </Link>
            .
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          className="glass-card rounded-xl p-4 border-red-400/30 mb-4"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <p className="text-base text-theme">⚠️ {error}</p>
        </div>
      )}

      {/* Uploaded files in chat (separate from Lakera / TE upload scanning) */}
      {hasChatKey && (
        <div
          className="mb-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: 'rgb(var(--border))', background: 'rgba(var(--surface-2), 0.4)' }}
        >
          <div className="text-theme min-w-0">
            <span className="font-medium text-theme">Use uploaded files in chat</span>
            <p className="text-xs text-theme-muted mt-0.5">
              Answers can include your stored uploads even when Lakera or Check Point file scanning
              is off. Turn off to use the model only.
            </p>
          </div>
          <label className="relative inline-flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={useUploadsInChat}
              onChange={e => {
                const v = e.target.checked
                setUseUploadsInChat(v)
                if (typeof window !== 'undefined') {
                  localStorage.setItem(LS_CHAT_USE_UPLOADS, JSON.stringify(v))
                }
              }}
            />
            <div className="h-6 w-11 rounded-full bg-white/20 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-white/30 after:bg-white after:transition-all peer-checked:after:translate-x-full peer-checked:bg-brand-berry/50 peer-focus:ring-2 peer-focus:ring-brand-berry/30" />
          </label>
        </div>
      )}

      {/* Provider & Model Selector (OpenAI or Anthropic) */}
      <div className="mb-4 flex justify-end items-center gap-4 flex-wrap">
        <ModelSelector
          provider={provider}
          onProviderChange={handleProviderChange}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          apiKey={
            provider === 'anthropic' ? apiKeys?.anthropicApiKey || null : apiKeys?.openAiKey || null
          }
        />
      </div>

      {/* Chat Messages - Always show, even if no keys configured */}
      <div
        className="flex-1 overflow-hidden rounded-xl border-2 p-4 mb-4"
        style={{ borderColor: 'rgb(var(--border))', background: 'rgba(var(--surface-2), 0.5)' }}
      >
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Disable only if OpenAI key is not configured */}
      <div className="mt-4">
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          disabled={!hasChatKey}
        />
      </div>
    </div>
  )
}
