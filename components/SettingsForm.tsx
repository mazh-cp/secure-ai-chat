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

  // Server-side API key status
  const [serverStatus, setServerStatus] = useState<{
    openAiKey?: boolean
    lakeraAiKey?: boolean
    lakeraProjectId?: boolean
    lakeraEndpoint?: string
    checkpointTeApiKey?: boolean
  }>({})

  // Check Point TE API key state (server-side only)
  const [checkpointTeKey, setCheckpointTeKey] = useState<string>('')
  const [checkpointTeConfigured, setCheckpointTeConfigured] = useState<boolean>(false)
  const [isCheckingTeStatus, setIsCheckingTeStatus] = useState<boolean>(false)
  const [isSavingTeKey, setIsSavingTeKey] = useState<boolean>(false)

  // PIN verification state
  const [pinConfigured, setPinConfigured] = useState<boolean>(false)
  const [pin, setPin] = useState<string>('')
  const [currentPin, setCurrentPin] = useState<string>('')
  const [pinForVerification, setPinForVerification] = useState<string>('')
  const [showPinDialog, setShowPinDialog] = useState<boolean>(false)
  const [pinDialogAction, setPinDialogAction] = useState<'remove-te-key' | 'clear-all' | 'clear-openai' | 'clear-lakera-ai' | 'clear-lakera-project-id' | 'clear-lakera-endpoint' | null>(null)
  const [keyToClear, setKeyToClear] = useState<keyof ApiKeys | null>(null)
  const [isManagingPin, setIsManagingPin] = useState<boolean>(false)

  // Load keys from server-side storage and check status
  const loadApiKeys = async () => {
    let statusData: { configured?: { openAiKey?: boolean; lakeraAiKey?: boolean; lakeraProjectId?: boolean; lakeraEndpoint?: string } } | null = null
    let statusResponse: Response | null = null
    
    try {
      // Check server-side status first
      statusResponse = await fetch('/api/keys').catch(() => null)
      if (statusResponse?.ok) {
        statusData = await statusResponse.json()
        // Update server status
        setServerStatus({
          openAiKey: statusData?.configured?.openAiKey || false,
          lakeraAiKey: statusData?.configured?.lakeraAiKey || false,
          lakeraProjectId: statusData?.configured?.lakeraProjectId || false,
          lakeraEndpoint: statusData?.configured?.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
          checkpointTeApiKey: false, // Handled separately
        })
      }
      
      // Try to load from localStorage for backward compatibility (migration)
      const stored = localStorage.getItem('apiKeys')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Only set if server-side doesn't have it (migration)
          if (!statusResponse?.ok || !statusData?.configured?.openAiKey) {
            setKeys(prev => ({ ...prev, ...parsed }))
          }
        } catch (error) {
          console.error('Failed to load stored keys:', error)
        }
      }
    } catch (error) {
      console.error('Failed to load API keys:', error)
      // Fallback to localStorage for backward compatibility
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('apiKeys')
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            setKeys(prev => ({ ...prev, ...parsed }))
          } catch (parseError) {
            console.error('Failed to parse stored keys:', parseError)
          }
        }
      }
    }
  }

  // Load keys and settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadApiKeys()
      
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

      // Check server-side API key status and Check Point TE API key status
      // Use setTimeout to avoid blocking page load if endpoint is slow
      setTimeout(() => {
        checkServerStatus().catch(err => {
          // Silently handle - don't break page load
          console.error('Server status check failed:', err)
        })
        checkCheckpointTeStatus().catch(err => {
          // Silently handle - don't break page load
          console.error('Check Point TE status check failed:', err)
        })
        checkPinStatus().catch(err => {
          console.error('PIN status check failed:', err)
        })
      }, 500)
    }
  }, [])

  // Check server-side API key status (environment variables and storage)
  const checkServerStatus = async () => {
    try {
      // Check both status endpoints
      const [statusResponse, keysResponse] = await Promise.all([
        fetch('/api/settings/status').catch(() => null),
        fetch('/api/keys').catch(() => null),
      ])
      
      if (statusResponse?.ok) {
        const statusData = await statusResponse.json()
        setServerStatus(prev => ({
          ...prev,
          openAiKey: statusData.hasOpenAiKey || false,
          lakeraAiKey: statusData.hasLakeraAiKey || false,
          lakeraProjectId: statusData.hasLakeraProjectId || false,
          lakeraEndpoint: statusData.status?.lakeraEndpoint?.value || 'https://api.lakera.ai/v2/guard',
          checkpointTeApiKey: statusData.hasCheckpointTeApiKey || false,
        }))
      }
      
      if (keysResponse?.ok) {
        const keysData = await keysResponse.json()
        setServerStatus(prev => ({
          ...prev,
          openAiKey: keysData.configured?.openAiKey || prev.openAiKey,
          lakeraAiKey: keysData.configured?.lakeraAiKey || prev.lakeraAiKey,
          lakeraProjectId: keysData.configured?.lakeraProjectId || prev.lakeraProjectId,
          lakeraEndpoint: keysData.configured?.lakeraEndpoint || prev.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
        }))
      }
    } catch (error) {
      // Silently handle - don't break page load
      console.error('Failed to check server-side API key status:', error)
    }
  }

  // Check Check Point TE API key configuration status
  const checkCheckpointTeStatus = async () => {
    setIsCheckingTeStatus(true)
    try {
      const response = await fetch('/api/te/config')
      if (response.ok) {
        const data = await response.json()
        setCheckpointTeConfigured(data.configured || false)
      } else {
        // If endpoint returns error, assume not configured
        setCheckpointTeConfigured(false)
      }
    } catch (error) {
      // Silently handle errors - service may not be ready yet
      // Don't break the UI if status check fails
      console.error('Failed to check Check Point TE status:', error)
      setCheckpointTeConfigured(false)
    } finally {
      setIsCheckingTeStatus(false)
    }
  }

  // Handle Check Point TE API key paste (server-side storage)
  const handleCheckpointTeKeyPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text').trim()
    if (pastedText) {
      setCheckpointTeKey(pastedText)
    }
  }

  // Save Check Point TE API key (server-side)
  const handleSaveCheckpointTeKey = async () => {
    if (!checkpointTeKey.trim()) {
      return
    }

    setIsSavingTeKey(true)
    try {
      const response = await fetch('/api/te/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: checkpointTeKey }),
      })

      if (response.ok) {
        setCheckpointTeConfigured(true)
        setCheckpointTeKey('') // Clear input after successful save
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        const error = await response.json()
        setSaveStatus('error')
        console.error('Failed to save Check Point TE key:', error)
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Error saving Check Point TE key:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsSavingTeKey(false)
    }
  }

  // Check PIN configuration status
  const checkPinStatus = async () => {
    try {
      const response = await fetch('/api/pin')
      if (response.ok) {
        const data = await response.json()
        setPinConfigured(data.configured || false)
      }
    } catch (error) {
      console.error('Failed to check PIN status:', error)
    }
  }

  // Verify PIN for protected actions
  const verifyPinForAction = async (pinValue: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'verify', pin: pinValue }),
      })

      if (response.ok) {
        return true
      }
      return false
    } catch (error) {
      console.error('Error verifying PIN:', error)
      return false
    }
  }

  // Remove Check Point TE API key (with PIN verification if configured)
  const handleRemoveCheckpointTeKey = async () => {
    if (!confirm('Are you sure you want to remove the Check Point TE API key?')) {
      return
    }

    // If PIN is configured, require PIN verification
    if (pinConfigured) {
      setPinDialogAction('remove-te-key')
      setShowPinDialog(true)
      setPinForVerification('')
      return
    }

    // No PIN configured, proceed with removal
    await performRemoveCheckpointTeKey()
  }

  // Perform the actual removal after PIN verification
  const performRemoveCheckpointTeKey = async () => {
    setIsSavingTeKey(true)
    try {
      const requestBody: { pin?: string } = {}
      
      // Include PIN if configured
      if (pinConfigured && pinForVerification) {
        requestBody.pin = pinForVerification
      }

      const response = await fetch('/api/te/config', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        setCheckpointTeConfigured(false)
        setCheckpointTeKey('')
        setSaveStatus('success')
        setShowPinDialog(false)
        setPinForVerification('')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        const errorData = await response.json()
        if (errorData.requiresPin) {
          // PIN required but not provided or incorrect
          alert(errorData.error || 'PIN verification failed')
        } else {
          setSaveStatus('error')
        }
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Error removing Check Point TE key:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsSavingTeKey(false)
    }
  }

  // Handle PIN dialog confirmation
  const handlePinDialogConfirm = async () => {
    // PIN verification is handled by the API endpoint
    // We just need to make the request with the PIN
    if (!pinForVerification.trim()) {
      alert('Please enter your PIN')
      return
    }

    // Verify PIN first
    const isValid = await verifyPinForAction(pinForVerification)
    if (!isValid) {
      alert('PIN is incorrect. Please try again.')
      setPinForVerification('')
      return
    }

    // PIN verified, perform the action
    if (pinDialogAction === 'remove-te-key') {
      await performRemoveCheckpointTeKey()
    } else if (pinDialogAction === 'clear-all') {
      await performClearAll()
    } else if (pinDialogAction === 'clear-openai' || pinDialogAction === 'clear-lakera-ai' || 
               pinDialogAction === 'clear-lakera-project-id' || pinDialogAction === 'clear-lakera-endpoint') {
      // Clear individual key
      if (keyToClear) {
        await performClearKey(keyToClear)
      }
    }

    setShowPinDialog(false)
    setPinForVerification('')
    setPinDialogAction(null)
    setKeyToClear(null)
  }

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
      // Save API keys to server-side storage (encrypted)
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keys }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save API keys')
      }

      // Save app settings to localStorage (not sensitive)
      if (typeof window !== 'undefined') {
        localStorage.setItem('appSettings', JSON.stringify(settings))
        // Clear API keys from localStorage (now stored server-side)
        localStorage.removeItem('apiKeys')
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
        // Trigger custom event to update header
        window.dispatchEvent(new CustomEvent('settingsUpdated'))
        // Refresh server status
        await checkServerStatus()
      }
    } catch (error) {
      console.error('Failed to save keys:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle clearing individual API keys (requires PIN if configured)
  const handleClear = async (fieldName: keyof ApiKeys) => {
    // If PIN is configured, require PIN verification
    if (pinConfigured) {
      setKeyToClear(fieldName)
      // Set appropriate dialog action based on field name
      if (fieldName === 'openAiKey') {
        setPinDialogAction('clear-openai')
      } else if (fieldName === 'lakeraAiKey') {
        setPinDialogAction('clear-lakera-ai')
      } else if (fieldName === 'lakeraProjectId') {
        setPinDialogAction('clear-lakera-project-id')
      } else if (fieldName === 'lakeraEndpoint') {
        setPinDialogAction('clear-lakera-endpoint')
      }
      setShowPinDialog(true)
      setPinForVerification('')
      return
    }

    // No PIN configured, proceed with clearing
    performClearKey(fieldName)
  }

  // Perform the actual key clearing after PIN verification
  const performClearKey = (fieldName: keyof ApiKeys) => {
    if (fieldName === 'lakeraEndpoint') {
      setKeys(prev => ({ ...prev, [fieldName]: 'https://api.lakera.ai/v2/guard' }))
    } else {
      setKeys(prev => ({ ...prev, [fieldName]: '' }))
    }
    setSaveStatus('success')
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all API keys? This action cannot be undone.')) {
      // Always require PIN verification if PIN is configured
      if (pinConfigured) {
        setPinDialogAction('clear-all')
        setShowPinDialog(true)
        setPinForVerification('')
        return
      }

      // No PIN configured, proceed with clearing
      performClearAll()
    }
  }

  // Perform the actual clear all after PIN verification
  const performClearAll = () => {
    setKeys({
      openAiKey: '',
      lakeraAiKey: '',
      lakeraEndpoint: 'https://api.lakera.ai/v2/guard',
      lakeraProjectId: '',
    })
    if (typeof window !== 'undefined') {
      localStorage.removeItem('apiKeys')
    }
    setSaveStatus('success')
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  // Handle PIN setup/update
  const handleSetPin = async () => {
    if (!pin.trim()) {
      alert('Please enter a PIN (4-8 digits)')
      return
    }

    if (!/^\d{4,8}$/.test(pin.trim())) {
      alert('PIN must be 4-8 digits')
      return
    }

    setIsManagingPin(true)
    try {
      const requestBody: { action: string; pin: string; currentPin?: string } = {
        action: 'set',
        pin: pin.trim(),
      }

      // If PIN already exists, require current PIN for update
      if (pinConfigured && currentPin.trim()) {
        requestBody.currentPin = currentPin.trim()
      }

      const response = await fetch('/api/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        setPinConfigured(true)
        setPin('')
        setCurrentPin('')
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
        alert(pinConfigured ? 'PIN updated successfully' : 'PIN configured successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to set PIN')
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Error setting PIN:', error)
      alert('Failed to set PIN')
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsManagingPin(false)
    }
  }

  // Handle PIN removal
  const handleRemovePin = async () => {
    if (!confirm('Are you sure you want to remove the verification PIN? This will disable PIN protection for API key removal.')) {
      return
    }

    const pinToVerify = prompt('Enter your current PIN to remove it:')
    if (!pinToVerify) {
      return
    }

    setIsManagingPin(true)
    try {
      const response = await fetch('/api/pin', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: pinToVerify }),
      })

      if (response.ok) {
        setPinConfigured(false)
        setCurrentPin('')
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
        alert('PIN removed successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to remove PIN')
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Error removing PIN:', error)
      alert('Failed to remove PIN')
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsManagingPin(false)
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
      const updatedSettings = {
        ...settings,
        logoData: base64String,
        logoUrl: '', // Clear URL if file is uploaded
      }
      setSettings(updatedSettings)
      setLogoPreview(base64String)
      // Save immediately when uploaded
      if (typeof window !== 'undefined') {
        localStorage.setItem('appSettings', JSON.stringify(updatedSettings))
        window.dispatchEvent(new CustomEvent('settingsUpdated'))
      }
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
    // Save immediately when cleared
    if (typeof window !== 'undefined') {
      localStorage.setItem('appSettings', JSON.stringify({
        ...settings,
        logoUrl: '',
        logoData: '',
      }))
      window.dispatchEvent(new CustomEvent('settingsUpdated'))
    }
  }

  const inputClass = "w-full glass-input text-theme placeholder-theme-subtle rounded-xl px-4 py-3 focus:outline-none font-mono text-sm transition-all border-2"
  const inputStyle = {
    background: "rgb(var(--surface-1))",
    borderColor: "rgb(var(--border))",
    borderWidth: '2px',
    borderStyle: 'solid',
  }
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
    style: inputStyle,
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
            <label htmlFor="openAiKey" className={`${labelClass} flex items-center gap-2`}>
              <span>OpenAI Key</span>
              <span className="text-red-300">*</span>
              {/* Status Dot */}
              {serverStatus.openAiKey || keys.openAiKey ? (
                <div 
                  className="h-2 w-2 rounded-full bg-green-500 transition-all"
                  title="Configured and working"
                  style={{
                    boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)'
                  }}
                />
              ) : (
                <div 
                  className="h-2 w-2 rounded-full bg-red-500 transition-all"
                  title="Not configured or not working"
                  style={{
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                  }}
                />
              )}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtle hover:text-red-400 text-sm transition-colors"
              >
                Clear
              </button>
              )}
            </div>
            <p className="text-xs text-theme-subtle mt-1">
              🔒 Paste only (Ctrl/Cmd + V) - Typing and copying disabled for security
            </p>
            {serverStatus.openAiKey && !keys.openAiKey && (
              <p className="text-xs text-green-400 mt-1">
                ✓ Configured via environment variable (server-side)
              </p>
            )}
            {!serverStatus.openAiKey && !keys.openAiKey && (
              <p className="text-xs text-yellow-400 mt-1">
                ⚠ Not configured - Please set API key or configure OPENAI_API_KEY environment variable
              </p>
            )}
          </div>

          {/* Lakera AI Key */}
          <div>
            <label htmlFor="lakeraAiKey" className={`${labelClass} flex items-center gap-2`}>
              <span>Lakera AI Key</span>
              {/* Status Dot */}
              {serverStatus.lakeraAiKey || keys.lakeraAiKey ? (
                <div 
                  className="h-2 w-2 rounded-full bg-green-500 transition-all"
                  title="Configured and working"
                  style={{
                    boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)'
                  }}
                />
              ) : (
                <div 
                  className="h-2 w-2 rounded-full bg-red-500 transition-all"
                  title="Not configured or not working"
                  style={{
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                  }}
                />
              )}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtle hover:text-red-400 text-sm transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-theme-subtle mt-1">
              🔒 Paste only (Ctrl/Cmd + V) - Typing and copying disabled for security
            </p>
            {serverStatus.lakeraAiKey && !keys.lakeraAiKey && (
              <p className="text-xs text-green-400 mt-1">
                ✓ Configured via environment variable (server-side)
              </p>
            )}
            {!serverStatus.lakeraAiKey && !keys.lakeraAiKey && (
              <p className="text-xs text-theme-muted mt-1">
                Optional - Configure via Settings or LAKERA_AI_KEY environment variable
              </p>
            )}
          </div>

          {/* Lakera Endpoint */}
          <div>
            <label htmlFor="lakeraEndpoint" className={`${labelClass} flex items-center gap-2`}>
              <span>Lakera Endpoint</span>
              {/* Status Dot - Always green (endpoint is always valid, default or custom) */}
              <div 
                className="h-2 w-2 rounded-full bg-green-500 transition-all"
                title="Endpoint configured (using default or custom)"
                style={{
                  boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)'
                }}
              />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtle hover:text-red-400 text-sm transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="text-xs text-theme-subtle mt-1">
              🔒 Paste only (Ctrl/Cmd + V) - Default: https://api.lakera.ai/v2/guard
            </p>
          </div>

          {/* Lakera Project ID */}
          <div>
            <label htmlFor="lakeraProjectId" className={`${labelClass} flex items-center gap-2`}>
              <span>Lakera Project ID</span>
              {/* Status Dot */}
              {serverStatus.lakeraProjectId || keys.lakeraProjectId ? (
                <div 
                  className="h-2 w-2 rounded-full bg-green-500 transition-all"
                  title="Configured and working"
                  style={{
                    boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)'
                  }}
                />
              ) : (
                <div 
                  className="h-2 w-2 rounded-full bg-red-500 transition-all"
                  title="Not configured or not working"
                  style={{
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                  }}
                />
              )}
            </label>
            <div className="relative">
              <input
                type="text"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtle hover:text-red-400 text-sm transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-theme-subtle mt-1">
              📋 Visible for verification - Ensure correct policy is established from Lakera Platform
            </p>
            {keys.lakeraProjectId && (
              <p className="text-xs text-theme-muted mt-1">
                ℹ️ Current Project ID: <span className="font-mono font-semibold">{keys.lakeraProjectId}</span>
              </p>
            )}
          </div>

          {/* Verification PIN Section */}
          <div className="pt-6 border-t border-palette-border-default/20 mt-8">
            <h3 className="text-lg font-semibold text-theme mb-4 flex items-center gap-2">
              <span>🔐</span>
              Verification PIN
            </h3>
            <p className="text-sm text-theme-subtle mb-4">
              Set up a PIN code to protect against unauthorized API key removal. PIN must be 4-8 digits.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-medium ${pinConfigured ? 'text-green-400' : 'text-yellow-400'}`}>
                  {pinConfigured ? '✓ PIN Configured' : '⚠ PIN Not configured'}
                </span>
              </div>
              
              {pinConfigured && (
                <div>
                  <label htmlFor="currentPin" className="block text-xs font-medium text-theme-muted mb-1">
                    Current PIN (required to update)
                  </label>
                  <input
                    type="password"
                    id="currentPin"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter current PIN"
                    className={inputClass}
                    style={inputStyle}
                    maxLength={8}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="pin" className="block text-xs font-medium text-theme-muted mb-1">
                  {pinConfigured ? 'New PIN' : 'Set PIN'}
                </label>
                <input
                  type="password"
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={pinConfigured ? "Enter new PIN (4-8 digits)" : "Enter PIN (4-8 digits)"}
                  className={inputClass}
                  style={inputStyle}
                  maxLength={8}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSetPin}
                  disabled={isManagingPin || !pin.trim() || (pinConfigured && !currentPin.trim())}
                  className="px-4 py-2 glass-button text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isManagingPin ? 'Setting...' : pinConfigured ? 'Update PIN' : 'Set PIN'}
                </button>
                {pinConfigured && (
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    disabled={isManagingPin}
                    className="px-4 py-2 glass-button text-red-400 hover:text-red-300 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Remove PIN
                  </button>
                )}
              </div>
              
              <p className="text-xs text-theme-subtle mt-2">
                {pinConfigured 
                  ? '✓ PIN protection is active. PIN verification required to remove API keys.'
                  : '⚠ No PIN protection. API keys can be removed without verification.'}
              </p>
            </div>
          </div>

          {/* Check Point ThreatCloud / Threat Emulation API Key */}
          <div className="pt-6 border-t border-palette-border-default/20 mt-8">
            <label htmlFor="checkpointTeKey" className={`${labelClass} flex items-center gap-2`}>
              <span>Check Point ThreatCloud / Threat Emulation (TE) API Key</span>
              {/* Status Dot */}
              {checkpointTeConfigured ? (
                <div 
                  className="h-2 w-2 rounded-full bg-green-500 transition-all"
                  title="Configured and working"
                  style={{
                    boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)'
                  }}
                />
              ) : (
                <div 
                  className="h-2 w-2 rounded-full bg-red-500 transition-all"
                  title="Not configured or not working"
                  style={{
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                  }}
                />
              )}
            </label>
            <div className="space-y-2">
              {/* Status Indicator */}
              <div className="flex items-center space-x-2 mb-2">
                {isCheckingTeStatus ? (
                  <span className="text-xs text-theme-subtle">Checking status...</span>
                ) : (
                  <>
                    <span className={`text-xs font-medium ${checkpointTeConfigured ? 'text-green-400' : 'text-yellow-400'}`}>
                      {checkpointTeConfigured ? '✓ Configured' : '⚠ Not configured'}
                    </span>
                    {checkpointTeConfigured && (
                      <button
                        type="button"
                        onClick={handleRemoveCheckpointTeKey}
                        disabled={isSavingTeKey}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Input Field */}
              <div className="relative">
                <input
                  type="password"
                  id="checkpointTeKey"
                  name="checkpointTeKey"
                  value={checkpointTeKey}
                  placeholder={checkpointTeConfigured ? "Enter new key to replace (Ctrl/Cmd + V)" : "Paste your Check Point TE API key here (Ctrl/Cmd + V)"}
                  onKeyDown={handleKeyDown}
                  onCopy={handleCopy}
                  onCut={handleCut}
                  onContextMenu={handleContextMenu}
                  onPaste={handleCheckpointTeKeyPaste}
                  onChange={handleChange}
                  className={inputClass}
                  style={inputStyle}
                  disabled={isSavingTeKey}
                />
                {checkpointTeKey && (
                  <button
                    type="button"
                    onClick={() => setCheckpointTeKey('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtle hover:text-red-400 text-sm transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              {/* Save Button */}
              {checkpointTeKey && (
                <button
                  type="button"
                  onClick={handleSaveCheckpointTeKey}
                  disabled={isSavingTeKey || !checkpointTeKey.trim()}
                  className="glass-button text-theme px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "white",
                  }}
                >
                  {isSavingTeKey ? 'Saving...' : checkpointTeConfigured ? 'Update Key' : 'Save Key'}
                </button>
              )}

              <p className="text-xs text-theme-subtle mt-1">
                <span className="block mb-1">
                  {checkpointTeConfigured 
                    ? '✅ Check Point TE API key is configured (stored server-side, encrypted)'
                    : '⚠️ Check Point TE API key is not configured'}
                </span>
                <span className="block mt-2 text-xs opacity-75">
                  🔒 Server-side storage - Key is stored securely on the server and never exposed to the browser. Paste only (Ctrl/Cmd + V).
                </span>
                <span className="block mt-2 text-xs opacity-75 border-l-2 border-yellow-500/50 pl-2">
                  <strong>Important:</strong> Enter only the API key value (without the &quot;TE_API_KEY_&quot; prefix). 
                  If you get an &quot;access denied&quot; (403) error, check: 1) API key has file upload permissions, 
                  2) Your server IP is allowed in Check Point Management API settings (SmartConsole → Management API → Advanced Settings), 
                  3) API subscription/plan limits.
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-palette-border-default/20">
            <button
              type="button"
              onClick={handleClearAll}
              className="glass-button text-theme-subtle hover:text-red-400 transition-colors text-sm px-4 py-2 rounded-xl"
              style={{
                backgroundColor: "var(--destructive-bg, transparent)",
              }}
            >
              Clear All Keys
            </button>
            <div className="flex items-center space-x-4">
              {saveStatus === 'success' && (
                <span className="text-green-400 text-sm">✓ Saved successfully</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-400 text-sm">✗ Failed to save</span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="glass-button px-6 py-2 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{
                  backgroundColor: "rgb(var(--accent))",
                  color: "white",
                }}
              >
                {isSaving ? 'Saving...' : 'Save Keys'}
              </button>
            </div>
          </div>

          {/* Page Heading Setting */}
          <div className="pt-6 border-t border-palette-border-default/20">
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
                style={inputStyle}
              />
              <p className="text-xs text-theme-subtle mt-1">
                Custom heading text displayed on the main chat page
              </p>
            </div>
          </div>

          {/* Site Logo */}
          <div className="pt-6 border-t border-palette-border-default/20">
            <h3 className="text-sm font-medium text-theme mb-4">Site Logo</h3>
            
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
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="logoFile"
                    className="block w-full glass-input text-center py-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02] hover:border-copper/50"
                  >
                    {settings.logoData ? '✓ Logo Uploaded' : 'Choose Logo File'}
                  </label>
                </div>
                
                {(logoPreview || settings.logoData) && (
                  <div className="relative">
                    <div className="glass-card p-4 rounded-xl">
                      <p className="text-xs text-theme-subtle mb-2">Logo Preview:</p>
                      <div className="relative w-full h-32 bg-palette-bg-tertiary/10 rounded-lg overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoPreview || settings.logoData}
                          alt="Logo preview"
                          className="max-w-full max-h-full object-contain"
                          onError={() => setLogoPreview('')}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleClearLogo}
                        className="mt-2 px-3 py-1 text-xs glass-button text-theme-subtle hover:text-red-400 rounded-lg transition-colors"
                        style={{
                          backgroundColor: "var(--destructive-bg, transparent)",
                        }}
                      >
                        Remove Logo
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-theme-subtle mt-1">
                Upload a logo file (PNG, JPG, or SVG, max 5MB). Logo will appear in the top header.
              </p>
            </div>
          </div>

          {/* PIN Verification Dialog */}
          {showPinDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
              setShowPinDialog(false)
              setPinForVerification('')
              setPinDialogAction(null)
              setKeyToClear(null)
            }}>
              <div className="glass-card p-6 rounded-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-theme mb-4">PIN Verification Required</h3>
                <p className="text-sm text-theme-subtle mb-4">
                  {pinDialogAction === 'remove-te-key' 
                    ? 'Please enter your PIN to remove the Check Point TE API key.'
                    : pinDialogAction === 'clear-all'
                    ? 'Please enter your PIN to clear all API keys.'
                    : pinDialogAction === 'clear-openai'
                    ? 'Please enter your PIN to clear the OpenAI API key.'
                    : pinDialogAction === 'clear-lakera-ai'
                    ? 'Please enter your PIN to clear the Lakera AI key.'
                    : pinDialogAction === 'clear-lakera-project-id'
                    ? 'Please enter your PIN to clear the Lakera Project ID.'
                    : pinDialogAction === 'clear-lakera-endpoint'
                    ? 'Please enter your PIN to reset the Lakera Endpoint.'
                    : 'Please enter your PIN to perform this action.'}
                </p>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="pinForVerification" className="block text-sm font-medium text-theme-muted mb-2">
                      Enter PIN
                    </label>
                    <input
                      type="password"
                      id="pinForVerification"
                      value={pinForVerification}
                      onChange={(e) => setPinForVerification(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Enter your PIN (4-8 digits)"
                      className={inputClass}
                      style={inputStyle}
                      maxLength={8}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePinDialogConfirm()
                        } else if (e.key === 'Escape') {
                          setShowPinDialog(false)
                          setPinForVerification('')
                          setPinDialogAction(null)
                          setKeyToClear(null)
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinDialog(false)
                        setPinForVerification('')
                        setPinDialogAction(null)
                        setKeyToClear(null)
                      }}
                      className="px-4 py-2 glass-button text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePinDialogConfirm}
                      disabled={!pinForVerification.trim() || isSavingTeKey}
                      className="px-4 py-2 glass-button text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{
                        backgroundColor: "var(--primary)",
                        color: "white",
                      }}
                    >
                      {isSavingTeKey ? 'Verifying...' : 'Verify & Continue'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 p-4 glass-card border-yellow-400/30 rounded-xl">
            <p className="text-sm text-theme">
              <strong className="text-yellow-400">Security Notice:</strong> All keys are stored locally in your browser&apos;s localStorage. 
              They are never transmitted to any server except when making API calls. 
              Copying of keys is disabled to prevent accidental exposure.
            </p>
          </div>
        </form>
    </div>
  )
}
