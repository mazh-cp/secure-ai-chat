'use client'

import ChatInterface from '@/components/ChatInterface'
import ChatHeader from '@/components/ChatHeader'
import LakeraToggles from '@/components/LakeraToggles'
import { useState, useEffect } from 'react'

interface ApiKeys {
  openAiKey?: string
  lakeraAiKey?: string
  lakeraEndpoint?: string
  lakeraProjectId?: string
}

export default function Home() {
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null)

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

  const hasApiKey = apiKeys?.openAiKey
  const hasLakeraKey = !!apiKeys?.lakeraAiKey

  return (
    <div className="bento-grid">
      {/* Header Card - Full Width */}
      <div 
        className="bento-card bento-span-4 glass-card p-6 liquid-shimmer"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-theme drop-shadow-lg">Secure AI Chat</h1>
            <p className="mt-2 text-sm text-theme-muted">
              Private, encrypted conversations with AI powered by Lakera AI security
            </p>
          </div>
          <div className="hidden md:block">
            <ChatHeader />
          </div>
        </div>
      </div>

      {/* Banner Card - Full Width (Mobile) */}
      <div 
        className="bento-card bento-span-4 md:hidden glass-card rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <ChatHeader />
      </div>

      {/* Lakera Toggles Card */}
      {hasApiKey && (
        <div 
          className="bento-card bento-span-2 md:bento-span-2 glass-card p-6"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <LakeraToggles
            onInputScanChange={() => {}}
            onOutputScanChange={() => {}}
            hasLakeraKey={hasLakeraKey}
          />
        </div>
      )}

      {/* Chat Interface Card - Takes remaining space */}
      <div 
        className={`bento-card ${hasApiKey ? 'bento-span-2' : 'bento-span-4'} bento-row-span-2 glass-card p-6 overflow-hidden flex flex-col`}
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <ChatInterface />
      </div>
    </div>
  )
}
