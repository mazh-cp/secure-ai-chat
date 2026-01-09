'use client'

import { useState, useEffect } from 'react'
import SettingsForm from '@/components/SettingsForm'
import SecurityIndicator from '@/components/SecurityIndicator'
import MCPToolsSetup from '@/components/MCPToolsSetup'

// Force dynamic rendering to prevent static generation issues with ThemeProvider
export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const [isSecure, setIsSecure] = useState(true)

  useEffect(() => {
    // Check if connection is secure
    if (typeof window !== 'undefined') {
      setIsSecure(window.location.protocol === 'https:' || window.location.hostname === 'localhost')
    }
  }, [])

  return (
    <div className="bento-grid">
      {/* Header Card */}
      <div className="bento-card bento-span-4 glass-card p-6 liquid-shimmer">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-theme drop-shadow-lg">API Keys Configuration</h1>
            <p className="mt-2 text-sm text-theme-muted">
              Configure your API keys securely. Keys are stored locally in your browser.
            </p>
          </div>
          <div className="mt-4">
            <SecurityIndicator isSecure={isSecure} />
          </div>
        </div>
      </div>

      {/* Settings Form Card */}
      <div className="bento-card bento-span-2 glass-card overflow-hidden">
        <SettingsForm />
      </div>

      {/* Advanced: MCP Tools Setup Card */}
      <div className="bento-card bento-span-4 glass-card overflow-hidden">
        <MCPToolsSetup />
      </div>
    </div>
  )
}
