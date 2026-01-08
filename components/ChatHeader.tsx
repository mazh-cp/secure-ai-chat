'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'

interface AppSettings {
  pageHeading: string
  logoUrl: string
  logoData?: string // Base64 data URL for uploaded files
}

export default function ChatHeader() {
  const [imageError, setImageError] = useState(false)
  const [hasImage, setHasImage] = useState(false)
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

      const loadedSettings = loadSettings()
      // Prioritize uploaded logo data over URL
      const logoSource = loadedSettings?.logoData || loadedSettings?.logoUrl || ''

      // Check for custom logo or default banner
      const checkImage = (url: string) => {
        if (!url) {
          url = '/secure-chat-banner.png'
        }
        const img = new window.Image()
        img.onload = () => setHasImage(true)
        img.onerror = () => setImageError(true)
        img.src = url
      }

      checkImage(logoSource)

      // Listen for settings updates
      const handleSettingsUpdate = () => {
        const updated = localStorage.getItem('appSettings')
        if (updated) {
          try {
            const parsed = JSON.parse(updated)
            setSettings(parsed)
            setHasImage(false)
            setImageError(false)
            // Re-check logo (prioritize uploaded data over URL)
            const logoSource = parsed.logoData || parsed.logoUrl || ''
            checkImage(logoSource)
          } catch (error) {
            console.error('Failed to load updated settings:', error)
          }
        }
      }

      window.addEventListener('settingsUpdated', handleSettingsUpdate)
      return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate)
    }
  }, [])

  // Get logo source (prioritize uploaded data over URL)
  const logoSource = settings.logoData || settings.logoUrl

  // If custom logo exists, use it
  if (logoSource && hasImage && !imageError) {
    return (
      <div className="w-full relative overflow-hidden">
        <Image
          src={logoSource}
          alt={settings.pageHeading}
          width={1200}
          height={300}
          className="w-full h-auto object-cover"
          priority
          unoptimized
        />
      </div>
    )
  }

  // If default banner image exists, use it
  if (!settings.logoUrl && hasImage && !imageError) {
    return (
      <div className="w-full relative overflow-hidden">
        <Image
          src="/secure-chat-banner.png"
          alt="Secure Chat powered by Lakera AI"
          width={1200}
          height={300}
          className="w-full h-auto object-cover"
          priority
          unoptimized
        />
      </div>
    )
  }

  // Fallback banner design with glassmorphism
  return (
    <div className="w-full relative overflow-hidden">
      <div className="relative px-8 py-12 glass-card">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-copper/30 via-harvest-gold/20 to-copper/30 animate-pulse"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 text-center">
          <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
            {settings.pageHeading || 'Secure AI Chat'}
          </h2>
          <p className="text-white/80 text-sm">
            Powered by Lakera AI Security
          </p>
        </div>
      </div>
    </div>
  )
}
