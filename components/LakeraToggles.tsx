'use client'

import { useState, useEffect } from 'react'

interface LakeraTogglesProps {
  onInputScanChange: (enabled: boolean) => void
  onOutputScanChange: (enabled: boolean) => void
  hasLakeraKey: boolean
}

export default function LakeraToggles({ 
  onInputScanChange, 
  onOutputScanChange,
  hasLakeraKey 
}: LakeraTogglesProps) {
  const [inputScan, setInputScan] = useState(true)
  const [outputScan, setOutputScan] = useState(true)

  // Load toggle states from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lakeraToggles')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setInputScan(parsed.inputScan !== false) // Default to true
          setOutputScan(parsed.outputScan !== false) // Default to true
        } catch (e) {
          console.error('Failed to load toggle states:', e)
        }
      }
    }
  }, [])

  // Save to localStorage and notify parent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lakeraToggles', JSON.stringify({ inputScan, outputScan }))
    }
    onInputScanChange(inputScan)
    onOutputScanChange(outputScan)
  }, [inputScan, outputScan, onInputScanChange, onOutputScanChange])

  if (!hasLakeraKey) {
    return (
      <div className="glass-card rounded-2xl p-3 border-yellow-400/30">
        <p className="text-theme-muted text-xs">
          ⚠️ Lakera AI keys not configured. 
          <a href="/settings" className="underline hover:text-brand-berry ml-1 transition-colors">
            Configure in Settings
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-theme mb-3">🛡️ Lakera AI Protection</h3>
          <div className="space-y-3">
            {/* Input Scan Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-theme">Input Scan</span>
                <span className="text-xs text-theme-subtle">(User messages)</span>
                {/* Status Dot */}
                <div 
                  className={`h-2 w-2 rounded-full transition-all ${
                    inputScan ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  title={inputScan ? 'Enabled' : 'Disabled'}
                  style={{
                    boxShadow: inputScan 
                      ? '0 0 8px rgba(34, 197, 94, 0.6)' 
                      : '0 0 8px rgba(239, 68, 68, 0.6)'
                  }}
                />
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={inputScan}
                  onChange={(e) => setInputScan(e.target.checked)}
                  className="sr-only peer"
                  disabled={!hasLakeraKey}
                />
                <div className="w-11 h-6 bg-palette-bg-secondary/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-palette-accent-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-palette-text-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-palette-text-primary after:border-palette-border-default/30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-palette-accent-primary/50"></div>
                <span className={`ml-2 text-xs ${inputScan ? 'text-brand-berry' : 'text-theme-subtle'}`}>
                  {inputScan ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>

            {/* Output Scan Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-theme">Output Scan</span>
                <span className="text-xs text-theme-subtle">(AI responses)</span>
                {/* Status Dot */}
                <div 
                  className={`h-2 w-2 rounded-full transition-all ${
                    outputScan ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  title={outputScan ? 'Enabled' : 'Disabled'}
                  style={{
                    boxShadow: outputScan 
                      ? '0 0 8px rgba(34, 197, 94, 0.6)' 
                      : '0 0 8px rgba(239, 68, 68, 0.6)'
                  }}
                />
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={outputScan}
                  onChange={(e) => setOutputScan(e.target.checked)}
                  className="sr-only peer"
                  disabled={!hasLakeraKey}
                />
                <div className="w-11 h-6 bg-palette-bg-secondary/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-palette-accent-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-palette-text-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-palette-text-primary after:border-palette-border-default/30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-palette-accent-primary/50"></div>
                <span className={`ml-2 text-xs ${outputScan ? 'text-brand-berry' : 'text-theme-subtle'}`}>
                  {outputScan ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-theme-subtle mt-3">
        Scans messages for prompt injection, jailbreak attempts, and other security threats
      </p>
    </div>
  )
}
