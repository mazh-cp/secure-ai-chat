'use client'

import { useState, useEffect, FormEvent, KeyboardEvent, ClipboardEvent } from 'react'

interface ApiKeys {
  openAiKey: string
  lakeraAiKey: string
  lakeraEndpoint: string
  lakeraProjectId: string
}

interface AppSettings {
  pageHeading: string
  logoUrl: string
  logoData?: string // Base64 data URL for uploaded files
}

export default function SettingsForm() {
  const [keys, setKeys] = useState<ApiKeys>({
    openAiKey: '',
    lakeraAiKey: '',
    lakeraEndpoint: 'https://api.lakera.ai/v2/guard',
    lakeraProjectId: '',
  })

  const [settings, setSettings] = useState<AppSettings>({
    pageHeading: 'Secure AI Chat',
    logoUrl: '',
    logoData: '',
  })
  
  const [logoPreview, setLogoPreview] = useState<string>('')

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Load keys and settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('apiKeys')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setKeys(prev => ({ ...prev, ...parsed }))
        } catch (error) {
          console.error('Failed to load stored keys:', error)
        }
      }
      
      const storedSettings = localStorage.getItem('appSettings')
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings)
          setSettings(prev => ({ ...prev, ...parsed }))
          // Set preview if logo data exists
          if (parsed.logoData) {
            setLogoPreview(parsed.logoData)
          } else if (parsed.logoUrl) {
            setLogoPreview(parsed.logoUrl)
          }
        } catch (error) {
          console.error('Failed to load stored settings:', error)
        }
      }
    }
  }, [])

  // Prevent typing - block all keyboard input except paste shortcut
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Allow Tab for navigation
    if (e.key === 'Tab') {
      return
    }
    
    // Allow Ctrl/Cmd + V for paste
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      return
    }
    
    // Block everything else including Ctrl+C, Ctrl+X, typing, backspace, delete
    e.preventDefault()
  }

  // Prevent copy
  const handleCopy = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
  }

  // Prevent cut
  const handleCut = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
  }

  // Prevent context menu (right-click)
  const handleContextMenu = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault()
  }

  // Handle paste - this is the only way to input data
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text').trim()
    const fieldName = e.currentTarget.name as keyof ApiKeys
    
    if (!pastedText) return
    
    // For lakeraEndpoint, only allow valid URLs
    if (fieldName === 'lakeraEndpoint') {
      if (pastedText.startsWith('http://') || pastedText.startsWith('https://')) {
        setKeys(prev => ({ ...prev, [fieldName]: pastedText }))
      }
    } else {
      setKeys(prev => ({ ...prev, [fieldName]: pastedText }))
    }
  }

  // Block any direct input changes
  const handleChange = () => {
    // Do nothing - only paste is allowed
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveStatus('idle')

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('apiKeys', JSON.stringify(keys))
        localStorage.setItem('appSettings', JSON.stringify(settings))
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
        // Trigger custom event to update header
        window.dispatchEvent(new CustomEvent('settingsUpdated'))
      }
    } catch (error) {
      console.error('Failed to save keys:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = (fieldName: keyof ApiKeys) => {
    if (fieldName === 'lakeraEndpoint') {
      setKeys(prev => ({ ...prev, [fieldName]: 'https://api.lakera.ai/v2/guard' }))
    } else {
      setKeys(prev => ({ ...prev, [fieldName]: '' }))
    }
  }

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all API keys? This action cannot be undone.')) {
      setKeys({
        openAiKey: '',
        lakeraAiKey: '',
        lakeraEndpoint: 'https://api.lakera.ai/v2/guard',
        lakeraProjectId: '',
      })
      if (typeof window !== 'undefined') {
        localStorage.removeItem('apiKeys')
      }
    }
  }

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, WebP, or SVG)')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      alert('File size must be less than 5MB')
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result as string
      setSettings(prev => ({
        ...prev,
        logoData: base64String,
        logoUrl: '', // Clear URL if file is uploaded
      }))
      setLogoPreview(base64String)
    }
    reader.onerror = () => {
      alert('Failed to read file. Please try again.')
    }
    reader.readAsDataURL(file)
  }

  const handleClearLogo = () => {
    setSettings(prev => ({
      ...prev,
      logoUrl: '',
      logoData: '',
    }))
    setLogoPreview('')
    // Clear file input
    const fileInput = document.getElementById('logoFile') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const inputClass = "w-full glass-input text-theme placeholder-theme-subtle rounded-xl px-4 py-3 focus:outline-none font-mono text-sm transition-all"
  const labelClass = "block text-sm font-medium text-theme-muted mb-2"

  // Common input props for security
  const secureInputProps = {
    onKeyDown: handleKeyDown,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onContextMenu: handleContextMenu,
    onChange: handleChange,
    className: inputClass,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* OpenAI Key */}
          <div>
            <label htmlFor="openAiKey" className={labelClass}>
              OpenAI Key
              <span className="text-red-300 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                id="openAiKey"
                name="openAiKey"
                value={keys.openAiKey}
                placeholder="Paste your OpenAI API key here (Ctrl/Cmd + V)"
                {...secureInputProps}
              />
              {keys.openAiKey && (
              <button
                type="button"
                onClick={() => handleClear('openAiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 dark:text-red-300 hover:text-red-500 dark:hover:text-red-200 text-sm transition-colors"
              >
                Clear
              </button>
              )}
            </div>
            <p className="text-xs text-theme-subtle mt-1">
              🔒 Paste only (Ctrl/Cmd + V) - Typing and copying disabled for security
            </p>
          </div>

          {/* Lakera AI Key */}
          <div>
            <label htmlFor="lakeraAiKey" className={labelClass}>
              Lakera AI Key
            </label>
            <div className="relative">
              <input
                type="password"
                id="lakeraAiKey"
                name="lakeraAiKey"
                value={keys.lakeraAiKey}
                placeholder="Paste your Lakera AI key here (Ctrl/Cmd + V)"
                {...secureInputProps}
              />
              {keys.lakeraAiKey && (
                <button
                  type="button"
                  onClick={() => handleClear('lakeraAiKey')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300 hover:text-red-200 text-sm transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-theme-subtle mt-1">
              🔒 Paste only (Ctrl/Cmd + V) - Typing and copying disabled for security
            </p>
          </div>

          {/* Lakera Endpoint */}
          <div>
            <label htmlFor="lakeraEndpoint" className={labelClass}>
              Lakera Endpoint
            </label>
            <div className="relative">
              <input
                type="text"
                id="lakeraEndpoint"
                name="lakeraEndpoint"
                value={keys.lakeraEndpoint}
                placeholder="https://api.lakera.ai/v2/guard"
                {...secureInputProps}
              />
              {keys.lakeraEndpoint !== 'https://api.lakera.ai/v2/guard' && (
                <button
                  type="button"
                  onClick={() => handleClear('lakeraEndpoint')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300 hover:text-red-200 text-sm transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="text-xs text-white/60 mt-1">
              🔒 Paste only (Ctrl/Cmd + V) - Default: https://api.lakera.ai/v2/guard
            </p>
          </div>

          {/* Lakera Project ID */}
          <div>
            <label htmlFor="lakeraProjectId" className={labelClass}>
              Lakera Project ID
            </label>
            <div className="relative">
              <input
                type="password"
                id="lakeraProjectId"
                name="lakeraProjectId"
                value={keys.lakeraProjectId}
                placeholder="Paste your Lakera Project ID here (Ctrl/Cmd + V)"
                {...secureInputProps}
              />
              {keys.lakeraProjectId && (
                <button
                  type="button"
                  onClick={() => handleClear('lakeraProjectId')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300 hover:text-red-200 text-sm transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-theme-subtle mt-1">
              🔒 Paste only (Ctrl/Cmd + V) - Typing and copying disabled for security
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-4 py-2 text-red-400 dark:text-red-300 hover:text-red-500 dark:hover:text-red-200 transition-colors text-sm glass-button rounded-xl"
            >
              Clear All Keys
            </button>
            <div className="flex items-center space-x-4">
              {saveStatus === 'success' && (
                <span className="text-green-500 dark:text-green-300 text-sm">✓ Saved successfully</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-500 dark:text-red-300 text-sm">✗ Failed to save</span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="glass-button text-theme px-6 py-2 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSaving ? 'Saving...' : 'Save Keys'}
              </button>
            </div>
          </div>

          {/* Page Heading Setting */}
          <div className="pt-6 border-t border-white/20">
            <h3 className="text-lg font-semibold text-theme mb-4">Page Customization</h3>
            
            <div className="mb-4">
              <label htmlFor="pageHeading" className={labelClass}>
                Page Heading
              </label>
              <input
                type="text"
                id="pageHeading"
                name="pageHeading"
                value={settings.pageHeading}
                onChange={(e) => setSettings(prev => ({ ...prev, pageHeading: e.target.value }))}
                placeholder="Enter page heading"
                className={inputClass}
              />
              <p className="text-xs text-theme-subtle mt-1">
                Custom heading text displayed on the main chat page
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="logoUrl" className={labelClass}>
                Logo URL (Optional)
              </label>
              <input
                type="text"
                id="logoUrl"
                name="logoUrl"
                value={settings.logoUrl}
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, logoUrl: e.target.value, logoData: '' }))
                  setLogoPreview(e.target.value || '')
                }}
                placeholder="Enter logo image URL or path (e.g., /logo.png)"
                className={inputClass}
                disabled={!!settings.logoData}
              />
              <p className="text-xs text-theme-subtle mt-1">
                URL or path to your logo image. Disabled when a file is uploaded.
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="logoFile" className={labelClass}>
                Upload Logo File
              </label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="file"
                    id="logoFile"
                    name="logoFile"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                    disabled={!!settings.logoUrl}
                  />
                  <label
                    htmlFor="logoFile"
                    className={`
                      block w-full glass-input text-center py-3 rounded-xl cursor-pointer
                      transition-all hover:scale-[1.02]
                      ${settings.logoUrl ? 'opacity-50 cursor-not-allowed' : 'hover:border-copper/50'}
                    `}
                  >
                    {settings.logoData ? '✓ Logo Uploaded' : 'Choose Logo File'}
                  </label>
                </div>
                
                {(logoPreview || settings.logoData || settings.logoUrl) && (
                  <div className="relative">
                    <div className="glass-card p-4 rounded-xl">
                      <p className="text-xs text-theme-subtle mb-2">Logo Preview:</p>
                      <div className="relative w-full h-32 bg-white/10 rounded-lg overflow-hidden flex items-center justify-center">
                        <img
                          src={logoPreview || settings.logoData || settings.logoUrl}
                          alt="Logo preview"
                          className="max-w-full max-h-full object-contain"
                          onError={() => setLogoPreview('')}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleClearLogo}
                        className="mt-2 px-3 py-1 text-xs glass-button text-red-300 hover:text-red-200 rounded-lg transition-colors"
                      >
                        Remove Logo
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-theme-subtle mt-1">
                Upload a logo file (JPEG, PNG, GIF, WebP, or SVG, max 5MB). Disabled when URL is set.
              </p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 glass-card border-yellow-400/30 rounded-xl">
            <p className="text-sm text-theme">
              <strong className="text-yellow-500 dark:text-yellow-300">Security Notice:</strong> All keys are stored locally in your browser&apos;s localStorage. 
              They are never transmitted to any server except when making API calls. 
              Copying of keys is disabled to prevent accidental exposure.
            </p>
          </div>
        </form>
    </div>
  )
}
