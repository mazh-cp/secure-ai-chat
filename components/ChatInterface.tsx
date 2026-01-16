'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ModelSelector from './ModelSelector'
import { Message } from '@/types/chat'
import { addLog } from '@/lib/logging'
import { getAssociatedRisksFromLakeraDecision } from '@/types/risks'

interface ApiKeys {
  openAiKey: string
  lakeraAiKey: string
  lakeraEndpoint: string
  lakeraProjectId: string
  azureOpenAiKey?: string
  azureOpenAiEndpoint?: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your secure AI assistant. How can I help you today?',
      role: 'assistant',
      timestamp: new Date(),
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null)
  const [inputScanEnabled, setInputScanEnabled] = useState(true)
  const [outputScanEnabled, setOutputScanEnabled] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini') // Default model
  const [provider, setProvider] = useState<'openai' | 'azure'>('openai') // Provider: OpenAI or Azure OpenAI
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load API keys from server-side storage (fallback to localStorage for backward compatibility)
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        // Try to get keys from server-side storage first
        const response = await fetch('/api/keys/retrieve').catch(() => null)
        if (response?.ok) {
          const data = await response.json()
          // Check if keys are configured (server returns configured status and keys object)
          // data.configured.openAiKey is boolean, data.keys.openAiKey is 'configured' or null
          // For endpoints, data.keys contains the actual URL value (safe to expose)
          const hasAnyKey = data.configured?.openAiKey === true || data.keys?.openAiKey === 'configured' || 
                           data.configured?.azureOpenAiKey === true || data.keys?.azureOpenAiKey === 'configured'
          
          if (hasAnyKey) {
            // Use server-side keys - set a placeholder to indicate keys are configured
            // The actual key is stored server-side and used by API routes
            // For endpoints, use the actual URL value if available (endpoints are safe to expose)
            setApiKeys({
              openAiKey: data.configured?.openAiKey ? 'configured' : '', // Always set to 'configured' if key exists server-side
              lakeraAiKey: data.configured?.lakeraAiKey ? 'configured' : '',
              lakeraEndpoint: data.keys?.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
              lakeraProjectId: data.configured?.lakeraProjectId ? 'configured' : '',
              azureOpenAiKey: data.configured?.azureOpenAiKey ? 'configured' : '',
              // Endpoint URL is safe to return from server - use actual value if available
              azureOpenAiEndpoint: data.keys?.azureOpenAiEndpoint || '',
            })
            console.log('✅ Keys loaded from server:', { 
              configured: data.configured, 
              keys: {
                ...data.keys,
                azureOpenAiEndpoint: data.keys?.azureOpenAiEndpoint ? `${data.keys.azureOpenAiEndpoint.substring(0, 30)}...` : 'null'
              },
              settingAzureKey: data.configured?.azureOpenAiKey ? 'configured' : 'not configured',
              settingAzureEndpoint: data.keys?.azureOpenAiEndpoint ? 'has value' : 'empty'
            })
            return
          } else {
            console.log('⚠️ Keys not configured yet:', data)
          }
        }
      } catch (error) {
        console.error('Failed to load API keys from server:', error)
      }
      
      // Fallback to localStorage for backward compatibility
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('apiKeys')
        if (stored) {
          try {
            setApiKeys(JSON.parse(stored))
          } catch (e) {
            console.error('Failed to load API keys:', e)
          }
        }
      }
    }
    
    loadApiKeys()
    
    // Periodically check for key updates (every 5 seconds)
    const interval = setInterval(loadApiKeys, 5000)
    
    return () => clearInterval(interval)
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

      // Load selected model from localStorage
      const modelStored = localStorage.getItem('selectedModel')
      if (modelStored) {
        setSelectedModel(modelStored)
      }

      // Load provider preference from localStorage
      const providerStored = localStorage.getItem('aiProvider')
      if (providerStored === 'openai' || providerStored === 'azure') {
        setProvider(providerStored)
      }
    }
  }, [])

  // Save selected model to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedModel) {
      localStorage.setItem('selectedModel', selectedModel)
    }
  }, [selectedModel])

  // Save provider preference to localStorage when it changes
  // When switching to Azure OpenAI, automatically select gpt-4o-mini
  useEffect(() => {
    if (typeof window !== 'undefined' && provider) {
      localStorage.setItem('aiProvider', provider)
      
      // When switching to Azure OpenAI, automatically select gpt-4o-mini
      if (provider === 'azure' && selectedModel !== 'gpt-4o-mini') {
        // Check if current model is GPT-5 (not supported by Azure)
        const isGPT5Model = selectedModel.startsWith('gpt-5')
        if (isGPT5Model || !selectedModel) {
          setSelectedModel('gpt-4o-mini')
          console.log('Switched to Azure OpenAI provider - automatically selected gpt-4o-mini')
        }
      }
    }
  }, [provider, selectedModel])

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
    }

    window.addEventListener('storage', handleStorageChange)
    // Also check periodically for changes (since storage event only fires in other tabs)
    const interval = setInterval(handleStorageChange, 500)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
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

    // Check if API key is configured for the selected provider
    // Allow users to switch providers if one doesn't have keys
    if (provider === 'azure') {
      // Check Azure OpenAI key and endpoint
      const hasAzureKey = apiKeys?.azureOpenAiKey === 'configured' || (apiKeys?.azureOpenAiKey && apiKeys.azureOpenAiKey !== '')
      const hasAzureEndpoint = apiKeys?.azureOpenAiEndpoint === 'configured' || 
                               (apiKeys?.azureOpenAiEndpoint && 
                                apiKeys.azureOpenAiEndpoint !== '' && 
                                (apiKeys.azureOpenAiEndpoint.startsWith('http://') || apiKeys.azureOpenAiEndpoint.startsWith('https://')))
      
      if (!hasAzureKey || !hasAzureEndpoint) {
        const hasOpenAi = apiKeys?.openAiKey === 'configured' || (apiKeys?.openAiKey && apiKeys.openAiKey !== '')
        setError(`Azure OpenAI API key and endpoint are not configured. ${hasOpenAi ? 'You can switch to OpenAI provider using the selector above, or ' : ''}Please go to Settings to add and validate your Azure OpenAI credentials.`)
        return
      }
    } else {
      // Check OpenAI key
      const hasOpenAiKey = apiKeys?.openAiKey === 'configured' || (apiKeys?.openAiKey && apiKeys.openAiKey !== '')
      if (!hasOpenAiKey) {
        const hasAzure = (apiKeys?.azureOpenAiKey === 'configured' || (apiKeys?.azureOpenAiKey && apiKeys.azureOpenAiKey !== '')) &&
                         (apiKeys?.azureOpenAiEndpoint === 'configured' || 
                          (apiKeys?.azureOpenAiEndpoint && apiKeys.azureOpenAiEndpoint !== '' &&
                           (apiKeys.azureOpenAiEndpoint.startsWith('http://') || apiKeys.azureOpenAiEndpoint.startsWith('https://'))))
        setError(`OpenAI API key is not configured. ${hasAzure ? 'You can switch to Azure OpenAI provider using the selector above, or ' : ''}Please go to Settings to add your API key.`)
        return
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Prepare messages for API (convert to format expected by OpenAI)
      const chatMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Check if RAG is enabled (from localStorage or default to true)
      const ragEnabled = typeof window !== 'undefined' ? 
        (localStorage.getItem('lakeraRagScanEnabled') !== null ? 
          JSON.parse(localStorage.getItem('lakeraRagScanEnabled') || 'true') : true) : true

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          apiKeys: apiKeys,
          model: selectedModel, // Include selected model
          provider: provider, // Include provider (openai or azure)
          scanOptions: {
            scanInput: inputScanEnabled && !!apiKeys.lakeraAiKey,
            scanOutput: outputScanEnabled && !!apiKeys.lakeraAiKey,
          },
          enableRAG: ragEnabled, // Enable RAG to access uploaded files
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
          setMessages((prev) => [...prev, blockedMessage])
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
        setMessages((prev) => prev.map((m) => 
          m.id === userMessage.id 
            ? { ...m, scanResult: data.inputScanResult }
            : m
        ))
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.content,
        role: 'assistant',
        timestamp: new Date(),
        scanResult: data.outputScanResult,
      }

      setMessages((prev) => [...prev, aiMessage])
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
      setMessages((prev) => [...prev, errorAiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Check if API keys are configured for each provider
  const hasOpenAiKey = apiKeys?.openAiKey === 'configured' || (apiKeys?.openAiKey && apiKeys.openAiKey !== '')
  const hasAzureKey = (apiKeys?.azureOpenAiKey === 'configured' || (apiKeys?.azureOpenAiKey && apiKeys.azureOpenAiKey !== '')) &&
                      (apiKeys?.azureOpenAiEndpoint === 'configured' || 
                       (apiKeys?.azureOpenAiEndpoint && apiKeys.azureOpenAiEndpoint !== '' &&
                        (apiKeys.azureOpenAiEndpoint.startsWith('http://') || apiKeys.azureOpenAiEndpoint.startsWith('https://'))))
  
  // Check if currently selected provider has keys
  const hasCurrentProviderKey = provider === 'azure' ? hasAzureKey : hasOpenAiKey
  
  // Check if at least one provider has keys (allows access to chat page)
  const hasAnyProviderKey = hasOpenAiKey || hasAzureKey

  return (
    <div className="flex flex-col h-full">
      {/* Provider-specific API Key Warning */}
      {!hasCurrentProviderKey && (
        <div 
          className="glass-card rounded-xl p-4 border-yellow-400/30 mb-4"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <p className="text-sm text-theme">
            ⚠️ {provider === 'azure' ? 'Azure OpenAI API key and endpoint are' : 'OpenAI API key is'} not configured.{' '}
            {hasAnyProviderKey && (
              <span>
                You can switch to {provider === 'azure' ? 'OpenAI' : 'Azure OpenAI'} provider using the selector below, or{' '}
              </span>
            )}
            <Link href="/settings" className="underline hover:text-brand-berry transition-colors">
              Go to Settings
            </Link>
            {' '}to add your {provider === 'azure' ? 'Azure OpenAI credentials' : 'API key'}.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div 
          className="glass-card rounded-xl p-4 border-red-400/30 mb-4"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <p className="text-sm text-theme">⚠️ {error}</p>
        </div>
      )}

      {/* Provider and Model Selector - Always show to allow switching between providers */}
      <div className="mb-4 flex justify-end items-center gap-4">
          {/* Provider Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="provider-select" className="text-sm font-medium text-theme-muted whitespace-nowrap">
              Provider:
            </label>
            <select
              id="provider-select"
              value={provider}
              onChange={(e) => {
                const newProvider = e.target.value as 'openai' | 'azure'
                setProvider(newProvider)
                // Clear any previous errors when switching providers
                setError(null)
                // When switching to Azure, automatically select gpt-4o-mini
                if (newProvider === 'azure') {
                  // Check if current model is GPT-5 or not a GPT-4 model
                  const isGPT5Model = selectedModel.startsWith('gpt-5')
                  if (isGPT5Model || !['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-4-turbo'].includes(selectedModel)) {
                    setSelectedModel('gpt-4o-mini')
                  }
                }
              }}
              className="glass-input text-theme px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition-all cursor-pointer"
              style={{
                background: "rgb(var(--surface-1))",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text-1))",
                borderWidth: '2px',
                borderStyle: 'solid',
                minWidth: '140px',
              }}
            >
              <option 
                value="openai" 
                disabled={!hasOpenAiKey}
                style={{ 
                  background: "rgb(var(--surface-1))", 
                  color: hasOpenAiKey ? "rgb(var(--text-1))" : "rgb(var(--text-3))",
                  opacity: hasOpenAiKey ? 1 : 0.5
                }}
              >
                OpenAI {!hasOpenAiKey && '(Not configured)'}
              </option>
              <option 
                value="azure" 
                disabled={!hasAzureKey}
                style={{ 
                  background: "rgb(var(--surface-1))", 
                  color: hasAzureKey ? "rgb(var(--text-1))" : "rgb(var(--text-3))",
                  opacity: hasAzureKey ? 1 : 0.5
                }}
              >
                Azure OpenAI {!hasAzureKey && '(Not configured)'}
              </option>
            </select>
          </div>
          {/* Model Selector */}
          <ModelSelector 
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            apiKey={provider === 'azure' ? (apiKeys?.azureOpenAiKey || null) : (apiKeys?.openAiKey || null)}
            provider={provider}
          />
        </div>

      {/* Chat Messages - Always show, even if no keys configured */}
      <div className="flex-1 overflow-hidden rounded-xl border-2 p-4 mb-4" style={{ borderColor: "rgb(var(--border))", background: "rgba(var(--surface-2), 0.5)" }}>
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Disable only if current provider doesn't have keys */}
      <div className="mt-4">
        <MessageInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          disabled={!hasCurrentProviderKey}
        />
      </div>
    </div>
  )
}
