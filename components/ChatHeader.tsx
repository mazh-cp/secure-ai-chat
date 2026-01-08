'use client'

import { useState, useEffect } from 'react'

interface AppSettings {
  pageHeading: string
  logoUrl: string
  logoData?: string // Base64 data URL for uploaded files
}

export default function ChatHeader() {
  const [settings, setSettings] = useState<AppSettings>({
    pageHeading: 'Secure AI Chat',
    logoUrl: '',
  })

  useEffect(() => {
    // Load settings from localStorage
    if (typeof window !== 'undefined') {
      const loadSettings = () => {
        const storedSettings = localStorage.getItem('appSettings')
        if (storedSettings) {
          try {
            const parsed = JSON.parse(storedSettings)
            setSettings(parsed)
            return parsed
          } catch (error) {
            console.error('Failed to load settings:', error)
          }
        }
        return null
      }

      loadSettings()

      // Listen for settings updates
      const handleSettingsUpdate = () => {
        const updated = localStorage.getItem('appSettings')
        if (updated) {
          try {
            const parsed = JSON.parse(updated)
            setSettings(parsed)
          } catch (error) {
            console.error('Failed to load updated settings:', error)
          }
        }
      }

      window.addEventListener('settingsUpdated', handleSettingsUpdate)
      return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate)
    }
  }, [])

  // Banner design with glassmorphism (no logo images)
  return (
    <div className="w-full relative overflow-hidden">
      <div className="relative px-8 py-12 glass-card">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-copper/30 via-harvest-gold/20 to-copper/30 animate-pulse"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 text-center">
          <h2 className="text-3xl font-bold text-theme mb-2 drop-shadow-lg">
            {settings.pageHeading || 'Secure AI Chat'}
          </h2>
          <p className="text-theme-muted text-sm">
            Powered by Lakera AI Security
          </p>
        </div>
      </div>
    </div>
  )
}
