'use client'

import { useState, useEffect } from 'react'
import SecurityIndicator from '@/components/SecurityIndicator'
import FileUploader from '@/components/FileUploader'
import FileList from '@/components/FileList'
import { UploadedFile } from '@/types/files'
import { addLog } from '@/lib/logging'
import { getAssociatedRisksFromLakeraDecision } from '@/types/risks'

export default function FilesPage() {
  const [isSecure, setIsSecure] = useState(true)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [lakeraScanEnabled, setLakeraScanEnabled] = useState(true)
  const [ragScanEnabled, setRagScanEnabled] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecure(window.location.protocol === 'https:' || window.location.hostname === 'localhost')
      
      // Load files from localStorage
      const stored = localStorage.getItem('uploadedFiles')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setFiles(parsed)
        } catch (e) {
          console.error('Failed to load files:', e)
        }
      }

      // Load Lakera scan toggle state from localStorage
      const scanToggle = localStorage.getItem('lakeraFileScanEnabled')
      if (scanToggle !== null) {
        setLakeraScanEnabled(JSON.parse(scanToggle))
      }

      // Load RAG scan toggle state from localStorage
      const ragToggle = localStorage.getItem('lakeraRagScanEnabled')
      if (ragToggle !== null) {
        setRagScanEnabled(JSON.parse(ragToggle))
      } else {
        // Default to true if not set
        setRagScanEnabled(true)
      }
    }
  }, [])

  // Save toggle states to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lakeraFileScanEnabled', JSON.stringify(lakeraScanEnabled))
    }
  }, [lakeraScanEnabled])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lakeraRagScanEnabled', JSON.stringify(ragScanEnabled))
    }
  }, [ragScanEnabled])

  // Save files to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && files.length >= 0) {
      localStorage.setItem('uploadedFiles', JSON.stringify(files))
    }
  }, [files])

  const handleFileUpload = async (newFile: UploadedFile) => {
    // If RAG scan is disabled, mark file as not scanned and upload without scanning
    if (!ragScanEnabled || !lakeraScanEnabled) {
      const fileToAdd: UploadedFile = { ...newFile, scanStatus: 'not_scanned' as const }
      setFiles(prev => [...prev, fileToAdd])
      return
    }
    
    // If RAG scan is enabled, add file with pending status and auto-scan
    setFiles(prev => [...prev, newFile])
    
    // Auto-scan for RAG if toggle is enabled
    // Use setTimeout to ensure state is updated before scanning
    setTimeout(() => {
      handleFileScan(newFile.id)
    }, 300)
  }

  const handleFileRemove = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const handleFileScan = async (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return

    // Check if Lakera scanning is enabled
    if (!lakeraScanEnabled) {
      alert('Lakera scanning is disabled. Please enable it using the toggle above.')
      return
    }

    setIsScanning(true)
    
    // Update file status to scanning
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, scanStatus: 'scanning' as const, scanResult: undefined } : f
    ))

    try {
      const apiKeys = localStorage.getItem('apiKeys')
      const keys = apiKeys ? JSON.parse(apiKeys) : {}

      if (!keys.lakeraAiKey) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, scanStatus: 'error' as const, scanResult: 'Lakera API key not configured. Please add it in Settings.' } : f
        ))
        setIsScanning(false)
        return
      }

      // Validate endpoint
      if (!keys.lakeraEndpoint || !keys.lakeraEndpoint.startsWith('http')) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, scanStatus: 'error' as const, scanResult: 'Invalid Lakera endpoint. Please check Settings.' } : f
        ))
        setIsScanning(false)
        return
      }

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileContent: file.content,
          fileName: file.name,
          apiKeys: keys,
        }),
      })

      let data: { 
        flagged: boolean
        message?: string
        error?: string
        details?: { categories?: Record<string, boolean>; score?: number; threatLevel?: string }
        logData?: unknown
      }
      
      // Try to parse as JSON first
      const contentType = response.headers.get('content-type')
      const isJson = contentType && contentType.includes('application/json')
      
      if (isJson) {
        try {
          data = await response.json()
        } catch (parseError) {
          throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
        }
      } else {
        // If not JSON, read as text
        const text = await response.text()
        throw new Error(`Unexpected response format: ${text.substring(0, 200)}`)
      }

      if (!response.ok) {
        // More detailed error message with details if available
        let errorMsg = data?.error || `Scan failed with status ${response.status}`
        
        // Add details if available
        if (data?.details) {
          if (typeof data.details === 'string') {
            errorMsg += ` - ${data.details}`
          } else if (typeof data.details === 'object') {
            try {
              const detailsStr = JSON.stringify(data.details).substring(0, 200)
              errorMsg += ` - ${detailsStr}`
            } catch {
              errorMsg += ' - Error details available but could not be displayed'
            }
          }
        }
        
        throw new Error(errorMsg)
      }

      // Log the scan result
      if (data.logData) {
        const associatedRisks = getAssociatedRisksFromLakeraDecision(
          data.details?.categories,
          data.flagged ? 'blocked' : 'scanned',
          'file_scan'
        )
        const logData = data.logData as Omit<import('@/types/logs').LogEntry, 'id' | 'timestamp'>
        addLog({
          ...logData,
          associatedRisks,
        })
      } else {
        const associatedRisks = getAssociatedRisksFromLakeraDecision(
          data.details?.categories,
          data.flagged ? 'blocked' : 'scanned',
          'file_scan'
        )
        addLog({
          type: 'file_scan',
          action: data.flagged ? 'blocked' : 'scanned',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          lakeraDecision: {
            scanned: true,
            flagged: data.flagged,
            categories: data.details?.categories,
            scores: data.details?.score ? { threat: data.details.score } : undefined,
            message: data.message,
          },
          success: true,
          associatedRisks,
        })
      }

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          scanStatus: data.flagged ? 'flagged' as const : 'safe' as const,
          scanResult: data.message || (data.flagged ? 'Security threats detected' : 'File is safe'),
          scanDetails: data.details
        } : f
      ))
    } catch (error) {
      let message = 'Scan failed. Please check your API configuration.'
      
      if (error instanceof Error) {
        message = error.message
        
        // Add helpful suggestions based on error type
        if (error.message.includes('401') || error.message.includes('Invalid') || error.message.includes('API key')) {
          message += ' - Please check your Lakera API key in Settings.'
        } else if (error.message.includes('403') || error.message.includes('denied')) {
          message += ' - Please check your API key and project ID in Settings.'
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          message += ' - Please check your Lakera endpoint URL in Settings.'
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
          message += ' - Please wait a moment and try again.'
        } else if (error.message.includes('network') || error.message.includes('connect')) {
          message += ' - Check your internet connection and API endpoint.'
        }
      }
      
      // Log error
      addLog({
        type: 'error',
        action: 'error',
        source: 'file_upload',
        requestDetails: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        },
        error: message,
        success: false,
        associatedRisks: ['llm03'], // Supply Chain risk for errors
      })

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, scanStatus: 'error' as const, scanResult: message } : f
      ))
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="bento-grid">
      {/* Header Card */}
      <div className="bento-card bento-span-4 glass-card p-6 liquid-shimmer">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-theme drop-shadow-lg">File Upload & RAG</h1>
            <p className="mt-2 text-sm text-theme-muted">
              Upload documents for RAG (Retrieval-Augmented Generation). Files are scanned by Lakera AI for security.
            </p>
          </div>
          <div className="mt-4">
            <SecurityIndicator isSecure={isSecure} />
          </div>
        </div>
      </div>

      {/* Upload Section Card */}
      <div className="bento-card bento-span-2 glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-theme">Upload Files</h2>
        </div>
        
        {/* Toggle Options - More Visible */}
        <div className="mb-6 space-y-4">
          <div className="glass-card rounded-xl p-4 border-brand-berry/30">
            <h3 className="text-sm font-semibold text-theme mb-3">Scanning Options</h3>
            
            {/* Lakera Scan Toggle */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-theme">Lakera Scan</span>
                <span className="text-xs text-theme-subtle mt-1">Enable manual file scanning</span>
              </div>
              <div className="flex items-center space-x-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lakeraScanEnabled}
                    onChange={(e) => {
                      setLakeraScanEnabled(e.target.checked)
                      if (!e.target.checked) {
                        setRagScanEnabled(false) // Disable RAG scan if Lakera is disabled
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-berry/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-berry/50"></div>
                  <span className={`ml-3 text-sm font-medium ${lakeraScanEnabled ? 'text-brand-berry' : 'text-white/60'}`}>
                    {lakeraScanEnabled ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            </div>

            {/* RAG Scan Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-theme">RAG Auto-Scan</span>
                <span className="text-xs text-theme-subtle mt-1">Automatically scan files on upload</span>
              </div>
              <div className="flex items-center space-x-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ragScanEnabled && lakeraScanEnabled}
                    onChange={(e) => setRagScanEnabled(e.target.checked)}
                    disabled={!lakeraScanEnabled}
                    className="sr-only peer"
                  />
                  <div className={`w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-berry/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-berry/50 ${!lakeraScanEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  <span className={`ml-3 text-sm font-medium ${ragScanEnabled && lakeraScanEnabled ? 'text-brand-berry' : 'text-white/60'}`}>
                    {ragScanEnabled && lakeraScanEnabled ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <FileUploader onFileUpload={handleFileUpload} lakeraScanEnabled={lakeraScanEnabled} ragScanEnabled={ragScanEnabled} />
      </div>

      {/* Files List Section Card */}
      <div className="bento-card bento-span-2 bento-row-span-2 glass-card p-6 overflow-hidden flex flex-col">
        <h2 className="text-lg font-semibold text-theme mb-4">
          Uploaded Files ({files.length})
        </h2>
        <FileList 
          files={files} 
          onRemove={handleFileRemove}
          onScan={handleFileScan}
          isScanning={isScanning}
          lakeraScanEnabled={lakeraScanEnabled}
        />
      </div>

      {/* Info Section Card */}
      <div className="bento-card bento-span-2 glass-card p-4 border-brand-berry/30">
        <h3 className="text-brand-berry font-medium mb-2">📁 Supported Features</h3>
        <ul className="text-sm text-theme-muted space-y-1">
          <li>• Maximum file size: 50 MB</li>
          <li>• Supported formats: PDF, TXT, MD, JSON, CSV, DOCX</li>
          <li>• Lakera AI security scanning for uploaded content</li>
          <li>• Files stored locally in your browser</li>
        </ul>
      </div>
    </div>
  )
}
