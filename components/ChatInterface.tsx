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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load API keys from server-side storage (fallback to localStorage for backward compatibility)
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        // Try to get keys from server-side storage first
        const response = await fetch('/api/keys/retrieve').catch(() => null)
        if (response?.ok) {
          const data = await response.json()
          if (data.keys) {
            // Use server-side keys if available
            setApiKeys({
              openAiKey: data.keys.openAiKey || '',
              lakeraAiKey: data.keys.lakeraAiKey || '',
              lakeraEndpoint: data.keys.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
              lakeraProjectId: data.keys.lakeraProjectId || '',
            })
            return
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
    }
  }, [])

  // Save selected model to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedModel) {
      localStorage.setItem('selectedModel', selectedModel)
    }
  }, [selectedModel])

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

    // Check if API key is configured
    if (!apiKeys?.openAiKey) {
      setError('OpenAI API key is not configured. Please go to Settings to add your API key.')
      return
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

  const hasApiKey = apiKeys?.openAiKey

  return (
    <div className="flex flex-col h-full">
      {/* API Key Warning */}
      {!hasApiKey && (
        <div 
          className="glass-card rounded-xl p-4 border-yellow-400/30 mb-4"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <p className="text-sm text-theme">
            ⚠️ OpenAI API key not configured.{' '}
            <Link href="/settings" className="underline hover:text-brand-berry transition-colors">
              Go to Settings
            </Link>{' '}
            to add your API key.
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

      {/* Model Selector */}
      {hasApiKey && (
        <div className="mb-4 flex justify-end">
          <ModelSelector 
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            apiKey={apiKeys?.openAiKey || null}
          />
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden rounded-xl border-2 p-4 mb-4" style={{ borderColor: "rgb(var(--border))", background: "rgba(var(--surface-2), 0.5)" }}>
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="mt-4">
        <MessageInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          disabled={!hasApiKey}
        />
      </div>
    </div>
  )
}
